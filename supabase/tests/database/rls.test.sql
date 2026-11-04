-- RLS / RPC tests. Run with: supabase test db
-- Two academies, each with one professor and two students; one student of
-- academy 1 is a competitor.
begin;
-- Hosted runs log in with a CLI role: act as the schema owner, like migrations do.
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- The hosted test runner may install pgTAP in its own schema: find it.
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(185);

-- ---------------------------------------------------------------- helpers ---
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

-- The base migration revokes PUBLIC execute on new functions by default.
grant execute on function pg_temp.login(uuid), pg_temp.logout(), pg_temp.as_anon() to public;

create temp table t_ids (key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated, anon;
create function pg_temp.id(p_key text) returns uuid language sql as $$
  select val from t_ids where key = p_key
$$;
grant execute on function pg_temp.id(text) to public;

-- ------------------------------------------------------------------ users ---
-- P1 professor of A1; S1 competitor of A1; T1 student of A1
-- P2 professor of A2; S2, T2 students of A2; X has no academy.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'p1@kimi.test', '{"full_name":"Prof Um"}'),
  ('00000000-0000-0000-0000-0000000000b1', 's1@kimi.test', '{"full_name":"Comp Um"}'),
  ('00000000-0000-0000-0000-0000000000c1', 't1@kimi.test', '{"name":"Aluno Um"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'p2@kimi.test', '{"full_name":"Prof Dois"}'),
  ('00000000-0000-0000-0000-0000000000b2', 's2@kimi.test', '{"full_name":"Aluno Dois"}'),
  ('00000000-0000-0000-0000-0000000000c2', 't2@kimi.test', '{"full_name":"Aluna Dois"}'),
  ('00000000-0000-0000-0000-0000000000ff', 'x@kimi.test', '{}');
insert into t_ids values
  ('p1', '00000000-0000-0000-0000-0000000000a1'), ('s1', '00000000-0000-0000-0000-0000000000b1'),
  ('t1', '00000000-0000-0000-0000-0000000000c1'), ('p2', '00000000-0000-0000-0000-0000000000a2'),
  ('s2', '00000000-0000-0000-0000-0000000000b2'), ('t2', '00000000-0000-0000-0000-0000000000c2'),
  ('x',  '00000000-0000-0000-0000-0000000000ff');

-- ------------------------------------------------------------- privileges ---
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  0, 'anon has no table privilege in public');
select is(
  (select array_agg(routine_name::text) from information_schema.routine_privileges
   where grantee in ('anon', 'PUBLIC') and routine_schema in ('public', 'private')),
  array['lookup_invite_code'], 'the only function anon/PUBLIC can execute is lookup_invite_code');
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS enabled on every public table');
select is(
  (select full_name from public.profiles where id = pg_temp.id('t1')),
  'Aluno Um', 'profile created on sign-up (name fallback)');
select is(
  (select timezone from public.profiles where id = pg_temp.id('t1')),
  'America/Sao_Paulo', 'profile timezone default');

-- ---------------------------------------------------------- academy setup ---
-- The project exposes nothing automatically: authenticated needs explicit
-- EXECUTE on the RPC and the table grants the app reads right after creating.
select ok(has_function_privilege('authenticated', 'public.create_academy(text, text[])', 'execute'),
  'authenticated can execute create_academy');
select ok(not has_function_privilege('anon', 'public.create_academy(text, text[])', 'execute'),
  'anon cannot execute create_academy');
select ok(has_table_privilege('authenticated', 'public.academies', 'select')
  and has_table_privilege('authenticated', 'public.memberships', 'select')
  and has_table_privilege('authenticated', 'public.professor_codes', 'select'),
  'authenticated can read academies, memberships and professor codes');

select pg_temp.login(pg_temp.id('p1'));
insert into t_ids values ('a1', public.create_academy('  Kimi Jiu-Jitsu  ', array[' Jiu-Jitsu ', 'Muay Thai', 'jiu-jitsu', '']));
select pg_temp.login(pg_temp.id('p2'));
insert into t_ids values ('a2', public.create_academy('Outra Academia', array['Judô']));

select pg_temp.login(pg_temp.id('p1'));
select is((select name from public.academies where id = pg_temp.id('a1')),
  'Kimi Jiu-Jitsu', 'creator sees academy, name trimmed');
select matches((select invite_code from public.academies where id = pg_temp.id('a1')),
  '^[A-HJKMNP-Z2-9]{8}$', 'student code generated: 8 chars, no 0/O/1/I/L');
select is((select role::text || '/' || status::text from public.memberships
           where academy_id = pg_temp.id('a1')),
  'owner/active', 'creator is the active owner');
select is((select count(*)::int from public.professor_codes where academy_id = pg_temp.id('a1')),
  0, 'a new academy has no professor code');
select is(
  (select m.role::text || '/' || m.status::text || '/' || a.name
   from public.memberships m join public.academies a on a.id = m.academy_id
   where m.user_id = pg_temp.id('p1')),
  'owner/active/Kimi Jiu-Jitsu', 'creator reads own membership with academy name (app listMine)');
select is((select array_agg(name order by position) from public.academy_modalities where academy_id = pg_temp.id('a1')),
  array['Jiu-Jitsu', 'Muay Thai'], 'modalities trimmed, deduplicated case-insensitively, order kept');
select throws_ok($$ select public.create_academy('Sem Modalidade', array['  ']) $$, '22023', 'invalid_modalities',
  'an academy needs at least one modality');
select lives_ok($$ insert into public.academy_modalities (academy_id, name, position)
  values (pg_temp.id('a1'), 'No-Gi', 2) $$, 'professor adds a modality');
select throws_ok($$ insert into public.academy_modalities (academy_id, name, position)
  values (pg_temp.id('a1'), 'no-gi', 3) $$, '23505', null, 'modality names are unique per academy');
select throws_ok($$ select public.create_academy(' a ', array['Judô']) $$, '22023', 'invalid_academy_name',
  'academy name is validated');

