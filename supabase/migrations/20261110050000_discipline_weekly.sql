-- =============================================================================
-- Kimi — Disciplina: one weekly streak (user decision, 2026-11-10)
--
-- Replaces the two streaks (daily water, weekly training), which the app
-- computed on the device. The database is now the single source of truth.
--
-- A week (Monday–Sunday, America/Sao_Paulo) is DONE when the user has
--   - at least one class confirmed by the professor that week (any academy,
--     any modality: the streak is general), and
--   - the water goal met on at least 5 of the 7 days (same day rule as the
--     ranking: plan or automatic goal; on a limit day, between 90 % and 100 %).
--
-- Closed weeks, oldest first, from the week of the first confirmed class:
--   - done: the streak grows; every 4 done weeks in a row earn a freeze (max 2);
--   - not done with a freeze in stock (and a streak to protect): the freeze is
--     spent automatically, the week is FROZEN and the streak keeps its value;
--   - otherwise MISSED: the streak goes back to 0.
-- The current week never breaks anything while it is open (a pending check-in
-- can still turn it); once done it already counts.
--
-- Stored per user: current streak, record, freezes in stock (discipline_streaks)
-- and every closed week (discipline_weeks). Everything is recomputed from the
-- facts (check-ins, water logs, goal history), so late confirmations and
-- offline water sync are picked up on the next refresh: on read
-- (my_discipline), by the ranking job and by a daily job.
-- =============================================================================

create table public.discipline_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_weeks integer not null default 0 check (current_weeks >= 0),
  record_weeks integer not null default 0 check (record_weeks >= current_weeks),
  freezes smallint not null default 0 check (freezes between 0 and 2),
  -- Monday of the week these values were computed in, and whether it is done.
  week_start date not null check (extract(isodow from week_start) = 1),
  week_done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.discipline_weeks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  state text not null check (state in ('done', 'frozen', 'missed')),
  water_days smallint not null check (water_days between 0 and 7),
  confirmed_classes integer not null check (confirmed_classes >= 0),
  primary key (user_id, week_start)
);

alter table public.discipline_streaks enable row level security;
alter table public.discipline_weeks enable row level security;

-- Read only, own rows. Writes happen only in the SECURITY DEFINER refresh.
revoke all on public.discipline_streaks, public.discipline_weeks from anon, authenticated;
grant select on public.discipline_streaks, public.discipline_weeks to authenticated;

create policy "discipline_streaks: read own"
  on public.discipline_streaks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "discipline_weeks: read own"
  on public.discipline_weeks for select to authenticated
  using (user_id = (select auth.uid()));

-- Confirmed classes by user and date (any academy).
create index checkins_user_date_confirmed_idx on public.checkins (user_id, class_date) where status = 'confirmed';

-- -----------------------------------------------------------------------------
-- Per day: water state (shared rule) and the user's classes, in São Paulo time.
-- -----------------------------------------------------------------------------
create function private.discipline_days(p_user uuid, p_from date, p_to date)
returns table (day date, water text, confirmed integer, pending integer)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select g::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ),
  water as (
    select (l.logged_at at time zone 'America/Sao_Paulo')::date as day, sum(l.amount_ml)::integer as total
    from public.water_logs l
    where l.user_id = p_user
      and l.logged_at >= (p_from::timestamp at time zone 'America/Sao_Paulo')
      and l.logged_at < ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo')
    group by 1
  ),
  classes as (
    select c.class_date as day,
      count(*) filter (where c.status = 'confirmed')::integer as confirmed,
      count(*) filter (where c.status = 'pending')::integer as pending
    from public.checkins c
    where c.user_id = p_user and c.class_date between p_from and p_to
    group by 1
  )
  select d.day,
    private.water_day_state(coalesce(w.total, 0), t.goal, t.is_limit),
    coalesce(c.confirmed, 0),
    coalesce(c.pending, 0)
  from days d
  left join water w on w.day = d.day
  left join classes c on c.day = d.day
  cross join lateral private.ranking_water_target(p_user, null, d.day) t
  order by d.day;
