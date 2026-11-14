-- =============================================================================
-- Disciplina per academy (user decision, 2026-11-14)
--
-- An academy never sees anything of another academy. The streak was one per
-- user and accepted a confirmed class in ANY academy; its frozen weeks also
-- took days out of each academy's ranking, so academy B's classes changed
-- academy A's ranking.
--
-- Now:
--   - Water stays personal (global, tied to the user): same water facts and
--     goal in every academy.
--   - Classes count per academy: a week is DONE in academy A with the water
--     goal met (every day; 5 of 7 before the week of 2026-11-09) AND at least
--     one class confirmed in A.
--   - One streak per (user, academy): discipline_streaks / discipline_weeks
--     gain academy_id. The Disciplina screen shows the active academy's.
--   - The ranking of A only uses A's frozen weeks.
--
-- The stored values are derived (recomputed from check-ins and water logs),
-- so the old rows are dropped and rebuilt on the next read / daily job.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables: one row per user and academy.
-- -----------------------------------------------------------------------------
delete from public.discipline_weeks;
delete from public.discipline_streaks;

alter table public.discipline_streaks
  add column academy_id uuid not null references public.academies (id) on delete cascade,
  drop constraint discipline_streaks_pkey,
  add primary key (user_id, academy_id);

alter table public.discipline_weeks
  add column academy_id uuid not null references public.academies (id) on delete cascade,
  drop constraint discipline_weeks_pkey,
  add primary key (user_id, academy_id, week_start);

create index discipline_streaks_academy_idx on public.discipline_streaks (academy_id);
create index discipline_weeks_academy_idx on public.discipline_weeks (academy_id);

-- Confirmed classes by user, academy and date (replaces the per-user index).
create index checkins_user_academy_date_confirmed_idx
  on public.checkins (user_id, academy_id, class_date) where status = 'confirmed';
drop index public.checkins_user_date_confirmed_idx;

-- -----------------------------------------------------------------------------
-- 2. Per day: personal water state + the user's classes IN THE ACADEMY.
-- -----------------------------------------------------------------------------
drop function private.discipline_days(uuid, date, date);
create function private.discipline_days(p_user uuid, p_academy_id uuid, p_from date, p_to date)
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
    where c.user_id = p_user and c.academy_id = p_academy_id and c.class_date between p_from and p_to
    group by 1
  )
  select d.day,
    private.water_day_state(coalesce(w.total, 0), t.goal, t.is_limit),
    coalesce(c.confirmed, 0),
    coalesce(c.pending, 0)
  from days d
  left join water w on w.day = d.day
  left join classes c on c.day = d.day
  -- Water is personal: the user's goal, not tied to this academy.
  cross join lateral private.ranking_water_target(p_user, null, d.day) t
  order by d.day;
