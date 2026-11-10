-- =============================================================================
-- Kimi — Instructor profile: write paths and direct reads
--
-- 1. instructor_profiles: PostgREST upsert (ON CONFLICT (user_id) DO UPDATE
--    SET user_id = excluded.user_id, …) needs UPDATE on user_id too. Safe: the
--    update policy pins user_id to auth.uid() in USING and WITH CHECK.
-- 2. instructor_belts: written through set_instructor_belt() (update, else
--    insert, or delete), so the key columns never need UPDATE (moving a row to
--    a modality without belts would skip the insert policy).
-- 3. Direct reads of instructor_profiles: the person, or active staff of an
--    academy where the person is active staff (not any academy the person is
--    a member of). Everyone else reads through get_instructor_profile().
-- =============================================================================

grant update (user_id) on public.instructor_profiles to authenticated;

-- ------------------------------------------------------ set_instructor_belt ---
-- SECURITY INVOKER: plain RLS (the person or the owner, modalities with belts).
create function public.set_instructor_belt(p_membership_id uuid, p_modality_id uuid, p_belt_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_academy uuid;
begin
  select m.academy_id into v_academy from public.memberships m where m.id = p_membership_id;
  if v_academy is null or not private.can_edit_staff_membership(p_membership_id, v_academy, true, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_belt_id is null then
    delete from public.instructor_belts where membership_id = p_membership_id and modality_id = p_modality_id;
    return;
  end if;

  update public.instructor_belts set belt_id = p_belt_id
  where membership_id = p_membership_id and modality_id = p_modality_id;
  if not found then
    insert into public.instructor_belts (membership_id, academy_id, modality_id, belt_id)
    values (p_membership_id, v_academy, p_modality_id, p_belt_id);
  end if;
end;
$$;

revoke all on function public.set_instructor_belt(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_instructor_belt(uuid, uuid, uuid) to authenticated;

-- ------------------------------------------------------------ direct reads ---
-- Caller is active staff of an academy where the person is active staff.
create function private.is_staff_colleague(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role in ('owner', 'instructor')
      and target.user_id = p_user_id
      and target.status = 'active'
      and target.role in ('owner', 'instructor')
  );
$$;

revoke all on function private.is_staff_colleague(uuid) from public, anon;
grant execute on function private.is_staff_colleague(uuid) to authenticated;

drop policy "instructor_profiles: own or staff reads" on public.instructor_profiles;
create policy "instructor_profiles: own or staff colleagues read"
  on public.instructor_profiles for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff_colleague(user_id));
