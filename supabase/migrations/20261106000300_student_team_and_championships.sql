-- =============================================================================
-- Kimi — Student app: Equipe (classmates) and championships of the modality
-- (user decision, 2026-11-06)
--
-- 1. Championships: every student with an active link to the modality reads
--    them (read only); the competitors entered come from
--    championship_competitors() with name, photo and belt only.
-- 2. Classmates: classmates(academy) lists, for an active student, the active
--    staff of the academy and the active students who share at least one
--    active modality with them: name, photo, role, member since, and per
--    modality in common the belt and the competitor seal. No health data
--    (water, weight, plans) and no attendance history.
-- 3. Photos: a student also reads the photos of the academy's staff.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Championships
-- -----------------------------------------------------------------------------
drop policy "championships: staff or entered competitor of the modality reads" on public.championships;
create policy "championships: staff, entered competitor or linked student reads"
  on public.championships for select to authenticated
  using (
    private.is_staff(academy_id)
    or private.is_enrolled_in_modality(modality_id)
    or (
      private.competes_in_modality((select auth.uid()), modality_id)
      and exists (
        select 1 from public.championship_entries e
        where e.championship_id = championships.id and e.athlete_id = (select auth.uid())
      )
    )
  );

-- Latest belt of a membership in a modality (null when none).
create function private.modality_belt(p_membership_id uuid, p_modality_id uuid)
returns table (primary_color text, tip_color text)
language sql
stable
security definer
set search_path = ''
as $$
  select mb.primary_color::text, mb.tip_color::text
  from public.belt_history bh
  join public.modality_belts mb on mb.id = bh.belt_id
  where bh.membership_id = p_membership_id and bh.modality_id = p_modality_id
  order by bh.awarded_at desc
  limit 1;
$$;
revoke all on function private.modality_belt(uuid, uuid) from public, anon;
grant execute on function private.modality_belt(uuid, uuid) to authenticated;

-- Competitors entered in a championship: staff, or a student linked to its modality.
create function public.championship_competitors(p_championship_id uuid)
returns table (user_id uuid, full_name text, avatar_path text, belt_primary text, belt_tip text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_championship public.championships%rowtype;
begin
  select * into v_championship from public.championships where id = p_championship_id;
  if not found
     or not (private.is_staff(v_championship.academy_id) or private.is_enrolled_in_modality(v_championship.modality_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.avatar_path, b.primary_color, b.tip_color
  from public.championship_entries e
  join public.profiles p on p.id = e.athlete_id
  join public.memberships m on m.user_id = e.athlete_id and m.academy_id = v_championship.academy_id
  left join lateral private.modality_belt(m.id, v_championship.modality_id) b on true
  where e.championship_id = p_championship_id
  order by p.full_name;
end;
$$;
revoke all on function public.championship_competitors(uuid) from public, anon;
grant execute on function public.championship_competitors(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Classmates
-- -----------------------------------------------------------------------------
create function public.classmates(p_academy_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  role public.membership_role,
  member_since timestamptz,
  -- [{modality_id, belt_primary, belt_tip, is_competitor}] of the modalities in common.
  modalities jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_viewer public.memberships%rowtype;
begin
  select * into v_viewer from public.memberships m
  where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role = 'student';
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  -- Staff of the academy: no modality link of their own.
  select p.id, p.full_name, p.avatar_path, m.role, coalesce(m.decided_at, m.created_at), '[]'::jsonb
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.academy_id = p_academy_id and m.status = 'active' and m.role in ('owner', 'instructor')
  union all
  -- Students (the viewer included) with at least one active modality in common.
  select p.id, p.full_name, p.avatar_path, m.role, coalesce(m.decided_at, m.created_at),
    jsonb_agg(jsonb_build_object(
      'modality_id', te.modality_id,
      'belt_primary', b.primary_color,
      'belt_tip', b.tip_color,
      'is_competitor', te.is_competitor
    ) order by te.modality_id)
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join public.student_modality_enrollments te on te.membership_id = m.id and te.status = 'active'
  join public.student_modality_enrollments ve
    on ve.membership_id = v_viewer.id and ve.status = 'active' and ve.modality_id = te.modality_id
  left join lateral private.modality_belt(m.id, te.modality_id) b on true
  where m.academy_id = p_academy_id and m.status = 'active' and m.role = 'student'
  group by p.id, p.full_name, p.avatar_path, m.role, m.decided_at, m.created_at
  order by 2;
end;
$$;
revoke all on function public.classmates(uuid) from public, anon;
grant execute on function public.classmates(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Photos of the academy's staff
-- -----------------------------------------------------------------------------
-- The target is active staff of an academy where the caller is an active member.
create function private.is_staff_of_my_academy(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid()) and viewer.status = 'active'
      and target.user_id = p_user_id and target.status = 'active'
      and target.role in ('owner', 'instructor')
  );
$$;
revoke all on function private.is_staff_of_my_academy(uuid) from public, anon;
grant execute on function private.is_staff_of_my_academy(uuid) to authenticated;

drop policy "avatars: own staff or classmates" on storage.objects;
create policy "avatars: own, staff, classmates or the academy's staff" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (
  private.storage_folder_uuid(name) = (select auth.uid())
  or private.is_staff_of_member(private.storage_folder_uuid(name))
  or private.shares_active_modality(private.storage_folder_uuid(name))
  or private.is_staff_of_my_academy(private.storage_folder_uuid(name))
));
