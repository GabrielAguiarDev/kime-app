-- Round timer presets: members read, staff write.
-- Run with: supabase test db
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(8);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
grant execute on function pg_temp.login(uuid) to public;

create temp table t_ids (key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$
  select val from t_ids where key = p_key
$$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'o@tp.test', '{"full_name":"Dona"}'),
  ('a0000000-0000-0000-0000-000000000002', 's@tp.test', '{"full_name":"Aluno"}'),
  ('a0000000-0000-0000-0000-000000000003', 'x@tp.test', '{"full_name":"Fora"}');
insert into t_ids values
  ('o', 'a0000000-0000-0000-0000-000000000001'), ('s', 'a0000000-0000-0000-0000-000000000002'),
  ('x', 'a0000000-0000-0000-0000-000000000003');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi TP', array['Muay Thai']));
set local role postgres;
insert into public.memberships (academy_id, user_id, role, status)
values (pg_temp.id('a1'), pg_temp.id('s'), 'student', 'active');

select pg_temp.login(pg_temp.id('o'));
select lives_ok(
  $$ insert into public.timer_presets (academy_id, name, rounds, round_seconds, rest_seconds, warning_seconds, created_by)
     values (pg_temp.id('a1'), 'Sparring', 4, 120, 30, 10, pg_temp.id('o')) $$,
  'staff save a preset');
select throws_ok(
  $$ insert into public.timer_presets (academy_id, name, rounds, round_seconds, rest_seconds, warning_seconds, created_by)
     values (pg_temp.id('a1'), ' sparring ', 3, 60, 0, 0, pg_temp.id('o')) $$,
  '23505', null, 'names are unique in the academy (case and spaces ignored)');
select throws_ok(
  $$ insert into public.timer_presets (academy_id, name, rounds, round_seconds, rest_seconds, warning_seconds, created_by)
     values (pg_temp.id('a1'), 'Errado', 3, 30, 0, 30, pg_temp.id('o')) $$,
  '23514', null, 'the warning must be shorter than the round');
select lives_ok($$ update public.timer_presets set rounds = 5 where name = 'Sparring' $$, 'staff edit');

select pg_temp.login(pg_temp.id('s'));
select is((select rounds::int from public.timer_presets where name = 'Sparring'), 5, 'members read the presets');
select throws_ok(
  $$ insert into public.timer_presets (academy_id, name, rounds, round_seconds, rest_seconds, warning_seconds, created_by)
     values (pg_temp.id('a1'), 'Meu', 3, 60, 0, 0, pg_temp.id('s')) $$,
  '42501', null, 'students do not save presets');
delete from public.timer_presets;
select is((select count(*)::int from public.timer_presets), 1, 'students do not delete');

select pg_temp.login(pg_temp.id('x'));
select is((select count(*)::int from public.timer_presets), 0, 'outsiders read nothing');

select * from finish();
rollback;