-- Students join with the code (pending), the professor approves.
select pg_temp.logout();
create temp table t_codes on commit drop as
  select id, invite_code from public.academies;
grant select on t_codes to authenticated, anon;

select pg_temp.login(pg_temp.id('s1'));
select lives_ok(
  $$ select public.join_with_code(' ' || lower((select invite_code from t_codes where id = pg_temp.id('a1'))) || ' ') $$,
  'join_with_code accepts the code in any case, with spaces');
select is((select status::text || '/' || role::text from public.memberships
           where user_id = pg_temp.id('s1')),
  'pending/student', 'joining by code lands as pending student');
select is((select count(*)::int from public.academies), 1, 'pending user sees the academy name');
select is((select count(*)::int from public.class_schedules), 0, 'pending user sees no academy data');
select throws_ok($$ select public.join_with_code('ZZZZZZZZ') $$, 'P0002', 'invite_invalid',
  'unknown code is rejected');

select pg_temp.login(pg_temp.id('t1'));
select public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')));
select pg_temp.login(pg_temp.id('s2'));
select public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a2')));
select pg_temp.login(pg_temp.id('t2'));
select public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a2')));

-- A pending student cannot approve themselves.
select pg_temp.login(pg_temp.id('s1'));
update public.memberships set status = 'active' where user_id = pg_temp.id('s1');
select is((select status::text from public.memberships where user_id = pg_temp.id('s1')),
  'pending', 'student cannot approve own membership');

select pg_temp.login(pg_temp.id('p1'));
select is((select count(*)::int from public.list_pending_requests(pg_temp.id('a1'))),
  2, 'professor lists pending requests of own academy');
select is((select email from public.list_pending_requests(pg_temp.id('a1')) where user_id = pg_temp.id('s1')),
  's1@kimi.test', 'pending request shows e-mail');
select throws_ok($$ select * from public.list_pending_requests(pg_temp.id('a2')) $$,
  '42501', 'forbidden', 'professor cannot list requests of another academy');
update public.memberships set status = 'active'
  where academy_id = pg_temp.id('a1') and status = 'pending';
select is((select decided_by from public.memberships where user_id = pg_temp.id('s1')),
  pg_temp.id('p1'), 'decision stamped with the professor');
update public.memberships set is_competitor = true where user_id = pg_temp.id('s1');
select is((select is_competitor from public.memberships where user_id = pg_temp.id('s1')),
  true, 'professor promotes student to competitor');
select throws_ok(
  $$ update public.memberships set status = 'pending' where user_id = pg_temp.id('s1') $$,
  '22023', 'membership_not_pending', 'decision cannot be reverted');

select pg_temp.login(pg_temp.id('p2'));
update public.memberships set status = 'active'
  where academy_id = pg_temp.id('a2') and status = 'pending';
-- Professor 2 cannot touch academy 1 memberships.
update public.memberships set belt = 'black' where user_id = pg_temp.id('t1');

select pg_temp.logout();
insert into t_ids select 't1_membership', id from public.memberships where user_id = pg_temp.id('t1');
select is((select belt from public.memberships where user_id = pg_temp.id('t1')),
  null, 'professor of another academy cannot edit memberships');

-- Students cannot change role, competitor flag or belt.
select pg_temp.login(pg_temp.id('t1'));
update public.memberships set is_competitor = true, belt = 'black' where user_id = pg_temp.id('t1');
select throws_ok($$ update public.memberships set role = 'professor' where user_id = pg_temp.id('t1') $$,
  '42501', null, 'role has no column grant: nobody changes it through the API');
select pg_temp.logout();
select is((select role::text || '/' || is_competitor::text || '/' || coalesce(belt, '-')
           from public.memberships where user_id = pg_temp.id('t1')),
  'student/false/-', 'student cannot change role, competitor flag or belt');
select pg_temp.login(pg_temp.id('t1'));
select throws_ok(
  $$ insert into public.memberships (user_id, academy_id, role, status)
     values (pg_temp.id('t1'), pg_temp.id('a2'), 'professor', 'active') $$,
  '42501', null, 'nobody inserts memberships directly');

-- Owner protection.
select pg_temp.login(pg_temp.id('p1'));
select throws_ok(
  $$ update public.memberships set role = 'student' where user_id = pg_temp.id('p1') $$,
  '42501', null, 'owner cannot be demoted');
delete from public.memberships where user_id = pg_temp.id('p1');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('p1')),
  1, 'owner cannot be removed');

-- --------------------------------------------------------------- classes ---
select pg_temp.logout();
-- "Today" is the academy's local date. Pago Pago (UTC-11) and Kiritimati
-- (UTC+14) are 25h apart, so their dates always differ: deterministic tests.
update public.academies set timezone = 'Pacific/Pago_Pago' where id = pg_temp.id('a1');
create temp table t_dates on commit drop as select
  (now() at time zone 'Pacific/Pago_Pago')::date as today,
  (now() at time zone 'Pacific/Kiritimati')::date as elsewhere;
grant select on t_dates to authenticated;
create function pg_temp.today() returns date language sql as $$ select today from t_dates $$;
create function pg_temp.elsewhere() returns date language sql as $$ select elsewhere from t_dates $$;
grant execute on function pg_temp.today(), pg_temp.elsewhere() to public;

insert into public.class_schedules (id, academy_id, weekday, start_time, modality) values
  ('00000000-0000-0000-0001-000000000001', pg_temp.id('a1'), extract(dow from pg_temp.today()), '19:00', 'Jiu-Jitsu'),
  ('00000000-0000-0000-0001-000000000002', pg_temp.id('a1'), extract(dow from pg_temp.elsewhere()), '19:00', 'No-Gi'),
  ('00000000-0000-0000-0002-000000000001', pg_temp.id('a2'), extract(dow from pg_temp.today()), '19:00', 'Jiu-Jitsu');
insert into public.belt_goals (academy_id, belt, position, classes_required) values
  (pg_temp.id('a1'), 'white', 0, 1), (pg_temp.id('a2'), 'white', 0, 1);

