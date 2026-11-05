-- =============================================================================
-- Kimi — Water streak (backlog: ofensivas)
--
-- A water day counts when the day's total reaches THAT day's goal. Goals
-- change (weight, the professor's plan), so the app records the goal of each
-- day it sees (water_goal_days) and history keeps the goal it had.
--
-- my_water_days(): per local day (profile time zone) the total from the
-- server logs and the goal in force: the day's own record, else the latest
-- earlier one, else the first ever (days before the feature existed).
-- The streak itself (with freezes) is computed by the app from these rows.
-- =============================================================================

create table public.water_goal_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  goal_ml integer not null check (goal_ml between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger water_goal_days_set_updated_at before update on public.water_goal_days
  for each row execute function private.set_updated_at();

alter table public.water_goal_days enable row level security;

grant select, insert, update on public.water_goal_days to authenticated;

create policy "water_goal_days: read own"
  on public.water_goal_days for select to authenticated
  using (user_id = (select auth.uid()));
create policy "water_goal_days: insert own"
  on public.water_goal_days for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "water_goal_days: update own"
  on public.water_goal_days for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- SECURITY INVOKER: only the caller's own logs and goals are visible anyway.
create function public.my_water_days()
returns table (day date, total_ml integer, goal_ml integer)
language sql
stable
set search_path = ''
as $$
  with me as (
    select p.id, p.timezone from public.profiles p where p.id = (select auth.uid())
  ),
  days as (
    select (w.logged_at at time zone me.timezone)::date as day, sum(w.amount_ml)::integer as total_ml
    from public.water_logs w
    join me on me.id = w.user_id
    group by 1
  )
  select d.day, d.total_ml, coalesce(
    (select g.goal_ml from public.water_goal_days g
     where g.user_id = (select auth.uid()) and g.day <= d.day
     order by g.day desc limit 1),
    (select g.goal_ml from public.water_goal_days g
     where g.user_id = (select auth.uid())
     order by g.day asc limit 1)
  ) as goal_ml
  from days d
  order by d.day;
$$;

revoke all on function public.my_water_days() from public, anon;
grant execute on function public.my_water_days() to authenticated;
