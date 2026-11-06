-- Personal timer presets: each user reads and writes only their own.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000011', 'a@ptp.test', '{"full_name":"Aluno"}'),
  ('a0000000-0000-0000-0000-000000000012', 'b@ptp.test', '{"full_name":"Outro"}');

select pg_temp.login('a0000000-0000-0000-0000-000000000011');
select lives_ok(
  $$ insert into public.personal_timer_presets (name, rounds, round_seconds, rest_seconds, warning_seconds)
     values ('Treino em casa', 4, 120, 30, 10) $$,
  'a student saves a preset of their own');
select is((select user_id from public.personal_timer_presets where name = 'Treino em casa'),
  'a0000000-0000-0000-0000-000000000011'::uuid, 'the author is the logged user');
select throws_ok(
  $$ insert into public.personal_timer_presets (name, rounds, round_seconds, rest_seconds, warning_seconds)
     values (' treino em CASA ', 3, 60, 0, 0) $$,
  '23505', null, 'names are unique per user (case and spaces ignored)');
select throws_ok(
  $$ insert into public.personal_timer_presets (user_id, name, rounds, round_seconds, rest_seconds, warning_seconds)
     values ('a0000000-0000-0000-0000-000000000012', 'Alheio', 3, 60, 0, 0) $$,
  '42501', null, 'cannot save a preset for someone else');
select lives_ok($$ update public.personal_timer_presets set rounds = 6 where name = 'Treino em casa' $$, 'the author edits');

select pg_temp.login('a0000000-0000-0000-0000-000000000012');
select is((select count(*)::int from public.personal_timer_presets), 0, 'others read nothing');
update public.personal_timer_presets set rounds = 9;
delete from public.personal_timer_presets;
select pg_temp.login('a0000000-0000-0000-0000-000000000011');
select is((select rounds::int from public.personal_timer_presets where name = 'Treino em casa'), 6, 'others neither edit nor delete');
select lives_ok($$ delete from public.personal_timer_presets where name = 'Treino em casa' $$, 'the author deletes');

select * from finish();
rollback;
