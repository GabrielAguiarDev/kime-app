-- Disciplina: one weekly streak (≥1 confirmed class + water on ≥5 days), freezes, RLS.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$ begin
 perform set_config('role', 'authenticated', true);
 perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$ begin
 perform set_config('role', 'postgres', true);
 perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.login(uuid), pg_temp.logout() to public;
create temp table ids(k text primary key, v uuid);
grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k = $1$$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-0000-0000-000000000000','owner@discipline.test','{"full_name":"Owner"}'),
 ('a1000000-0000-0000-0000-000000000001','done@discipline.test','{"full_name":"Done"}'),
 ('a1000000-0000-0000-0000-000000000002','water4@discipline.test','{"full_name":"Water4"}'),
 ('a1000000-0000-0000-0000-000000000003','noclass@discipline.test','{"full_name":"NoClass"}'),
 ('a1000000-0000-0000-0000-000000000004','limit@discipline.test','{"full_name":"Limit"}'),
 ('a1000000-0000-0000-0000-000000000005','freeze@discipline.test','{"full_name":"Freeze"}'),
 ('a1000000-0000-0000-0000-000000000006','cap@discipline.test','{"full_name":"Cap"}'),
 ('a1000000-0000-0000-0000-000000000007','open@discipline.test','{"full_name":"Open"}');
insert into ids values
 ('owner','a1000000-0000-0000-0000-000000000000'),('done','a1000000-0000-0000-0000-000000000001'),
 ('water4','a1000000-0000-0000-0000-000000000002'),('noclass','a1000000-0000-0000-0000-000000000003'),
 ('limit','a1000000-0000-0000-0000-000000000004'),('freeze','a1000000-0000-0000-0000-000000000005'),
 ('cap','a1000000-0000-0000-0000-000000000006'),('open','a1000000-0000-0000-0000-000000000007');

select pg_temp.login(pg_temp.id('owner'));
insert into ids values ('academy', public.create_academy('Discipline tests', array['BJJ']));
select pg_temp.logout();
insert into ids select 'modality', id from public.academy_modalities where academy_id = pg_temp.id('academy') limit 1;
insert into ids values ('schedule', gen_random_uuid());
insert into public.class_schedules(id, academy_id, weekday, start_time, modality_id)
values (pg_temp.id('schedule'), pg_temp.id('academy'), 1, '10:00', pg_temp.id('modality'));

-- Every student: automatic goal of 2000 ml since 2024 (the weeks below are in 2025).
insert into private.water_auto_goal_history(user_id, effective_on, goal_ml)
select v, '2024-01-01', 2000 from ids where k not in ('owner','academy','modality','schedule');