select is((select private.academy_local_date(pg_temp.id('a1'))), pg_temp.today(),
  'academy local date follows academies.timezone');
select throws_ok(
  $$ update public.academies set timezone = 'Marte/Olimpo' where id = pg_temp.id('a1') $$,
  '23514', null, 'invalid timezone is rejected');

select pg_temp.login(pg_temp.id('t1'));
select is((select count(*)::int from public.class_schedules), 2, 'student reads only own academy schedules');
select is((select count(*)::int from public.belt_goals), 1, 'student reads only own academy belt goals');
select throws_ok(
  $$ insert into public.class_schedules (academy_id, weekday, start_time, modality)
     values (pg_temp.id('a1'), 1, '07:00', 'X') $$,
  '42501', null, 'student cannot create schedules');

select lives_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('t1'), pg_temp.id('a1'), '00000000-0000-0000-0001-000000000001', pg_temp.today()) $$,
  'student checks in to today''s class of own academy');
select is((select status::text from public.checkins where user_id = pg_temp.id('t1')),
  'pending', 'check-in starts pending');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('t1'), pg_temp.id('a1'), '00000000-0000-0000-0001-000000000002', pg_temp.elsewhere()) $$,
  '42501', null, 'check-in only on the academy''s local date (not "today" in another timezone)');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('t1'), pg_temp.id('a1'), '00000000-0000-0000-0001-000000000002', pg_temp.today()) $$,
  '42501', null, 'check-in date must match the class weekday');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('t1'), pg_temp.id('a2'), '00000000-0000-0000-0002-000000000001', pg_temp.today()) $$,
  '42501', null, 'student cannot check in to another academy');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('s1'), pg_temp.id('a1'), '00000000-0000-0000-0001-000000000001', pg_temp.today()) $$,
  '42501', null, 'student cannot check in someone else');

select pg_temp.login(pg_temp.id('s1'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date, status)
     values (pg_temp.id('s1'), pg_temp.id('a1'), '00000000-0000-0000-0001-000000000001', pg_temp.today(), 'confirmed') $$,
  '42501', null, 'student cannot create a confirmed check-in');

select pg_temp.login(pg_temp.id('t1'));
update public.checkins set status = 'confirmed' where user_id = pg_temp.id('t1');
select is((select status::text from public.checkins where user_id = pg_temp.id('t1')),
  'pending', 'student cannot confirm own check-in');

select pg_temp.login(pg_temp.id('s1'));
select is((select count(*)::int from public.checkins), 0, 'student does not see others'' check-ins');

select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.checkins), 0, 'other academy professor sees no check-ins');
update public.checkins set status = 'confirmed' where user_id = pg_temp.id('t1');

select pg_temp.login(pg_temp.id('p1'));
update public.checkins set status = 'confirmed' where user_id = pg_temp.id('t1');
select is((select status::text || '/' || reviewed_by::text from public.checkins where user_id = pg_temp.id('t1')),
  'confirmed/' || pg_temp.id('p1')::text, 'professor confirms check-in, reviewer stamped');

select pg_temp.login(pg_temp.id('t1'));
delete from public.checkins where user_id = pg_temp.id('t1');
select is((select count(*)::int from public.checkins), 1, 'student cannot delete a decided check-in');

-- ----------------------------------------------------------------- water ---
select pg_temp.login(pg_temp.id('s1'));
insert into public.water_logs (id, user_id, amount_ml, logged_at)
  values ('00000000-0000-0000-00aa-000000000001', pg_temp.id('s1'), 500, now());
-- Re-sending the same offline log is idempotent.
insert into public.water_logs (id, user_id, amount_ml, logged_at)
  values ('00000000-0000-0000-00aa-000000000001', pg_temp.id('s1'), 500, now())
  on conflict (id) do update set amount_ml = excluded.amount_ml, logged_at = excluded.logged_at;
select is((select count(*)::int from public.water_logs), 1, 'water log upsert is idempotent');

select pg_temp.login(pg_temp.id('t1'));
insert into public.water_logs (id, user_id, amount_ml, logged_at)
  values ('00000000-0000-0000-00aa-000000000002', pg_temp.id('t1'), 300, now());
select throws_ok(
  $$ insert into public.water_logs (id, user_id, amount_ml, logged_at)
     values (gen_random_uuid(), pg_temp.id('s1'), 300, now()) $$,
  '42501', null, 'cannot log water for someone else');
select throws_ok(
  $$ insert into public.water_logs (id, user_id, amount_ml, logged_at)
     values ('00000000-0000-0000-00aa-000000000001', pg_temp.id('t1'), 1, now())
     on conflict (id) do update set amount_ml = excluded.amount_ml $$,
  '42501', null, 'upsert cannot hijack another user''s log id');
select is((select count(*)::int from public.water_logs), 1, 'student reads only own water logs');

select pg_temp.login(pg_temp.id('p1'));
select is((select array_agg(user_id) from public.water_logs),
  array[pg_temp.id('s1')], 'professor sees water logs of competitors only');
select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.water_logs), 0, 'professor sees no water logs of another academy');

-- Plans: professor 1 writes for the competitor; not for a regular student.
select pg_temp.login(pg_temp.id('p1'));
insert into public.water_plans (id, athlete_id, academy_id, week_start)
  values ('00000000-0000-0000-00bb-000000000001', pg_temp.id('s1'), pg_temp.id('a1'), '2026-11-02');
insert into public.water_plan_days (plan_id, weekday, target_ml)
  values ('00000000-0000-0000-00bb-000000000001', 1, 3500);
insert into public.diet_plans (id, athlete_id, academy_id, plan_date)
  values ('00000000-0000-0000-00cc-000000000001', pg_temp.id('s1'), pg_temp.id('a1'), '2026-11-04');
insert into public.diet_plan_meals (plan_id, position, name)
  values ('00000000-0000-0000-00cc-000000000001', 0, 'Café da manhã');
