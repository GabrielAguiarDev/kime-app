-- =============================================================================
-- Kimi — Only students check in
-- Owners and instructors do not train in the app: no check-ins, no class
-- count, no belt trail (product decision, 2026-11-04). The insert policy now
-- requires an ACTIVE STUDENT membership in that academy.
-- =============================================================================

create function private.is_student(p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'student'
  );
$$;

revoke all on function private.is_student(uuid) from public, anon;
grant execute on function private.is_student(uuid) to authenticated;

drop policy "checkins: member creates own pending for today" on public.checkins;

create policy "checkins: student creates own pending for today"
  on public.checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.is_student(academy_id)
    and class_date = private.academy_local_date(academy_id)
    and exists (
      select 1 from public.class_schedules s
      where s.id = schedule_id
        and s.academy_id = checkins.academy_id
        and s.active
        and s.weekday = extract(dow from class_date)
    )
  );