-- A week from its Monday: `p_water` days with the goal met (first days), a
-- class on Monday with `p_status` (null = no class).
create function pg_temp.week(p_user uuid, p_monday date, p_water int, p_status public.checkin_status default 'confirmed')
returns void language plpgsql as $$
begin
  insert into public.water_logs(id, user_id, amount_ml, logged_at)
  select gen_random_uuid(), p_user, 2000, ((p_monday + i)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo'
  from generate_series(0, p_water - 1) i;
  if p_status is not null then
    insert into public.checkins(user_id, academy_id, schedule_id, class_date, status)
    values (p_user, pg_temp.id('academy'), pg_temp.id('schedule'), p_monday, p_status);
  end if;
end $$;
create function pg_temp.streak(p_user uuid) returns text language sql as $$
  select current_weeks || '/' || record_weeks || '/' || freezes || '/' || week_done
  from public.discipline_streaks where user_id = p_user $$;
create function pg_temp.weeks(p_user uuid) returns text[] language sql as $$
  select coalesce(array_agg(state order by week_start), '{}') from public.discipline_weeks where user_id = p_user $$;

-- ---------------------------------------------------------------- done week ---
select pg_temp.week(pg_temp.id('done'), '2025-01-06', 5);
select private.refresh_discipline(pg_temp.id('done'), '2025-01-15');
select is(pg_temp.weeks(pg_temp.id('done')), array['done'], 'one class + water on 5 days: week done');
select is(pg_temp.streak(pg_temp.id('done')), '1/1/0/false', 'streak 1, record 1, no freeze yet, this week still open');
select is((select water_days || '/' || confirmed_classes from public.discipline_weeks where user_id = pg_temp.id('done')), '5/1', 'week keeps its facts');

-- ------------------------------------------------------- 4 water days only ---
select pg_temp.week(pg_temp.id('water4'), '2025-01-06', 5);
select pg_temp.week(pg_temp.id('water4'), '2025-01-13', 4);
select private.refresh_discipline(pg_temp.id('water4'), '2025-01-22');
select is(pg_temp.weeks(pg_temp.id('water4')), array['done','missed'], 'water on 4 days: week not done');
select is(pg_temp.streak(pg_temp.id('water4')), '0/1/0/false', 'missed without freeze: streak back to 0, record kept');

-- ---------------------------------------------------- no confirmed class ---
select pg_temp.week(pg_temp.id('noclass'), '2025-01-06', 5);
select pg_temp.week(pg_temp.id('noclass'), '2025-01-13', 7, null);
select pg_temp.week(pg_temp.id('noclass'), '2025-01-20', 7, 'pending');
select private.refresh_discipline(pg_temp.id('noclass'), '2025-01-29');
select is(pg_temp.weeks(pg_temp.id('noclass')), array['done','missed','missed'], 'water every day without a confirmed class (none, or pending only): not done');

-- ------------------------------------------------- limit day at 95 % ---
insert into public.water_plans(id, athlete_id, academy_id, week_start)
values ('a1000000-0000-0000-0000-0000000000f1', pg_temp.id('limit'), pg_temp.id('academy'), '2025-01-06');
-- Limit of 2000 ml on Friday (dow 5) of that week.
insert into private.water_plan_goal_history(plan_id, weekday, effective_on, target_ml, is_limit)
values ('a1000000-0000-0000-0000-0000000000f1', 5, '2025-01-06', 2000, true);
select pg_temp.week(pg_temp.id('limit'), '2025-01-06', 4);
insert into public.water_logs(id, user_id, amount_ml, logged_at)
values (gen_random_uuid(), pg_temp.id('limit'), 1900, ('2025-01-10 12:00'::timestamp) at time zone 'America/Sao_Paulo');
select is((select water from private.discipline_days(pg_temp.id('limit'), '2025-01-10', '2025-01-10')), 'done', 'limit day at 95 %: done');
select private.refresh_discipline(pg_temp.id('limit'), '2025-01-15');
select is(pg_temp.weeks(pg_temp.id('limit')), array['done'], 'the limit day at 95 % is the 5th water day: week done');
insert into public.water_logs(id, user_id, amount_ml, logged_at)
values (gen_random_uuid(), pg_temp.id('limit'), 200, ('2025-01-10 13:00'::timestamp) at time zone 'America/Sao_Paulo');
select is((select water from private.discipline_days(pg_temp.id('limit'), '2025-01-10', '2025-01-10')), 'over', 'limit day above 100 %: not done');
select private.refresh_discipline(pg_temp.id('limit'), '2025-01-15');
select is(pg_temp.weeks(pg_temp.id('limit')), array['missed'], 'over the limit: only 4 water days, week not done');

-- ---------------------------------- freeze on the 4th week, automatic use ---
select pg_temp.week(pg_temp.id('freeze'), d::date, 5) from generate_series('2025-01-06'::date, '2025-01-20'::date, interval '7 days') d;
select private.refresh_discipline(pg_temp.id('freeze'), '2025-01-29');
select is(pg_temp.streak(pg_temp.id('freeze')), '3/3/0/false', '3 weeks done: no freeze yet');
select pg_temp.week(pg_temp.id('freeze'), '2025-01-27', 5);
select private.refresh_discipline(pg_temp.id('freeze'), '2025-02-05');
select is(pg_temp.streak(pg_temp.id('freeze')), '4/4/1/false', '4th week done: one freeze earned');
-- Week of 02-03 missed (no class, no water).
select private.refresh_discipline(pg_temp.id('freeze'), '2025-02-12');
select is(pg_temp.weeks(pg_temp.id('freeze')), array['done','done','done','done','frozen'], 'missed week with a freeze: frozen automatically');
select is(pg_temp.streak(pg_temp.id('freeze')), '4/4/0/false', 'the streak keeps its value and the freeze is spent');
-- Week of 02-10 also missed: no freeze left.
select private.refresh_discipline(pg_temp.id('freeze'), '2025-02-19');
select is(pg_temp.weeks(pg_temp.id('freeze')), array['done','done','done','done','frozen','missed'], 'second missed week without freeze: missed');
select is(pg_temp.streak(pg_temp.id('freeze')), '0/4/0/false', 'streak back to 0, record kept');

-- ------------------------------------------------------------- cap of 2 ---
select pg_temp.week(pg_temp.id('cap'), d::date, 5) from generate_series('2025-01-06'::date, '2025-03-24'::date, interval '7 days') d;
select private.refresh_discipline(pg_temp.id('cap'), '2025-04-02');
select is(pg_temp.streak(pg_temp.id('cap')), '12/12/2/false', '12 weeks in a row: still at most 2 freezes');

-- ------------------------------------------------------ current week open ---
select pg_temp.week(pg_temp.id('open'), '2025-01-06', 5);
-- This week (01-13): water on 5 days, the class still pending.
select pg_temp.week(pg_temp.id('open'), '2025-01-13', 5, 'pending');
select private.refresh_discipline(pg_temp.id('open'), '2025-01-18');
select is(pg_temp.weeks(pg_temp.id('open')), array['done'], 'the current week is not stored while open');
select is(pg_temp.streak(pg_temp.id('open')), '1/1/0/false', 'pending class: the open week neither counts nor breaks');
update public.checkins set status = 'confirmed' where user_id = pg_temp.id('open') and class_date = '2025-01-13';
select private.refresh_discipline(pg_temp.id('open'), '2025-01-18');
select is(pg_temp.streak(pg_temp.id('open')), '2/2/0/true', 'confirmed later: the open week turns done and counts');
-- Next Monday the week closes as done.
select private.refresh_discipline(pg_temp.id('open'), '2025-01-20');
select is(pg_temp.weeks(pg_temp.id('open')), array['done','done'], 'closed on Monday as done');
select is(pg_temp.streak(pg_temp.id('open')), '2/2/0/false', 'new week open, streak kept');

-- -------------------------------------------------------------- access ---
select pg_temp.login(pg_temp.id('done'));
select is((select count(*)::int from public.discipline_weeks), 1, 'reads only own weeks');
select is((select count(*)::int from public.discipline_streaks), 1, 'reads only own streak');
select throws_ok($$insert into public.discipline_weeks(user_id, week_start, state, water_days, confirmed_classes) values (pg_temp.id('done'), '2025-02-03', 'done', 7, 1)$$, '42501', null, 'client cannot write weeks');
select throws_ok($$update public.discipline_streaks set freezes = 2$$, '42501', null, 'client cannot change the streak');
select throws_ok($$select private.refresh_discipline(pg_temp.id('done'))$$, '42501', null, 'client cannot call the refresh');
select ok((public.my_discipline()) ?& array['current','record','freezes','week_done','days','weeks'], 'my_discipline returns the screen data');
select is(jsonb_array_length(public.my_discipline() -> 'days'), 7, 'this week day by day');
select pg_temp.logout();
set local role anon;
select throws_ok($$select public.my_discipline()$$, '42501', null, 'anon cannot read a streak');
set local role postgres;

select ok(exists(select 1 from cron.job where jobname = 'kimi-daily-discipline' and command = 'call private.refresh_all_discipline()'), 'daily job scheduled (one transaction per user)');

-- ------------------------------------- ranking: a frozen week leaves the count ---
-- Real calendar: 4 done weeks, then last week missed (water every day, no
-- class) → frozen. Its 7 days leave presence and water.
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-0000-0000-000000000008','ranked@discipline.test','{"full_name":"Ranked"}');
insert into ids values ('ranked','a1000000-0000-0000-0000-000000000008'), ('membership', 'a1000000-0000-0000-0000-0000000000e1');
create temp table cal as select date_trunc('week', private.academy_local_date(pg_temp.id('academy')))::date as week,
  private.academy_local_date(pg_temp.id('academy')) as today;
insert into private.water_auto_goal_history(user_id, effective_on, goal_ml) values (pg_temp.id('ranked'), '2024-01-01', 2000);
insert into public.memberships(id,user_id,academy_id,role,status,created_at,decided_at)
values (pg_temp.id('membership'), pg_temp.id('ranked'), pg_temp.id('academy'), 'student', 'active', now()-interval '80 days', now()-interval '70 days');
update private.membership_active_periods set starts_at = now()-interval '70 days' where membership_id = pg_temp.id('membership');
insert into public.student_modality_enrollments(membership_id,modality_id,status) values (pg_temp.id('membership'), pg_temp.id('modality'), 'active');
insert into private.modality_active_periods(enrollment_id,starts_at)
select id, now()-interval '70 days' from public.student_modality_enrollments where membership_id = pg_temp.id('membership');
update public.class_schedules set created_at = now()-interval '80 days' where id = pg_temp.id('schedule');
select pg_temp.week(pg_temp.id('ranked'), (select week from cal) - w, 5) from unnest(array[35, 28, 21, 14]) w;
select pg_temp.week(pg_temp.id('ranked'), (select week from cal) - 7, 7, null);
select private.refresh_discipline(pg_temp.id('ranked'));
select is((select state from public.discipline_weeks where user_id = pg_temp.id('ranked') and week_start = (select week from cal) - 7), 'frozen', 'last week frozen');
select private.rebuild_rankings(pg_temp.id('academy'));
select is((select protected_days from public.ranking_details where user_id = pg_temp.id('ranked')), 7, 'the 7 days of the frozen week are protected');
select is((select eligible_days from public.ranking_details where user_id = pg_temp.id('ranked')), 28, 'qualification still counts every eligible day');
select is((select eligible_hydration_days from public.ranking_details where user_id = pg_temp.id('ranked')), 21, 'water: the frozen week leaves the denominator');
select is((select hydration_goals_achieved from public.ranking_details where user_id = pg_temp.id('ranked')),
  (select count(distinct (l.logged_at at time zone 'America/Sao_Paulo')::date)::int from public.water_logs l, cal
   where l.user_id = pg_temp.id('ranked')
     and (l.logged_at at time zone 'America/Sao_Paulo')::date between cal.today - 28 and cal.today - 1
     and (l.logged_at at time zone 'America/Sao_Paulo')::date not between cal.week - 7 and cal.week - 1),
  'water: the 7 days met in the frozen week do not count either');
select is((select scheduled_classes from public.ranking_details where user_id = pg_temp.id('ranked')),
  (select count(*)::int from cal, generate_series(cal.today - 28, cal.today - 1, interval '1 day') d
   where extract(isodow from d) = 1 and d::date <> cal.week - 7),
  'presence: the Monday class of the frozen week leaves the grid');

select * from finish();
rollback;
