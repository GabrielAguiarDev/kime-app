-- RLS / RPC tests for the foundation migration. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

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

-- The migration revokes PUBLIC execute on new functions by default.
grant execute on function pg_temp.login(uuid), pg_temp.logout(), pg_temp.as_anon() to public;

-- ------------------------------------------------------------------ users ---
-- A = professor of gym 1, B = joins gym 1 as student, C = professor of gym 2
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@kimi.test', '{"full_name":"Ana Prof"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@kimi.test', '{"full_name":"Beto Aluno"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@kimi.test', '{"name":"Caio Outro"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@kimi.test', '{"full_name":"Duda Prof"}');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  0, 'anon has no table privilege in public');
select is(
  (select count(*)::int from information_schema.routine_privileges
   where grantee in ('anon', 'PUBLIC') and routine_schema in ('public', 'private')
     and routine_name <> 'get_invite_preview'),
  0, 'anon/PUBLIC can execute only get_invite_preview');

select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'Caio Outro', 'profile created from auth metadata (name fallback)');

-- -------------------------------------------------------------- gym setup ---
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
create temp table t_ids (key text primary key, val text) on commit drop;
grant all on t_ids to authenticated, anon;
insert into t_ids values ('gym1', public.create_gym('  Kimi Jiu-Jitsu  ')::text);

select is((select name from public.gyms where id = (select val::uuid from t_ids where key = 'gym1')),
  'Kimi Jiu-Jitsu', 'creator sees gym, name trimmed');
select is((select role::text || '/' || status::text from public.memberships
           where gym_id = (select val::uuid from t_ids where key = 'gym1')),
  'professor/active', 'creator is active professor');
select is((select count(*)::int from public.gym_invites
           where gym_id = (select val::uuid from t_ids where key = 'gym1') and revoked_at is null),
  2, 'student and professor invite links created');
insert into t_ids select 'token', token from public.gym_invites
  where gym_id = (select val::uuid from t_ids where key = 'gym1') and role = 'student';
select throws_ok($$ select public.create_gym('x') $$, '22023', 'invalid_gym_name', 'gym name too short');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
insert into t_ids values ('gym2', public.create_gym('Outra Academia')::text);

-- ----------------------------------------------------------------- B: outsider
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.gyms), 0, 'outsider sees no gyms');
select is((select count(*)::int from public.memberships), 0, 'outsider sees no memberships');
select is((select count(*)::int from public.gym_invites), 0, 'outsider sees no invites');
select is((select count(*)::int from public.profiles), 1, 'outsider sees only own profile');
select throws_ok(
  $$ insert into public.memberships (gym_id, user_id, role, status)
     values ((select val::uuid from t_ids where key = 'gym1'),
             '00000000-0000-0000-0000-00000000000b', 'professor', 'active') $$,
  '42501', null, 'direct membership insert is denied');

-- ------------------------------------------------------------ anon preview ---
select pg_temp.as_anon();
select is((select gym_name from public.get_invite_preview((select val from t_ids where key = 'token'))),
  'Kimi Jiu-Jitsu', 'anon can preview a valid invite');
select is((select count(*)::int from public.get_invite_preview('nope')), 0, 'unknown token reveals nothing');
select throws_ok($$ select count(*) from public.gyms $$, '42501', null, 'anon cannot read gyms');
select throws_ok($$ select public.request_membership('x') $$, '42501', null, 'anon cannot request membership');
select throws_ok($$ select public.create_gym('Anon Gym') $$, '42501', null, 'anon cannot create gym');

-- ------------------------------------------------------------- B joins gym 1
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into t_ids values ('m_b', public.request_membership((select val from t_ids where key = 'token'))::text);
select is((select role::text || '/' || status::text from public.memberships where user_id = auth.uid()),
  'student/pending', 'join request lands as pending student');
select is((select count(*)::int from public.gyms), 1, 'pending member sees the gym name');
select is((select count(*)::int from public.gym_invites), 0, 'student never sees invite links');
select is((select count(*)::int from public.profiles), 1, 'pending member cannot see other profiles');
select throws_ok(
  format('select public.decide_membership(%L, true)', (select val from t_ids where key = 'm_b')),
  'P0002', 'membership_not_found', 'member cannot approve own request');

-- --------------------------------------------------------- A approves B ---
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.profiles), 2, 'professor sees requester profile');
select lives_ok(
  format('select public.decide_membership(%L, true)', (select val from t_ids where key = 'm_b')),
  'professor approves request');