select throws_ok(
  $$ insert into public.water_plans (athlete_id, academy_id, week_start)
     values (pg_temp.id('t1'), pg_temp.id('a1'), '2026-11-02') $$,
  '42501', null, 'no plan for a non-competitor');
select pg_temp.login(pg_temp.id('p2'));
select throws_ok(
  $$ insert into public.water_plans (athlete_id, academy_id, week_start)
     values (pg_temp.id('s1'), pg_temp.id('a1'), '2026-11-09') $$,
  '42501', null, 'professor cannot plan for another academy');
select is((select count(*)::int from public.water_plans), 0, 'other professor sees no water plans');

select pg_temp.login(pg_temp.id('s1'));
select is((select count(*)::int from public.water_plan_days), 1, 'competitor reads own water plan');
select is((select count(*)::int from public.diet_plan_meals), 1, 'competitor reads own diet plan');

select pg_temp.login(pg_temp.id('t1'));
select is((select count(*)::int from public.water_plans) + (select count(*)::int from public.water_plan_days)
        + (select count(*)::int from public.diet_plans) + (select count(*)::int from public.diet_plan_meals),
  0, 'student sees no water or diet plan');

-- ---------------------------------------------------------------- weight ---
select pg_temp.login(pg_temp.id('s1'));
select lives_ok(
  $$ insert into public.weight_logs (athlete_id, logged_on, weight_kg)
     values (pg_temp.id('s1'), '2026-11-04', 76.4) $$,
  'competitor logs weight');
select pg_temp.login(pg_temp.id('t1'));
select throws_ok(
  $$ insert into public.weight_logs (athlete_id, logged_on, weight_kg)
     values (pg_temp.id('t1'), '2026-11-04', 70) $$,
  '42501', null, 'non-competitor cannot log weight');
select pg_temp.login(pg_temp.id('p1'));
select is((select count(*)::int from public.weight_logs), 1, 'professor reads competitor weight');
select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.weight_logs), 0, 'other professor reads no weight');

-- ---------------------------------------------------------- championships ---
select pg_temp.login(pg_temp.id('p1'));
insert into public.championships (id, academy_id, name, event_date)
  values ('00000000-0000-0000-00dd-000000000001', pg_temp.id('a1'), 'Open Kimi', '2026-12-01'),
         ('00000000-0000-0000-00dd-000000000002', pg_temp.id('a1'), 'Outro Open', '2026-12-08');
insert into public.championship_entries (championship_id, academy_id, athlete_id)
  values ('00000000-0000-0000-00dd-000000000001', pg_temp.id('a1'), pg_temp.id('s1'));
select throws_ok(
  $$ insert into public.championship_entries (championship_id, academy_id, athlete_id)
     values ('00000000-0000-0000-00dd-000000000002', pg_temp.id('a1'), pg_temp.id('t1')) $$,
  '42501', null, 'only competitors can be entered');

select pg_temp.login(pg_temp.id('s1'));
select is((select array_agg(name) from public.championships),
  array['Open Kimi'], 'competitor reads only championships they are entered in');
select pg_temp.login(pg_temp.id('t1'));
select is((select count(*)::int from public.championships), 0, 'student reads no championships');

-- ----------------------------------------------------------- belt history ---
select pg_temp.login(pg_temp.id('p1'));
select throws_ok(
  $$ update public.memberships set belt = 'black' where user_id = pg_temp.id('t1') $$,
  '42501', 'belt_via_history', 'belt is never set directly on memberships');
select lives_ok(
  $$ insert into public.belt_history (membership_id, belt)
     select id, ' blue ' from public.memberships where user_id = pg_temp.id('t1') $$,
  'professor awards a belt');
select is((select belt from public.memberships where user_id = pg_temp.id('t1')),
  'blue', 'awarding a belt updates memberships.belt');
select is((select awarded_by from public.belt_history), pg_temp.id('p1'),
  'award is stamped with the professor');

select pg_temp.login(pg_temp.id('t1'));
select is((select count(*)::int from public.belt_history), 1, 'student reads own belt history');
select throws_ok(
  $$ insert into public.belt_history (membership_id, belt)
     select id, 'black' from public.memberships where user_id = pg_temp.id('t1') $$,
  '42501', null, 'student cannot award a belt');

select pg_temp.login(pg_temp.id('s1'));
select is((select count(*)::int from public.belt_history), 0, 'student does not read others'' belt history');

select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.belt_history), 0, 'other academy professor reads no belt history');
select throws_ok(
  $$ insert into public.belt_history (membership_id, belt)
     values ((select val from t_ids where key = 't1_membership'), 'black') $$,
  '42501', null, 'other academy professor cannot award a belt');

-- ------------------------------------------------------------ class stats ---
select pg_temp.login(pg_temp.id('t1'));
select is((select public.academy_today(pg_temp.id('a1'))), pg_temp.today(), 'academy_today for a member');
select is((select public.academy_today(pg_temp.id('a2'))), null, 'academy_today is null for a non-member');
select is((select confirmed_total || '/' || confirmed_since_belt || '/' || belt from public.membership_class_stats),
  '1/0/blue', 'student stats: 1 confirmed, 0 since the belt awarded today');
select is((select count(*)::int from public.membership_class_stats), 1, 'student reads only own stats row');
select throws_ok($$ insert into public.belt_goals (academy_id, belt, position, classes_required)
  values (pg_temp.id('a1'), 'Azul', 9, 10) $$, '42501', null, 'student cannot create belt goals');

select pg_temp.login(pg_temp.id('p1'));
select is((select confirmed_total from public.membership_class_stats where user_id = pg_temp.id('t1')),
  1, 'professor reads member stats');
select throws_ok($$ insert into public.belt_goals (academy_id, belt, position, classes_required)
  values (pg_temp.id('a1'), 'Azul', 9, 10) $$, '23514', null, 'belt must be a palette key');

select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.membership_class_stats where academy_id = pg_temp.id('a1')),
  0, 'other academy professor reads no stats');