$$;
revoke all on function private.discipline_days(uuid, uuid, date, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Recompute and store the streak of a user in an academy.
-- -----------------------------------------------------------------------------
drop function private.refresh_discipline(uuid, date);
create function private.refresh_discipline(
  p_user uuid,
  p_academy_id uuid,
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
  -- One refresh per user and academy at a time: lock the row.
  insert into public.discipline_streaks (user_id, academy_id, week_start) values (p_user, p_academy_id, v_week)
  on conflict (user_id, academy_id) do nothing;
  perform 1 from public.discipline_streaks where user_id = p_user and academy_id = p_academy_id for update;

  select min(c.class_date) into v_first
  from public.checkins c
  where c.user_id = p_user and c.academy_id = p_academy_id and c.status = 'confirmed' and c.class_date <= p_today;

  delete from public.discipline_weeks where user_id = p_user and academy_id = p_academy_id;

  if v_first is not null then
    for v_w in
      select date_trunc('week', d.day)::date as ws,
        count(*) filter (where d.water = 'done')::integer as water_days,
        sum(d.confirmed)::integer as classes
      from private.discipline_days(p_user, p_academy_id, date_trunc('week', v_first)::date, v_week + 6) d
      group by 1
      order by 1
    loop
      -- Water every day from the week of 2026-11-09; 5 of 7 before it.
      v_done := v_w.classes >= 1
        and v_w.water_days >= (case when v_w.ws >= date '2026-11-09' then 7 else 5 end);
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
        insert into public.discipline_weeks (user_id, academy_id, week_start, state, water_days, confirmed_classes)
        values (p_user, p_academy_id, v_w.ws, v_state, v_w.water_days, v_w.classes);
      end if;
    end loop;
  end if;

  update public.discipline_streaks set
    current_weeks = v_current,
    record_weeks = v_record,
    freezes = v_freezes,
    week_start = v_week,
    week_done = v_week_done,
    updated_at = now()
  where user_id = p_user and academy_id = p_academy_id;
end $$;
revoke all on function private.refresh_discipline(uuid, uuid, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Daily job: every active student membership, one transaction each.
--    NOT security definer and no `set search_path`: Postgres forbids COMMIT in
--    a procedure with either (it failed every night with "invalid transaction
--    termination" since 20261110050200). pg_cron runs it as postgres, every
--    name is schema-qualified and clients have no execute grant.
-- -----------------------------------------------------------------------------
drop procedure private.refresh_all_discipline();
create procedure private.refresh_all_discipline()
language plpgsql
as $$
declare v_m record;
begin
  for v_m in
    select m.user_id, m.academy_id from public.memberships m
    where m.role = 'student' and m.status = 'active'
    order by m.user_id, m.academy_id
  loop
    perform private.refresh_discipline(v_m.user_id, v_m.academy_id);
    commit;
  end loop;
end $$;
revoke all on procedure private.refresh_all_discipline() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Read: the caller's Disciplina in one academy where they are an active student.
-- -----------------------------------------------------------------------------
drop function public.my_discipline();
create function public.my_discipline(p_academy_id uuid)
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
  if not exists (
    select 1 from public.memberships m
    where m.user_id = v_uid and m.academy_id = p_academy_id and m.role = 'student' and m.status = 'active'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Recompute at most every 5 seconds (a client calling it in a loop reads).
  if not exists (
    select 1 from public.discipline_streaks s
    where s.user_id = v_uid and s.academy_id = p_academy_id
      and s.week_start = v_week and s.updated_at > now() - interval '5 seconds'
  ) then
    perform private.refresh_discipline(v_uid, p_academy_id, v_today);
  end if;
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
        from private.discipline_days(v_uid, p_academy_id, v_week, v_week + 6) d
      ),
      'weeks', coalesce((
        select jsonb_agg(jsonb_build_object('week_start', w.week_start, 'state', w.state) order by w.week_start)
        from (
          select dw.week_start, dw.state from public.discipline_weeks dw
          where dw.user_id = v_uid and dw.academy_id = p_academy_id
          order by dw.week_start desc limit 12
        ) w
      ), '[]'::jsonb)
    )
    from public.discipline_streaks s where s.user_id = v_uid and s.academy_id = p_academy_id
  );
end $$;
revoke all on function public.my_discipline(uuid) from public, anon;
grant execute on function public.my_discipline(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Ranking of an academy: only ITS frozen weeks leave the count.
-- -----------------------------------------------------------------------------
do $$
declare v_def text := pg_get_functiondef('private.rebuild_rankings(uuid)'::regprocedure);
begin
  v_def := replace(v_def,
    'where dw.user_id=v_fact.user_id and dw.state=''frozen''',
    'where dw.user_id=v_fact.user_id and dw.academy_id=v_mod.academy_id and dw.state=''frozen''');
  if v_def not like '%dw.academy_id=v_mod.academy_id%' then
    raise exception 'rebuild_rankings: frozen weeks filter not found';
  end if;
  execute v_def;
end $$;
revoke all on function private.rebuild_rankings(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Rebuild every streak now (the tables were emptied above), so the next
--    ranking already has each academy's frozen weeks.
-- -----------------------------------------------------------------------------
select private.refresh_discipline(m.user_id, m.academy_id)
from public.memberships m
where m.role = 'student' and m.status = 'active';
