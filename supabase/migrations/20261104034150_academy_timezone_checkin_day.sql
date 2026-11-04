-- =============================================================================
-- Kimi — Academy timezone + check-in only on the class day
-- "Today" for classes is the academy's local date, the same for every member
-- (product decision). Water keeps using the profile timezone.
-- =============================================================================

-- True when Postgres knows the zone name (e.g. 'America/Sao_Paulo').
create function private.is_valid_timezone(p_tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform now() at time zone p_tz;
  return true;
exception when others then
  return false;
end;
$$;

grant execute on function private.is_valid_timezone(text) to authenticated;

alter table public.academies
  add column timezone text not null default 'America/Sao_Paulo'
    check (private.is_valid_timezone(timezone));

-- Professors edit it through the existing "academies: professor updates" policy.
grant update (timezone) on public.academies to authenticated;

-- Local date of the academy. SECURITY INVOKER: callers already read the
-- academy through RLS (members only), so it returns null for anyone else.
create function private.academy_local_date(p_academy_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone a.timezone)::date
  from public.academies a
  where a.id = p_academy_id;
$$;

revoke all on function private.academy_local_date(uuid) from public, anon;
grant execute on function private.academy_local_date(uuid) to authenticated;

-- Check-in: own, pending, active member, active class of that academy, and the
-- class date is TODAY in the academy's timezone (so the weekday must match too).
drop policy "checkins: member creates own pending" on public.checkins;

create policy "checkins: member creates own pending for today"
  on public.checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.is_member(academy_id)
    and class_date = private.academy_local_date(academy_id)
    and exists (
      select 1 from public.class_schedules s
      where s.id = schedule_id
        and s.academy_id = checkins.academy_id
        and s.active
        and s.weekday = extract(dow from class_date)
    )
  );