-- ------------------------------------------------------------ belt reorder ---
select pg_temp.login(pg_temp.id('p1'));
insert into public.belt_goals (id, academy_id, belt, position, classes_required) values
  ('00000000-0000-0000-00ee-000000000002', pg_temp.id('a1'), 'blue', 1, 120);
select lives_ok(
  $$ select public.reorder_belt_goals(pg_temp.id('a1'), array[
       '00000000-0000-0000-00ee-000000000002'::uuid,
       (select id from public.belt_goals where academy_id = pg_temp.id('a1') and belt = 'white')]) $$,
  'professor swaps belt positions in one call (deferrable unique)');
select is((select array_agg(belt order by position) from public.belt_goals where academy_id = pg_temp.id('a1')),
  array['blue', 'white'], 'belt order rewritten');
select throws_ok(
  $$ select public.reorder_belt_goals(pg_temp.id('a1'), array['00000000-0000-0000-00ee-000000000002'::uuid]) $$,
  '22023', 'belt_order_incomplete', 'reorder must list every belt');

select pg_temp.login(pg_temp.id('t1'));
select public.reorder_belt_goals(pg_temp.id('a1'), array[
  (select id from public.belt_goals where academy_id = pg_temp.id('a1') and belt = 'white'),
  '00000000-0000-0000-00ee-000000000002'::uuid]);
select is((select array_agg(belt order by position) from public.belt_goals where academy_id = pg_temp.id('a1')),
  array['blue', 'white'], 'student cannot reorder belts');

-- -------------------------------------------------------------- modalities ---
select pg_temp.login(pg_temp.id('t1'));
select is((select count(*)::int from public.academy_modalities), 3, 'student reads own academy modalities');
select throws_ok($$ insert into public.academy_modalities (academy_id, name) values (pg_temp.id('a1'), 'Boxe') $$,
  '42501', null, 'student cannot add modalities');
select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.academy_modalities where academy_id = pg_temp.id('a1')), 0,
  'other academy professor reads no modalities');

-- -------------------------------------------------------- schedule delete ---
select pg_temp.login(pg_temp.id('t1'));
delete from public.class_schedules where id = '00000000-0000-0000-0001-000000000001';
select is((select count(*)::int from public.class_schedules where id = '00000000-0000-0000-0001-000000000001'),
  1, 'student cannot delete schedules');
select pg_temp.login(pg_temp.id('p1'));
select lives_ok($$ delete from public.class_schedules where id = '00000000-0000-0000-0001-000000000001' $$,
  'professor deletes a schedule');
select is((select count(*)::int || '/' || coalesce(schedule_id::text, 'null') from public.checkins
           where user_id = pg_temp.id('t1') group by schedule_id),
  '1/null', 'check-ins survive the schedule deletion (link nulled)');
select is((select confirmed_total from public.membership_class_stats where user_id = pg_temp.id('t1')),
  1, 'deleted schedule still counts in the student total');

-- ---------------------------------------------------- logo + code preview ---
select pg_temp.login(pg_temp.id('x'));
select is((select academy_name || '/' || code_type from public.lookup_invite_code(lower((select invite_code from t_codes where id = pg_temp.id('a1'))))),
  'Kimi Jiu-Jitsu/student', 'any signed-in user looks up an academy by its student code');
select is((select count(*)::int from public.lookup_invite_code('ZZZZZZZZ')), 0, 'unknown code returns nothing');

select pg_temp.login(pg_temp.id('p1'));
select lives_ok(
  $$ update public.academies set logo_path = pg_temp.id('a1')::text || '/logo-1.png' where id = pg_temp.id('a1') $$,
  'owner sets the academy logo path');
select throws_ok(
  $$ update public.academies set logo_path = pg_temp.id('a2')::text || '/logo.png' where id = pg_temp.id('a1') $$,
  '23514', null, 'logo path must live in the academy folder');
select is((select logo_path from public.lookup_invite_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  pg_temp.id('a1')::text || '/logo-1.png', 'code lookup carries the logo path');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('academy-logos', pg_temp.id('a1')::text || '/logo-1.png') $$,
  'owner uploads to own academy folder');
select lives_ok(
  $$ update storage.objects set metadata = '{"v":2}' where bucket_id = 'academy-logos' and name = pg_temp.id('a1')::text || '/logo-1.png' $$,
  'owner replaces own logo (upsert = select + update)');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('academy-logos', pg_temp.id('a2')::text || '/x.png') $$,
  '42501', null, 'an owner cannot upload a logo to another academy');

-- Owner of academy 2 cannot touch academy 1's logo (object or path).
select pg_temp.login(pg_temp.id('p2'));
update storage.objects set metadata = '{"hijacked":true}'
  where bucket_id = 'academy-logos' and name = pg_temp.id('a1')::text || '/logo-1.png';
update public.academies set logo_path = null where id = pg_temp.id('a1');
select pg_temp.logout();
select is(
  (select coalesce(o.metadata::text, '') from storage.objects o
   where o.bucket_id = 'academy-logos' and o.name = pg_temp.id('a1')::text || '/logo-1.png')
  || '/' || (select logo_path from public.academies where id = pg_temp.id('a1')),
  '{"v": 2}/' || pg_temp.id('a1')::text || '/logo-1.png',
  'another academy''s owner cannot replace or unset the logo');

select pg_temp.login(pg_temp.id('t1'));
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('academy-logos', pg_temp.id('a1')::text || '/x.png') $$,
  '42501', null, 'student cannot upload a logo');
update public.academies set logo_path = null where id = pg_temp.id('a1');
select pg_temp.logout();
select isnt((select logo_path from public.academies where id = pg_temp.id('a1')), null, 'student cannot change the logo');


-- --------------------------------------------------- cross-academy reads ---
select pg_temp.login(pg_temp.id('s2'));
select is((select count(*)::int from public.academies), 1, 'student 2 sees only own academy');
select is((select count(*)::int from public.memberships), 1, 'student sees only own membership');
select is((select count(*)::int from public.profiles), 1, 'student sees only own profile');