select is((select status::text from public.memberships where id = (select val::uuid from t_ids where key = 'm_b')),
  'active', 'membership is active after approval');

-- ------------------------------------------------- B as active student ---
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.profiles), 2, 'active student sees active co-member');
select throws_ok(
  format('select public.rotate_invite(%L, %L)', (select val from t_ids where key = 'gym1'), 'student'),
  '42501', 'forbidden', 'student cannot rotate invites');
update public.gyms set name = 'Hacked' where id = (select val::uuid from t_ids where key = 'gym1');
select is((select name from public.gyms where id = (select val::uuid from t_ids where key = 'gym1')),
  'Kimi Jiu-Jitsu', 'student cannot rename gym');

-- ------------------------------------------- C (other gym) is isolated ---
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.memberships
           where gym_id = (select val::uuid from t_ids where key = 'gym1')), 0,
  'professor of another gym sees nothing of gym 1');

-- ------------------------------------------------------- rotate invite ---
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.rotate_invite((select val::uuid from t_ids where key = 'gym1'), 'student');
select is((select count(*)::int from public.get_invite_preview((select val from t_ids where key = 'token'))),
  0, 'rotated token is no longer valid');


-- --------------------------------------------- professor link + pending prof
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into t_ids select 'prof_token', token from public.gym_invites
  where gym_id = (select val::uuid from t_ids where key = 'gym1') and role = 'professor' and revoked_at is null;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.request_membership((select val from t_ids where key = 'prof_token'));
select is((select role::text || '/' || status::text from public.memberships where user_id = auth.uid()),
  'student/active', 'active student using professor link keeps role and status');
select throws_ok(
  $$ update public.memberships set role = 'professor' where user_id = auth.uid() $$,
  '42501', null, 'member cannot update memberships directly');
select throws_ok(
  $$ update public.profiles set id = gen_random_uuid() where id = auth.uid() $$,
  '42501', null, 'profile columns other than full_name are not updatable');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
insert into t_ids values ('m_d', public.request_membership((select val from t_ids where key = 'prof_token'))::text);
select is((select role::text || '/' || status::text from public.memberships where user_id = auth.uid()),
  'professor/pending', 'professor link lands as pending professor');
select is((select count(*)::int from public.gym_invites), 0, 'pending professor sees no invites');
select throws_ok(
  format('select public.decide_membership(%L, true)', (select val from t_ids where key = 'm_d')),
  'P0002', 'membership_not_found', 'pending professor cannot approve');

-- -------------------------------------------- other gym professor (C) ---
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  format('select public.decide_membership(%L, true)', (select val from t_ids where key = 'm_d')),
  'P0002', 'membership_not_found', 'professor of another gym cannot decide');
select throws_ok(
  format('select public.rotate_invite(%L, %L)', (select val from t_ids where key = 'gym1'), 'student'),
  '42501', 'forbidden', 'professor of another gym cannot rotate invites');
select is((select count(*)::int from public.list_pending_requests((select val::uuid from t_ids where key = 'gym1'))),
  0, 'professor of another gym lists no pending requests');

-- ------------------------------------------------ A: pending + removal ---
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select email from public.list_pending_requests((select val::uuid from t_ids where key = 'gym1'))),
  'd@kimi.test', 'professor sees requester e-mail in pending list');
select throws_ok(
  format('select public.decide_membership(%L, true)', (select val from t_ids where key = 'm_b')),
  '22023', 'membership_not_pending', 'cannot decide a non-pending membership');
select lives_ok(
  format('select public.decide_membership(%L, true)', (select val from t_ids where key = 'm_d')),
  'owner approves the professor request');
select throws_ok(
  format('select public.remove_membership(%L)',
    (select id from public.memberships where user_id = auth.uid()
       and gym_id = (select val::uuid from t_ids where key = 'gym1'))),
  '42501', 'cannot_remove_member', 'professor cannot remove themselves');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_ok(
  format('select public.remove_membership(%L)',
    (select id from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a'
       and gym_id = (select val::uuid from t_ids where key = 'gym1'))),
  '42501', 'cannot_remove_member', 'second professor cannot remove the owner');
select lives_ok(
  format('select public.remove_membership(%L)', (select val from t_ids where key = 'm_b')),
  'professor removes a student');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.gyms), 0, 'removed member no longer sees the gym');

select pg_temp.logout();
select * from finish();
rollback;
