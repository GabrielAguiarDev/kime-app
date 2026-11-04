-- =============================================================================
-- Kimi — Phase 2: belt keys, academy "today" and class stats
--
-- Belts are stored as keys of the design-system palette (2.4), the same keys
-- the app uses for colors: white, gray, yellow, orange, green, blue, purple,
-- brown, black, red. No belt data existed when this ran.
-- =============================================================================

create function private.is_belt_key(p_belt text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_belt in ('white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black', 'red');
$$;

grant execute on function private.is_belt_key(text) to authenticated;

alter table public.belt_goals add constraint belt_goals_belt_key check (private.is_belt_key(belt));
alter table public.memberships add constraint memberships_belt_key check (belt is null or private.is_belt_key(belt));
alter table public.belt_history add constraint belt_history_belt_key check (private.is_belt_key(belt));

-- -----------------------------------------------------------------------------
-- Academy "today" for the app (check-in day, today's classes). SECURITY
-- INVOKER: null for anyone who cannot read the academy.
-- -----------------------------------------------------------------------------
create function public.academy_today(p_academy_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select private.academy_local_date(p_academy_id);
$$;

revoke all on function public.academy_today(uuid) from public, anon;
grant execute on function public.academy_today(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Confirmed classes per membership. security_invoker: every underlying RLS
-- applies, so a student sees only their own row and a professor the rows of
-- their academy. Only confirmed check-ins count.
--   confirmed_total        all confirmed classes in the academy
--   confirmed_since_belt   confirmed classes AFTER the day of the last
--                          graduation (academy local date); all of them when
--                          the member was never graduated
-- -----------------------------------------------------------------------------
create view public.membership_class_stats
with (security_invoker = true)
as
select
  m.id as membership_id,
  m.academy_id,
  m.user_id,
  m.belt,
  lb.awarded_at as belt_awarded_at,
  count(c.id) filter (where c.status = 'confirmed')::int as confirmed_total,
  count(c.id) filter (
    where c.status = 'confirmed' and (lb.awarded_on is null or c.class_date > lb.awarded_on)
  )::int as confirmed_since_belt
from public.memberships m
left join lateral (
  select bh.awarded_at, (bh.awarded_at at time zone a.timezone)::date as awarded_on
  from public.belt_history bh
  join public.academies a on a.id = m.academy_id
  where bh.membership_id = m.id
  order by bh.awarded_at desc
  limit 1
) lb on true
left join public.checkins c on c.user_id = m.user_id and c.academy_id = m.academy_id
group by m.id, m.academy_id, m.user_id, m.belt, lb.awarded_at, lb.awarded_on;

revoke all on public.membership_class_stats from anon, authenticated;
grant select on public.membership_class_stats to authenticated;

-- Stats join checkins by (user_id, academy_id).
create index checkins_user_academy_idx on public.checkins (user_id, academy_id, status);