select pg_temp.login(pg_temp.id('p2'));
select is(
  (select count(*)::int from public.profiles where id in (pg_temp.id('s1'), pg_temp.id('t1'), pg_temp.id('p1')))
  + (select count(*)::int from public.memberships where academy_id = pg_temp.id('a1'))
  + (select count(*)::int from public.academies where id = pg_temp.id('a1'))
  + (select count(*)::int from public.championships)
  + (select count(*)::int from public.belt_goals where academy_id = pg_temp.id('a1')),
  0, 'professor 2 reads nothing from academy 1');
select is((select count(*)::int from public.profiles), 3, 'professor reads profiles of own members');

select pg_temp.login(pg_temp.id('x'));
select is(
  (select count(*)::int from public.academies) + (select count(*)::int from public.memberships)
  + (select count(*)::int from public.class_schedules),
  0, 'user without academy sees nothing');

-- ------------------------------------------------------ owner × professor ---
-- Q1: professor (not owner) of A1. U1: student asking to join A1.
-- R1: professor asking to join A1.
select pg_temp.logout();
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'q1@kimi.test', '{"full_name":"Prof Auxiliar"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'u1@kimi.test', '{"full_name":"Aluno Novo"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'r1@kimi.test', '{"full_name":"Prof Candidato"}');
insert into t_ids values
  ('q1', '00000000-0000-0000-0000-0000000000d1'), ('u1', '00000000-0000-0000-0000-0000000000e1'),
  ('r1', '00000000-0000-0000-0000-0000000000f1');
insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('q1'), 'professor', 'active'),
  (pg_temp.id('a1'), pg_temp.id('u1'), 'student', 'pending'),
  (pg_temp.id('a1'), pg_temp.id('r1'), 'professor', 'pending');
insert into public.checkins (user_id, academy_id, schedule_id, class_date)
  values (pg_temp.id('s1'), pg_temp.id('a1'), null, pg_temp.today());

select pg_temp.login(pg_temp.id('q1'));
-- What a professor CAN do.
update public.checkins set status = 'confirmed' where user_id = pg_temp.id('s1');
select is((select status::text from public.checkins where user_id = pg_temp.id('s1')),
  'confirmed', 'professor confirms a check-in');
select is((select array_agg(role::text) from public.list_pending_requests(pg_temp.id('a1'))),
  array['student'], 'professor lists only student requests');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('r1'))
        + (select count(*)::int from public.profiles where id = pg_temp.id('r1')),
  0, 'professor cannot read a pending professor request (row or profile) through the API');
update public.memberships set status = 'active' where user_id = pg_temp.id('u1');
select is((select status::text from public.memberships where user_id = pg_temp.id('u1')),
  'active', 'professor approves a student');
select lives_ok(
  $$ insert into public.class_schedules (academy_id, weekday, start_time, modality)
     values (pg_temp.id('a1'), 2, '07:00', 'Jiu-Jitsu') $$,
  'professor creates a class schedule');
select lives_ok(
  $$ insert into public.belt_history (membership_id, belt)
     select id, 'white' from public.memberships where user_id = pg_temp.id('u1') $$,
  'professor sets a student''s belt');
update public.memberships set is_competitor = true where user_id = pg_temp.id('u1');
select is((select is_competitor from public.memberships where user_id = pg_temp.id('u1')),
  true, 'professor promotes a competitor');
select lives_ok(
  $$ insert into public.championships (academy_id, name, event_date)
     values (pg_temp.id('a1'), 'Copa Auxiliar', '2026-12-15') $$,
  'professor creates a championship');
select lives_ok(
  $$ insert into public.water_plans (athlete_id, academy_id, week_start)
     values (pg_temp.id('s1'), pg_temp.id('a1'), '2026-11-16') $$,
  'professor creates a water plan for a competitor');

select pg_temp.logout();
insert into public.checkins (user_id, academy_id, schedule_id, class_date)
  values (pg_temp.id('q1'), pg_temp.id('a1'), null, pg_temp.today());
select pg_temp.login(pg_temp.id('q1'));
update public.checkins set status = 'confirmed' where user_id = pg_temp.id('q1');
select is((select status::text from public.checkins where user_id = pg_temp.id('q1')),
  'pending', 'staff cannot confirm their own check-in');

-- What only the owner can do.
update public.memberships set status = 'active' where user_id = pg_temp.id('r1');
select pg_temp.logout();
select is((select status::text from public.memberships where user_id = pg_temp.id('r1')),
  'pending', 'professor cannot approve another professor');
select pg_temp.login(pg_temp.id('q1'));
delete from public.memberships where user_id = pg_temp.id('t1');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('t1')),
  1, 'professor cannot remove a student');
update public.academies set name = 'Tomada' where id = pg_temp.id('a1');
update public.academies set logo_path = null where id = pg_temp.id('a1');
select is((select name || '/' || coalesce(logo_path, 'null') from public.academies where id = pg_temp.id('a1')),
  'Kimi Jiu-Jitsu/' || pg_temp.id('a1')::text || '/logo-1.png', 'professor cannot change the academy name or logo');
select throws_ok(
  $$ insert into public.belt_history (membership_id, belt)
     select id, 'white' from public.memberships where user_id = pg_temp.id('p1') and academy_id = pg_temp.id('a1') $$,
  '42501', null, 'professor cannot set the owner''s belt');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('academy-logos', pg_temp.id('a1')::text || '/q.png') $$,
  '42501', null, 'professor cannot upload the academy logo');
select throws_ok(
  $$ insert into public.belt_goals (academy_id, belt, position, classes_required) values (pg_temp.id('a1'), 'purple', 7, 10) $$,
  '42501', null, 'professor cannot change belt goals');
select throws_ok(
  $$ insert into public.academy_modalities (academy_id, name) values (pg_temp.id('a1'), 'Boxe') $$,
  '42501', null, 'professor cannot change modalities');
