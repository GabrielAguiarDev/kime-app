-- Phase 5: diet plan of a competitor (save_diet_meal, copy_diet_day, access).
-- Run with: supabase test db
--
-- Academy A1: O owner, I instructor, S competitor, S2 student. Academy A2: O2 owner.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(17);

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
grant execute on function pg_temp.login(uuid), pg_temp.logout() to public;

create temp table t_ids (key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$
  select val from t_ids where key = p_key
$$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('60000000-0000-0000-0000-0000000000a1', 'o@dt.test',  '{"full_name":"Dona"}'),
  ('60000000-0000-0000-0000-0000000000a2', 'i@dt.test',  '{"full_name":"Instrutor"}'),
  ('60000000-0000-0000-0000-0000000000a3', 's@dt.test',  '{"full_name":"Atleta"}'),
  ('60000000-0000-0000-0000-0000000000a4', 's2@dt.test', '{"full_name":"Aluna"}'),
  ('60000000-0000-0000-0000-0000000000b1', 'o2@dt.test', '{"full_name":"Dona Dois"}');
insert into t_ids values
  ('o',  '60000000-0000-0000-0000-0000000000a1'), ('i', '60000000-0000-0000-0000-0000000000a2'),
  ('s',  '60000000-0000-0000-0000-0000000000a3'), ('s2', '60000000-0000-0000-0000-0000000000a4'),
  ('o2', '60000000-0000-0000-0000-0000000000b1');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi DT', array['Jiu-Jitsu']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra DT', array['Judô']));
select pg_temp.logout();

-- Inserted as postgres: S is already on the team (the invite flow is covered in competition.test.sql).
insert into public.memberships (academy_id, user_id, role, status, is_competitor) values
  (pg_temp.id('a1'), pg_temp.id('i'),  'instructor', 'active', false),
  (pg_temp.id('a1'), pg_temp.id('s'),  'student', 'active', true),
  (pg_temp.id('a1'), pg_temp.id('s2'), 'student', 'active', false);

select pg_temp.login(pg_temp.id('i'));
select lives_ok(
  $$ insert into t_ids values ('m1', public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-10', null,
       ' Café da manhã ', '07:30', 'Ovos e aveia')) $$,
  'staff add a meal (creates the day)');
select lives_ok(
  $$ insert into t_ids values ('m2', public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-10', null,
       'Almoço', null, '')) $$,
  'staff add another meal');
select is((select array_agg(name || ':' || position order by position) from public.diet_plan_meals),
  array['Café da manhã:0', 'Almoço:1'], 'meals are appended in order, names trimmed');
select is((select count(*)::int from public.diet_plans), 1, 'one day row');

select lives_ok(
  $$ select public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-10', pg_temp.id('m2'),
       'Almoço', '12:00', 'Arroz, feijão e frango') $$,
  'staff edit a meal');
select is((select meal_time::text from public.diet_plan_meals where id = pg_temp.id('m2')),
  '12:00:00', 'the edit is saved');
select throws_ok(
  $$ select public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-11', pg_temp.id('m2'),
       'Almoço', null, '') $$,
  '42501', 'forbidden', 'a meal is edited only on its own day');

select throws_ok(
  $$ select public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s2'), '2026-11-10', null, 'Jantar', null, '') $$,
  '42501', null, 'no diet for a non-competitor');

select lives_ok(
  $$ select public.copy_diet_day(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-10', '2026-11-11') $$,
  'staff copy a day');
select is((select count(*)::int from public.diet_plan_meals m join public.diet_plans p on p.id = m.plan_id
           where p.plan_date = '2026-11-11'), 2, 'the copy has the same meals');
select is(public.copy_diet_day(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-09', '2026-11-11'),
  0, 'copying an empty day clears the target');
select throws_ok(
  $$ select public.copy_diet_day(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-10', '2026-11-10') $$,
  '22023', 'diet_copy_same_day', 'cannot copy a day onto itself');

select pg_temp.login(pg_temp.id('o2'));
select throws_ok(
  $$ select public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-12', null, 'Jantar', null, '') $$,
  '42501', null, 'staff of another academy cannot write');
select is((select count(*)::int from public.diet_plan_meals), 0, 'staff of another academy read nothing');

select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.diet_plan_meals), 2, 'the competitor reads their diet');
select throws_ok(
  $$ select public.save_diet_meal(pg_temp.id('a1'), pg_temp.id('s'), '2026-11-12', null, 'Lanche', null, '') $$,
  '42501', null, 'the competitor does not write their diet');

select pg_temp.login(pg_temp.id('s2'));
select is((select count(*)::int from public.diet_plan_meals), 0, 'other students read nothing');

select * from finish();
rollback;
