-- =============================================================================
-- Kimi — Inactive students ("Alunos sumidos", user request, 2026-11-12)
--
-- A student is "sumido" when they have no confirmed class in the academy (any
-- modality) for academies.inactive_after_days days (owner sets it, default
-- 14). Someone who never trained counts from the day they were approved
-- (memberships.decided_at; the request day for old rows), so a student who
-- just joined does not show up. Only classes since that day count (a student
-- who left and came back starts over).
--
-- public.inactive_students(academy): staff only (owner and instructors see
-- every student, user decision). Active students only; a fee block does not
-- matter here.
-- =============================================================================

alter table public.academies
  add column inactive_after_days smallint not null default 14
  check (inactive_after_days between 7 and 90);

-- The owner changes it (the update policy on academies is owner-only).
grant update (inactive_after_days) on public.academies to authenticated;

create function public.inactive_students(p_academy_id uuid)
returns table (membership_id uuid, user_id uuid, last_class_date date, joined_on date, inactive_since date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_days smallint;
  v_timezone text;
begin
  if (select auth.uid()) is null or not private.is_staff(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select a.inactive_after_days, a.timezone into v_days, v_timezone
  from public.academies a where a.id = p_academy_id;
  v_today := private.academy_local_date(p_academy_id);

  return query
  select s.id, s.user_id, s.last_class_date, s.joined_on, coalesce(s.last_class_date, s.joined_on)
  from (
    select
      j.id,
      j.user_id,
      j.joined_on,
      -- Only classes since this membership started: a student who left and
      -- came back does not count the old ones.
      (
        select max(c.class_date) from public.checkins c
        where c.academy_id = p_academy_id and c.user_id = j.user_id and c.status = 'confirmed'
          and c.class_date >= j.joined_on
      ) as last_class_date
    from (
      select m.id, m.user_id, (coalesce(m.decided_at, m.created_at) at time zone v_timezone)::date as joined_on
      from public.memberships m
      where m.academy_id = p_academy_id and m.status = 'active' and m.role = 'student'
    ) j
  ) s
  where coalesce(s.last_class_date, s.joined_on) <= v_today - v_days
  order by coalesce(s.last_class_date, s.joined_on), s.id;
end;
$$;
revoke all on function public.inactive_students(uuid) from public, anon;
grant execute on function public.inactive_students(uuid) to authenticated;