select is((select count(*)::int from public.professor_codes), 0, 'professor does not see professor codes');
select throws_ok($$ select public.transfer_ownership(pg_temp.id('a1'), (select id from public.memberships where user_id = pg_temp.id('q1'))) $$,
  '42501', 'forbidden', 'professor cannot take the academy over');

-- Owner.
select pg_temp.login(pg_temp.id('p1'));
select is((select count(*)::int from public.list_pending_requests(pg_temp.id('a1')) where role = 'professor'),
  1, 'owner lists professor requests');
update public.memberships set status = 'active' where user_id = pg_temp.id('r1');
select is((select status::text from public.memberships where user_id = pg_temp.id('r1')),
  'active', 'owner approves a professor');
delete from public.memberships where user_id = pg_temp.id('r1');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('r1')),
  0, 'owner removes a professor');
delete from public.memberships where user_id = pg_temp.id('p1');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('p1')),
  1, 'owner cannot leave the academy');

-- ---------------------------------------------------------------- codes ---
-- N1, N2: new users joining with codes.
select pg_temp.logout();
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a9', 'n1@kimi.test', '{"full_name":"Novo Um"}'),
  ('00000000-0000-0000-0000-0000000000b9', 'n2@kimi.test', '{"full_name":"Novo Dois"}');
insert into t_ids values ('n1', '00000000-0000-0000-0000-0000000000a9'), ('n2', '00000000-0000-0000-0000-0000000000b9');
create temp table t_pcodes (key text primary key, id uuid, code text) on commit drop;
grant all on t_pcodes to authenticated, anon;
create function pg_temp.pcode(p_key text) returns text language sql as $$ select code from t_pcodes where key = p_key $$;
create function pg_temp.pcode_id(p_key text) returns uuid language sql as $$ select id from t_pcodes where key = p_key $$;
grant execute on function pg_temp.pcode(text), pg_temp.pcode_id(text) to public;

select pg_temp.login(pg_temp.id('q1'));
select throws_ok($$ select * from public.create_professor_code(pg_temp.id('a1')) $$,
  '42501', 'forbidden', 'professor cannot generate a professor code');
select throws_ok($$ select public.regenerate_student_code(pg_temp.id('a1')) $$,
  '42501', 'forbidden', 'professor cannot regenerate the student code');

select pg_temp.login(pg_temp.id('p1'));
insert into t_pcodes select 'used', id, code from public.create_professor_code(pg_temp.id('a1'));
insert into t_pcodes select 'revoked', id, code from public.create_professor_code(pg_temp.id('a1'));
insert into t_pcodes select 'expired', id, code from public.create_professor_code(pg_temp.id('a1'));
insert into t_pcodes select 'spare', id, code from public.create_professor_code(pg_temp.id('a1'));
select is((select count(*)::int from public.professor_codes where academy_id = pg_temp.id('a1')),
  4, 'owner generates and lists professor codes');
select is((select expires_at - created_at from public.professor_codes where id = pg_temp.pcode_id('used')),
  interval '7 days', 'a professor code is valid for 7 days');
select matches(pg_temp.pcode('used'), '^[A-HJKMNP-Z2-9]{8}$', 'professor code: 8 chars, no 0/O/1/I/L');
update public.professor_codes set revoked_at = now() where id = pg_temp.pcode_id('revoked');
select isnt((select revoked_at from public.professor_codes where id = pg_temp.pcode_id('revoked')), null,
  'owner revokes a professor code');

select throws_ok(format($$ update public.professor_codes set revoked_at = null where id = %L $$, pg_temp.pcode_id('revoked')),
  '22023', 'code_not_revocable', 'a revoked professor code cannot be brought back');

select pg_temp.login(pg_temp.id('q1'));
update public.professor_codes set revoked_at = now() where id = pg_temp.pcode_id('spare');
select pg_temp.login(pg_temp.id('p2'));
select is((select count(*)::int from public.professor_codes), 0, 'another academy''s owner sees no professor codes');
update public.professor_codes set revoked_at = now() where id = pg_temp.pcode_id('spare');
select pg_temp.logout();
select is((select revoked_at from public.professor_codes where id = pg_temp.pcode_id('spare')), null,
  'professor and other owners cannot revoke a professor code');
-- 7 days later.
update public.professor_codes
  set created_at = now() - interval '7 days 1 second', expires_at = now() - interval '1 second'
  where id = pg_temp.pcode_id('expired');

-- Lookup before sign-in.
select pg_temp.as_anon();
select is((select academy_name || '/' || code_type from public.lookup_invite_code(
    ' ' || lower((select invite_code from t_codes where id = pg_temp.id('a1'))))),
  'Kimi Jiu-Jitsu/student', 'anon looks up a student code (any case, spaces)');
select is((select academy_name || '/' || code_type || '/' || logo_path from public.lookup_invite_code(pg_temp.pcode('used'))),
  'Kimi Jiu-Jitsu/professor/' || pg_temp.id('a1')::text || '/logo-1.png', 'anon looks up a live professor code (name, logo, kind)');
select is((select count(*)::int from public.lookup_invite_code(pg_temp.pcode('revoked')))
        + (select count(*)::int from public.lookup_invite_code(pg_temp.pcode('expired')))
        + (select count(*)::int from public.lookup_invite_code('ABC'))
        + (select count(*)::int from public.lookup_invite_code('ZZZZZZZZ'))
        + (select count(*)::int from public.lookup_invite_code(null)),
  0, 'revoked, expired, malformed and unknown codes all return nothing');
select throws_ok($$ select * from public.academies $$, '42501', null, 'anon cannot list academies');
select throws_ok($$ select * from public.professor_codes $$, '42501', null, 'anon cannot read professor codes');
select throws_ok($$ select * from public.memberships $$, '42501', null, 'anon cannot read memberships');
select throws_ok($$ select public.join_with_code('ZZZZZZZZ') $$, '42501', null, 'anon cannot join');

