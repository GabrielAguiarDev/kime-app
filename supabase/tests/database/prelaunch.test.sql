-- Phase 7: account deletion, body data privacy, rejected-request cooldown, lookup rate limit.
-- Run with: supabase test db
--
-- A1 (owner O, instructor I, student S, competitor C). A2: owner O2 alone, with history.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(23);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
end $$;
grant execute on function pg_temp.login(uuid), pg_temp.logout() to public;

create temp table t_ids (key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$
  select val from t_ids where key = p_key
$$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('70000000-0000-0000-0000-0000000000a1', 'o@pl.test',  '{"full_name":"Dona"}'),
  ('70000000-0000-0000-0000-0000000000a2', 'i@pl.test',  '{"full_name":"Instrutor"}'),
  ('70000000-0000-0000-0000-0000000000a3', 's@pl.test',  '{"full_name":"Aluno"}'),
  ('70000000-0000-0000-0000-0000000000a4', 'c@pl.test',  '{"full_name":"Atleta"}'),
  ('70000000-0000-0000-0000-0000000000b1', 'o2@pl.test', '{"full_name":"Dona Dois"}'),
  ('70000000-0000-0000-0000-0000000000b2', 'x@pl.test',  '{"full_name":"Visitante"}');
insert into t_ids values
  ('o', '70000000-0000-0000-0000-0000000000a1'), ('i', '70000000-0000-0000-0000-0000000000a2'),
  ('s', '70000000-0000-0000-0000-0000000000a3'), ('c', '70000000-0000-0000-0000-0000000000a4'),
  ('o2', '70000000-0000-0000-0000-0000000000b1'), ('x', '70000000-0000-0000-0000-0000000000b2');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi PL', array['Jiu-Jitsu']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Solo PL', array['Judô']));
select pg_temp.logout();

insert into public.memberships (academy_id, user_id, role, status, is_competitor) values
  (pg_temp.id('a1'), pg_temp.id('i'), 'instructor', 'active', false),
  (pg_temp.id('a1'), pg_temp.id('s'), 'student', 'active', false),
  (pg_temp.id('a1'), pg_temp.id('c'), 'student', 'active', true);
update public.profiles set weight_kg = 80, height_cm = 180 where id in (pg_temp.id('s'), pg_temp.id('c'));

-- ---------------------------------------------------------------------------
-- Body data
-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select weight_kg from public.profiles where id = pg_temp.id('s') $$,
  '42501', null, 'body columns are not readable directly');
select lives_ok($$ select full_name, avatar_path, timezone from public.profiles where id = pg_temp.id('s') $$,
  'other profile columns stay readable');
select is((select count(*)::int from public.get_profile_details(pg_temp.id('s'))),
  0, 'staff do not read the body data of a regular student');
select is((select weight_kg from public.get_profile_details(pg_temp.id('c'))),
  80.00::numeric, 'staff read the body data of a competitor');
select pg_temp.login(pg_temp.id('s'));
select is((select height_cm from public.get_profile_details(pg_temp.id('s'))),
  180.0::numeric, 'the user reads their own body data');
select is((select count(*)::int from public.get_profile_details(pg_temp.id('c'))),
  0, 'students do not read each other');
select lives_ok($$ update public.profiles set weight_kg = 81 where id = pg_temp.id('s') $$,
  'the user still updates their weight');

-- ---------------------------------------------------------------------------
-- Rejected request cooldown
-- ---------------------------------------------------------------------------
select set_config('t.code', (select invite_code from public.academies where id = pg_temp.id('a1')), true);
select pg_temp.login(pg_temp.id('x'));
select public.join_with_code(current_setting('t.code'));
select pg_temp.login(pg_temp.id('o'));
update public.memberships set status = 'rejected' where user_id = pg_temp.id('x');
select pg_temp.login(pg_temp.id('x'));
select throws_ok(
  $$ select public.join_with_code(current_setting('t.code')) $$,
  '22023', 'join_cooldown', 'a rejected request waits 24 h');
select pg_temp.logout();
update public.memberships set decided_at = now() - interval '25 hours' where user_id = pg_temp.id('x');
select pg_temp.login(pg_temp.id('x'));
select lives_ok(
  $$ select public.join_with_code(current_setting('t.code')) $$,
  'after 24 h the request can be repeated');
select pg_temp.logout();
select is((select status::text from public.memberships where user_id = pg_temp.id('x')),
  'pending', 'the repeated request is pending again');

-- ---------------------------------------------------------------------------
-- Lookup rate limit
-- ---------------------------------------------------------------------------
select set_config('role', 'anon', true);
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', true);
select is((select count(*)::int from generate_series(1, 20) g, lateral public.lookup_invite_code('ZZZZZZZZ' || left(g::text, 0))),
  -- (g referenced so the function runs once per row, not once and cached)
  0, '20 failed lookups are allowed');
select throws_ok($$ select * from public.lookup_invite_code('ZZZZZZZZ') $$,
  'P0001', 'rate_limited', 'the 21st failure within 15 minutes is refused');
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.2"}', true);
select lives_ok($$ select * from public.lookup_invite_code('ZZZZZZZZ') $$, 'other clients are not affected');
select set_config('request.headers', '', true);
select lives_ok($$ select * from public.lookup_invite_code('ZZZZZZZZ') $$, 'no limit without request headers');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------
-- A2 with history: schedule, confirmed check-in, belt awarded (restrict FKs).
insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a2'), pg_temp.id('s'), 'student', 'active');
select pg_temp.login(pg_temp.id('o'));
select throws_ok($$ select public.delete_my_account() $$,
  '23514', 'owner_must_transfer', 'an owner with active members must transfer first');
select throws_ok($$ select * from public.account_deletion_academies() $$,
  '23514', 'owner_must_transfer', 'the pre-check says the same');

select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ select public.delete_my_account() $$, 'a student deletes their account');
select pg_temp.logout();
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('s')),
  0, 'their memberships are gone');
select is((select count(*)::int from auth.users where id = pg_temp.id('s')), 0, 'the auth user is gone');

insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id)
values ('71000000-0000-0000-0000-000000000001', pg_temp.id('a2'), 1, '19:00',
        (select id from public.academy_modalities where academy_id = pg_temp.id('a2') limit 1));
update public.academy_modalities set uses_belts = true where academy_id = pg_temp.id('a2');
insert into public.modality_belts (id, academy_id, modality_id, position, primary_color, classes_required)
values ('71000000-0000-0000-0000-000000000002', pg_temp.id('a2'),
        (select id from public.academy_modalities where academy_id = pg_temp.id('a2') limit 1), 0, 'white', 10);
insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a2'), pg_temp.id('x'), 'student', 'pending');

select pg_temp.login(pg_temp.id('o2'));
select is((select array_agg(academy_id) from public.account_deletion_academies()),
  array[pg_temp.id('a2')], 'the pre-check lists the academy that goes with the account');
select lives_ok($$ select public.delete_my_account() $$,
  'an owner alone in their academy deletes the account (pending requests do not block)');
select pg_temp.logout();
select is((select count(*)::int from public.academies where id = pg_temp.id('a2')), 0, 'the academy went with it');
select is((select count(*)::int from public.class_schedules where academy_id = pg_temp.id('a2')),
  0, 'its schedules and belts went too');

select * from finish();
rollback;
