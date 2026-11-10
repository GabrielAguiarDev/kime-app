-- Disciplina: cheaper, shorter-locked refreshes (review of 20261110050000).
--
--  - refresh_discipline locks the user's discipline_streaks ROW (not an
--    advisory lock: a batch in one transaction kept one advisory lock per
--    user until commit, which can exhaust the shared lock table and blocks
--    my_discipline for the whole job).
--  - The daily job is a procedure that commits after each user (active
--    students only, in user order), so each lock lasts one user.
--  - rebuild_rankings no longer refreshes inside its own transaction: the
--    discipline job runs at 03:05 UTC, the ranking at 03:10 UTC.
--  - my_discipline only recomputes when the stored values are older than
--    5 seconds (or from another week): a client calling it in a loop reads.

create or replace function private.refresh_discipline(
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
  -- One refresh per user at a time: lock the user's row.
  insert into public.discipline_streaks (user_id, week_start) values (p_user, v_week)
  on conflict (user_id) do nothing;
  perform 1 from public.discipline_streaks where user_id = p_user for update;

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

  update public.discipline_streaks set
    current_weeks = v_current,
    record_weeks = v_record,
    freezes = v_freezes,
    week_start = v_week,
    week_done = v_week_done,
    updated_at = now()
  where user_id = p_user;
end $$;
revoke all on function private.refresh_discipline(uuid, date) from public, anon, authenticated;

-- Daily job: one transaction per user.
select cron.unschedule('kimi-daily-discipline');
drop function private.refresh_all_discipline();
create procedure private.refresh_all_discipline()
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  for v_user in
    select distinct m.user_id from public.memberships m
    where m.role = 'student' and m.status = 'active'
    order by m.user_id
  loop
    perform private.refresh_discipline(v_user);
    commit;
  end loop;
end $$;
revoke all on procedure private.refresh_all_discipline() from public, anon, authenticated;
select cron.schedule('kimi-daily-discipline', '5 3 * * *', 'call private.refresh_all_discipline()');

-- Ranking: reads the stored weeks (refreshed by the job five minutes before).
do $$
declare v_def text := pg_get_functiondef('private.rebuild_rankings(uuid)'::regprocedure);
begin
  v_def := replace(v_def,
    E' -- Disciplina first: its frozen weeks leave the ranking.\n perform private.refresh_discipline(m.user_id)\n from (select distinct mb.user_id from public.memberships mb\n       where mb.role=''student'' and mb.status=''active'' and (p_academy_id is null or mb.academy_id=p_academy_id)) m;\n',
    E' -- Frozen Disciplina weeks come from discipline_weeks (job kimi-daily-discipline, 03:05 UTC).\n');
  if v_def not like '%job kimi-daily-discipline%' then raise exception 'rebuild_rankings: refresh block not found'; end if;
  execute v_def;
end $$;
revoke all on function private.rebuild_rankings(uuid) from public, anon, authenticated;

-- Read: recompute at most every 5 seconds per user.
create or replace function public.my_discipline()
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
    select 1 from public.discipline_streaks s
    where s.user_id = v_uid and s.week_start = v_week and s.updated_at > now() - interval '5 seconds'
  ) then
    perform private.refresh_discipline(v_uid, v_today);
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