-- Joining with a professor code: pending professor, code spent.
select pg_temp.login(pg_temp.id('n1'));
select is((select status::text from public.join_with_code(lower(pg_temp.pcode('used')))),
  'pending', 'professor code creates a pending request');
select is((select role::text from public.memberships where user_id = pg_temp.id('n1')),
  'professor', 'the request carries the professor role');
select is((select count(*)::int from public.join_with_code(pg_temp.pcode('spare'))
           where membership_id = (select id from public.memberships where user_id = pg_temp.id('n1'))),
  1, 'already pending: the same membership comes back, no duplicate');
select pg_temp.login(pg_temp.id('n2'));
select throws_ok(format($$ select public.join_with_code(%L) $$, pg_temp.pcode('used')),
  'P0002', 'invite_invalid', 'a used professor code behaves like an unknown code');
select throws_ok(format($$ select public.join_with_code(%L) $$, pg_temp.pcode('revoked')),
  'P0002', 'invite_invalid', 'a revoked professor code behaves like an unknown code');
select throws_ok(format($$ select public.join_with_code(%L) $$, pg_temp.pcode('expired')),
  'P0002', 'invite_invalid', 'a professor code older than 7 days behaves like an unknown code');
select pg_temp.as_anon();
select is((select count(*)::int from public.lookup_invite_code(pg_temp.pcode('used'))), 0,
  'a used professor code is no longer found');
select pg_temp.logout();
select is((select used_by from public.professor_codes where id = pg_temp.pcode_id('used')), pg_temp.id('n1'),
  'the code records who used it');
select is((select used_at from public.professor_codes where id = pg_temp.pcode_id('spare')), null,
  'a code sent by someone already in the academy is not spent');

-- Already a member: no second membership, straight to the app.
select pg_temp.login(pg_temp.id('t1'));
select is((select status::text from public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  'active', 'an active member asking again gets the existing active membership');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('t1')),
  1, 'no duplicate membership');

-- New student code: requests sent with the old one stay valid.
select pg_temp.login(pg_temp.id('n2'));
select public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')));
select pg_temp.login(pg_temp.id('p1'));
create temp table t_newcode on commit drop as select public.regenerate_student_code(pg_temp.id('a1')) as code;
grant select on t_newcode to authenticated, anon;
select isnt((select code from t_newcode), (select invite_code from t_codes where id = pg_temp.id('a1')),
  'owner generates a new student code');
select pg_temp.as_anon();
select is((select count(*)::int from public.lookup_invite_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  0, 'the old student code stops working');
select is((select code_type::text from public.lookup_invite_code((select code from t_newcode))), 'student',
  'the new student code works');
select pg_temp.login(pg_temp.id('p1'));
update public.memberships set status = 'active' where user_id = pg_temp.id('n2');
select is((select status::text from public.memberships where user_id = pg_temp.id('n2')),
  'active', 'a request sent with the old code is still approved');

-- Only the owner approves the professor who used a code.
select pg_temp.login(pg_temp.id('q1'));
update public.memberships set status = 'active' where user_id = pg_temp.id('n1');
select pg_temp.login(pg_temp.id('p1'));
select is((select status::text from public.memberships where user_id = pg_temp.id('n1')),
  'pending', 'a professor cannot approve the professor who used a code');
update public.memberships set status = 'active' where user_id = pg_temp.id('n1');
select is((select status::text from public.memberships where user_id = pg_temp.id('n1')),
  'active', 'the owner approves the professor who used a code');

-- Exactly one owner, enforced by the database itself (postgres bypasses RLS).
select pg_temp.logout();
select throws_ok(
  $$ update public.memberships set role = 'owner' where user_id = pg_temp.id('q1') $$,
  '23505', null, 'an academy cannot have two owners');
set constraints memberships_keep_owner immediate;
select throws_ok(
  $$ update public.memberships set role = 'professor' where user_id = pg_temp.id('p1') and academy_id = pg_temp.id('a1') $$,
  '23514', 'academy_needs_owner', 'the owner cannot be demoted without a successor');
select throws_ok(
  $$ delete from public.memberships where user_id = pg_temp.id('p1') and academy_id = pg_temp.id('a1') $$,
  '23514', 'academy_needs_owner', 'the owner membership cannot be deleted');
set constraints memberships_keep_owner deferred;

-- Transfer.
select pg_temp.login(pg_temp.id('p1'));
select throws_ok(
  $$ select public.transfer_ownership(pg_temp.id('a1'), (select val from t_ids where key = 't1_membership')) $$,
  '22023', 'transfer_target_invalid', 'ownership only goes to an active professor');
select throws_ok(
  $$ select public.transfer_ownership(pg_temp.id('a1'), (select id from public.memberships where academy_id = pg_temp.id('a2') limit 1)) $$,
  '22023', 'transfer_target_invalid', 'ownership only goes to a professor of the same academy');
select lives_ok(
  $$ select public.transfer_ownership(pg_temp.id('a1'), (select id from public.memberships where user_id = pg_temp.id('q1'))) $$,
  'owner transfers the academy to a professor');
select lives_ok($$ set constraints all immediate $$, 'one owner at the end of the transfer (deferred check passes)');
set constraints all deferred;
select is(
  (select string_agg(role::text, ',' order by role) from public.memberships
   where academy_id = pg_temp.id('a1') and user_id in (pg_temp.id('p1'), pg_temp.id('q1'))),
  'owner,professor', 'new owner promoted, old owner became professor');
update public.academies set name = 'Depois da transferência' where id = pg_temp.id('a1');
select is((select name from public.academies where id = pg_temp.id('a1')),
  'Kimi Jiu-Jitsu', 'the old owner lost the owner permissions');
select lives_ok($$ delete from public.memberships where user_id = pg_temp.id('p1') and academy_id = pg_temp.id('a1') $$,
  'after the transfer, the old owner can leave');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('p1')), 0, 'old owner left');

-- ------------------------------------------------------------------ anon ---
select pg_temp.as_anon();
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');

select * from finish();
rollback;