$$;
revoke all on function private.discipline_days(uuid, date, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Recomputes and stores a user's streak from the facts.
-- -----------------------------------------------------------------------------
create function private.refresh_discipline(
  p_user uuid,
  p_today date default (now() at time zone 'America/Sao_Paulo')::date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := date_trunc('week', p_today)::date;
  v_first date;
  v_w record;
  v_done boolean;
  v_current integer := 0;
  v_record integer := 0;
  v_freezes integer := 0;
  v_week_done boolean := false;
  v_state text;
begin
  -- One refresh per user at a time (read, ranking and daily job may overlap).
  perform pg_advisory_xact_lock(hashtextextended('discipline:' || p_user::text, 0));

  select min(c.class_date) into v_first
  from public.checkins c where c.user_id = p_user and c.status = 'confirmed' and c.class_date <= p_today;

  delete from public.discipline_weeks where user_id = p_user;

  if v_first is not null then
    for v_w in
      select date_trunc('week', d.day)::date as ws,
        count(*) filter (where d.water = 'done')::integer as water_days,
        sum(d.confirmed)::integer as classes
      from private.discipline_days(p_user, date_trunc('week', v_first)::date, v_week + 6) d
      group by 1
      order by 1
    loop
      v_done := v_w.classes >= 1 and v_w.water_days >= 5;
      if v_w.ws = v_week then
        -- Open week: counts once done, never breaks.
        v_week_done := v_done;
        if v_done then
          v_current := v_current + 1;
          v_record := greatest(v_record, v_current);
          if v_current % 4 = 0 then v_freezes := least(2, v_freezes + 1); end if;
        end if;
      else
        if v_done then
          v_current := v_current + 1;
          v_record := greatest(v_record, v_current);
          if v_current % 4 = 0 then v_freezes := least(2, v_freezes + 1); end if;
          v_state := 'done';
        elsif v_current > 0 and v_freezes > 0 then
          v_freezes := v_freezes - 1;
          v_state := 'frozen';
        else
          v_current := 0;
          v_state := 'missed';
        end if;
        insert into public.discipline_weeks (user_id, week_start, state, water_days, confirmed_classes)
        values (p_user, v_w.ws, v_state, v_w.water_days, v_w.classes);
      end if;
    end loop;
  end if;

  insert into public.discipline_streaks (user_id, current_weeks, record_weeks, freezes, week_start, week_done, updated_at)
  values (p_user, v_current, v_record, v_freezes, v_week, v_week_done, now())
  on conflict (user_id) do update set
    current_weeks = excluded.current_weeks,
    record_weeks = excluded.record_weeks,
    freezes = excluded.freezes,
    week_start = excluded.week_start,
    week_done = excluded.week_done,
    updated_at = excluded.updated_at;
end $$;
revoke all on function private.refresh_discipline(uuid, date) from public, anon, authenticated;

-- Everyone with a confirmed class (the daily job).
create function private.refresh_all_discipline()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  for v_user in select distinct c.user_id from public.checkins c where c.status = 'confirmed' loop
    perform private.refresh_discipline(v_user);
  end loop;
end $$;
revoke all on function private.refresh_all_discipline() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The Disciplina screen: refreshed streak, this week day by day and the last
-- closed weeks. Only the caller's own data.
-- -----------------------------------------------------------------------------
create function public.my_discipline()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week date := date_trunc('week', v_today)::date;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.refresh_discipline(v_uid, v_today);
  return (
    select jsonb_build_object(
      'today', v_today,
      'week_start', v_week,
      'current', s.current_weeks,
      'record', s.record_weeks,
      'freezes', s.freezes,
      'week_done', s.week_done,
      'days', (
        select jsonb_agg(jsonb_build_object(
          'day', d.day, 'water', d.water, 'confirmed', d.confirmed, 'pending', d.pending) order by d.day)
        from private.discipline_days(v_uid, v_week, v_week + 6) d
      ),
      'weeks', coalesce((
        select jsonb_agg(jsonb_build_object('week_start', w.week_start, 'state', w.state) order by w.week_start)
        from (
          select dw.week_start, dw.state from public.discipline_weeks dw
          where dw.user_id = v_uid order by dw.week_start desc limit 12
        ) w
      ), '[]'::jsonb)
    )
    from public.discipline_streaks s where s.user_id = v_uid
  );
end $$;
revoke all on function public.my_discipline() from public, anon;
grant execute on function public.my_discipline() to authenticated;

-- 03:05 UTC = 00:05 in Brasília: closes the week that just ended on Monday and
-- picks up late confirmations and offline water every day.
select cron.schedule('kimi-daily-discipline', '5 3 * * *', 'select private.refresh_all_discipline()');

-- Development data: computed from the existing facts (old values not migrated).
select private.refresh_all_discipline();
