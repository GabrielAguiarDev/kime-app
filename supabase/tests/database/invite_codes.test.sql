-- Unified invite codes: one active student + one active instructor code per
-- academy, reusable, regenerated only by the owner. Run with: supabase test db
--
-- Academy A1: O owner, I instructor, S student. Academy A2: O2 owner.
-- X1..X5 belong to no academy.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(60);

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
grant execute on function pg_temp.login(uuid), pg_temp.logout(), pg_temp.as_anon() to public;

create temp table t_ids (key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated, anon;
create function pg_temp.id(p_key text) returns uuid language sql as $$
  select val from t_ids where key = p_key
$$;
grant execute on function pg_temp.id(text) to public;

-- Codes by key ('a1_student', 'a1_instructor', 'new_student', ...).
create temp table t_codes (key text primary key, code text) on commit drop;
grant all on t_codes to authenticated, anon;
create function pg_temp.code(p_key text) returns text language sql as $$
  select code from t_codes where key = p_key
$$;
grant execute on function pg_temp.code(text) to public;

-- The active code of a kind, read as the schema owner (RLS would hide it).
create function pg_temp.active_code(p_academy text, p_type public.membership_role) returns text
language sql security definer as $$
  select code from public.academy_invite_codes
  where academy_id = pg_temp.id(p_academy) and code_type = p_type and status = 'active'
$$;
grant execute on function pg_temp.active_code(text, public.membership_role) to public;

-- ------------------------------------------------------------------ users ---
insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-000000000001', 'o@ic.test', '{"full_name":"Dona"}'),
  ('b0000000-0000-0000-0000-000000000002', 'o2@ic.test', '{"full_name":"Dona Dois"}'),
  ('b0000000-0000-0000-0000-000000000003', 'i@ic.test', '{"full_name":"Instrutor"}'),
  ('b0000000-0000-0000-0000-000000000004', 's@ic.test', '{"full_name":"Aluno"}'),
  ('b0000000-0000-0000-0000-000000000011', 'x1@ic.test', '{"full_name":"Fora Um"}'),
  ('b0000000-0000-0000-0000-000000000012', 'x2@ic.test', '{"full_name":"Fora Dois"}'),
  ('b0000000-0000-0000-0000-000000000013', 'x3@ic.test', '{"full_name":"Fora Tres"}'),
  ('b0000000-0000-0000-0000-000000000014', 'x4@ic.test', '{"full_name":"Fora Quatro"}'),
  ('b0000000-0000-0000-0000-000000000015', 'x5@ic.test', '{"full_name":"Fora Cinco"}');
insert into t_ids values
  ('o', 'b0000000-0000-0000-0000-000000000001'), ('o2', 'b0000000-0000-0000-0000-000000000002'),
  ('i', 'b0000000-0000-0000-0000-000000000003'), ('s', 'b0000000-0000-0000-0000-000000000004'),
  ('x1', 'b0000000-0000-0000-0000-000000000011'), ('x2', 'b0000000-0000-0000-0000-000000000012'),
  ('x3', 'b0000000-0000-0000-0000-000000000013'), ('x4', 'b0000000-0000-0000-0000-000000000014'),
  ('x5', 'b0000000-0000-0000-0000-000000000015');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi IC', array['Muay Thai']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Kimi IC Dois', array['Judô']));
select pg_temp.logout();
insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('i'), 'instructor', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s'), 'student', 'active');
insert into t_codes values
  ('a1_student', pg_temp.active_code('a1', 'student')),
  ('a1_instructor', pg_temp.active_code('a1', 'instructor')),
  ('a2_student', pg_temp.active_code('a2', 'student')),
  ('a2_instructor', pg_temp.active_code('a2', 'instructor'));

-- ------------------------------------------------- 1. creation / uniqueness ---
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a1') and status = 'active'),
  2, 'a new academy gets exactly two active codes');
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a1') and code_type = 'student' and status = 'active'),
  1, 'one active student code');
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a1') and code_type = 'instructor' and status = 'active'),
  1, 'one active instructor code');
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a1')),
  2, 'and nothing else');
select is((select bool_and(created_by = pg_temp.id('o')) from public.academy_invite_codes where academy_id = pg_temp.id('a1')),
  true, 'the codes record the creator');
select ok((select bool_and(code ~ '^[A-HJKMNP-Z2-9]{8}$') from public.academy_invite_codes),
  'every code has 8 chars, no 0/O/1/I/L');
select is((select count(distinct code)::int from t_codes), 4, 'codes are different across kinds and academies');
select throws_ok(
  format($$ insert into public.academy_invite_codes (academy_id, code_type, code)
            values (%L, 'student', 'AAAAAAAA') $$, pg_temp.id('a1')),
  '23505', null, 'a second active student code for the same academy is rejected');
select throws_ok(
  format($$ insert into public.academy_invite_codes (academy_id, code_type, code)
            values (%L, 'instructor', 'AAAAAAAA') $$, pg_temp.id('a1')),
  '23505', null, 'a second active instructor code for the same academy is rejected');
select throws_ok(
  format($$ insert into public.academy_invite_codes (academy_id, code_type, code)
            values (%L, 'student', %L) $$, pg_temp.id('a2'), pg_temp.code('a1_student')),
  '23505', null, 'a code cannot be reused by another academy');
select throws_ok(
  format($$ insert into public.academy_invite_codes (academy_id, code_type, code)
            values (%L, 'owner', 'AAAAAAAA') $$, pg_temp.id('a1')),
  '23514', null, 'only student and instructor codes exist');
select throws_ok(
  format($$ insert into public.academy_invite_codes (academy_id, code_type, code, status)
            values (%L, 'student', 'AAAAAAAA', 'replaced') $$, pg_temp.id('a1')),
  '23514', null, 'a replaced code needs its replacement date');

-- ------------------------------------------------------------------ reads ---
select pg_temp.login(pg_temp.id('o'));
select is((select array_agg(code_type::text order by code_type::text) from public.academy_invite_codes),
  array['instructor', 'student'], 'owner reads both codes of own academy (and none of the other)');
select pg_temp.login(pg_temp.id('i'));
select is((select code_type::text || '/' || status from public.academy_invite_codes),
  'student/active', 'instructor reads only the active student code');
select is((select count(*)::int from public.academy_invite_codes where code_type = 'instructor'),
  0, 'instructor does not read the instructor code');
select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.academy_invite_codes), 0, 'student reads no code');
select pg_temp.login(pg_temp.id('x1'));
select is((select count(*)::int from public.academy_invite_codes), 0, 'a user without academy reads no code');
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a1')), 0,
  'another academy''s owner reads no code of this academy');
select pg_temp.as_anon();
select throws_ok($$ select * from public.academy_invite_codes $$, '42501', null, 'anon cannot read the table');
select throws_ok($$ select public.regenerate_invite_code(null, 'student') $$, '42501', null, 'anon cannot regenerate');

-- Direct writes are closed to every API role.
select pg_temp.login(pg_temp.id('o'));
select throws_ok(
  format($$ insert into public.academy_invite_codes (academy_id, code_type, code) values (%L, 'student', 'BBBBBBBB') $$, pg_temp.id('a1')),
  '42501', null, 'the owner cannot insert codes directly');
select throws_ok(
  format($$ update public.academy_invite_codes set status = 'replaced', replaced_at = now() where academy_id = %L $$, pg_temp.id('a1')),
  '42501', null, 'the owner cannot update codes directly');
select throws_ok(
  format($$ delete from public.academy_invite_codes where academy_id = %L $$, pg_temp.id('a1')),
  '42501', null, 'the owner cannot delete codes directly');

-- ------------------------------------------------- regenerate: permissions ---
select pg_temp.login(pg_temp.id('i'));
select throws_ok(format($$ select public.regenerate_invite_code(%L, 'student') $$, pg_temp.id('a1')),
  '42501', 'forbidden', 'instructor cannot regenerate the student code');
select throws_ok(format($$ select public.regenerate_invite_code(%L, 'instructor') $$, pg_temp.id('a1')),
  '42501', 'forbidden', 'instructor cannot regenerate the instructor code');
select pg_temp.login(pg_temp.id('s'));
select throws_ok(format($$ select public.regenerate_invite_code(%L, 'student') $$, pg_temp.id('a1')),
  '42501', 'forbidden', 'student cannot regenerate a code');
select pg_temp.login(pg_temp.id('x1'));
select throws_ok(format($$ select public.regenerate_invite_code(%L, 'instructor') $$, pg_temp.id('a1')),
  '42501', 'forbidden', 'an outsider cannot regenerate a code');
select pg_temp.login(pg_temp.id('o2'));
select throws_ok(format($$ select public.regenerate_invite_code(%L, 'student') $$, pg_temp.id('a1')),
  '42501', 'forbidden', 'another academy''s owner cannot regenerate a code');
select pg_temp.login(pg_temp.id('o'));
select throws_ok(format($$ select public.regenerate_invite_code(%L, 'owner') $$, pg_temp.id('a1')),
  '22023', 'invalid_code_type', 'only student and instructor codes can be regenerated');
select pg_temp.logout();
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a1') and status = 'active'),
  2, 'nothing changed after the rejected calls');

-- ------------------------------------------- reusable instructor code + approvals ---
select pg_temp.login(pg_temp.id('x1'));
select is((select status::text || '/' || is_new::text from public.join_with_code(pg_temp.code('a1_instructor'))),
  'pending/true', 'first user joins with the instructor code');
select pg_temp.login(pg_temp.id('x2'));
select is((select status::text || '/' || is_new::text from public.join_with_code(lower(pg_temp.code('a1_instructor')))),
  'pending/true', 'a second user joins with the same instructor code');
select pg_temp.logout();
select is((select array_agg(role::text || '/' || status::text order by user_id) from public.memberships
           where user_id in (pg_temp.id('x1'), pg_temp.id('x2'))),
  array['instructor/pending', 'instructor/pending'], 'both are pending instructors');
select is((select count(*)::int from public.lookup_invite_code(pg_temp.code('a1_instructor'))), 1,
  'the instructor code is not spent');

select pg_temp.login(pg_temp.id('i'));
update public.memberships set status = 'active' where user_id = pg_temp.id('x1');
select pg_temp.logout();
select is((select status::text from public.memberships where user_id = pg_temp.id('x1')),
  'pending', 'an instructor cannot approve a pending instructor');
select pg_temp.login(pg_temp.id('o'));
update public.memberships set status = 'active' where user_id = pg_temp.id('x1');
select pg_temp.logout();
select is((select status::text from public.memberships where user_id = pg_temp.id('x1')),
  'active', 'the owner approves an instructor');

select pg_temp.login(pg_temp.id('x3'));
select is((select status::text || '/' || is_new::text from public.join_with_code(pg_temp.code('a1_student'))),
  'pending/true', 'a user joins with the student code');
select pg_temp.login(pg_temp.id('i'));
update public.memberships set status = 'active' where user_id = pg_temp.id('x3');
select pg_temp.logout();
select is((select role::text || '/' || status::text from public.memberships where user_id = pg_temp.id('x3')),
  'student/active', 'an instructor approves a student');

-- The student code is reusable too.
select pg_temp.login(pg_temp.id('x4'));
select is((select status::text || '/' || is_new::text from public.join_with_code(pg_temp.code('a1_student'))),
  'pending/true', 'the student code works again for another user');
select is((select role::text from public.memberships where user_id = pg_temp.id('x4')),
  'student', 'and the request is a student request');

-- ----------------------------------------------------- regenerate: student ---
select pg_temp.login(pg_temp.id('o'));
insert into t_codes select 'new_student', public.regenerate_invite_code(pg_temp.id('a1'), 'student');
select matches(pg_temp.code('new_student'), '^[A-HJKMNP-Z2-9]{8}$', 'regenerate returns a well-formed code');
select isnt(pg_temp.code('new_student'), pg_temp.code('a1_student'), 'the new student code differs from the old one');
select is((select count(*)::int from public.academy_invite_codes
           where academy_id = pg_temp.id('a1') and code_type = 'student' and status = 'active'),
  1, 'still exactly one active student code');
select is((select code from public.academy_invite_codes
           where academy_id = pg_temp.id('a1') and code_type = 'student' and status = 'active'),
  pg_temp.code('new_student'), 'and it is the new one');
select is((select count(*)::int from public.academy_invite_codes
           where academy_id = pg_temp.id('a1') and code_type = 'student' and status = 'replaced' and replaced_at is not null),
  1, 'the old student code is kept as replaced');
select is((select code from public.academy_invite_codes
           where academy_id = pg_temp.id('a1') and code_type = 'instructor' and status = 'active'),
  pg_temp.code('a1_instructor'), 'the instructor code is untouched');
select pg_temp.logout();
select is((select count(*)::int from public.lookup_invite_code(pg_temp.code('a1_student'))), 0,
  'lookup no longer finds the old student code');
select is((select code_type::text from public.lookup_invite_code(pg_temp.code('new_student'))), 'student',
  'lookup finds the new code, with the right kind');
select pg_temp.login(pg_temp.id('x5'));
select throws_ok(format($$ select public.join_with_code(%L) $$, pg_temp.code('a1_student')),
  'P0002', 'invite_invalid', 'joining with the old student code fails');
select is((select status::text || '/' || is_new::text from public.join_with_code(pg_temp.code('new_student'))),
  'pending/true', 'joining with the new student code works');
select is((select role::text from public.memberships where user_id = pg_temp.id('x5')),
  'student', 'with the student role');
select pg_temp.logout();
select is((select status::text from public.memberships where user_id = pg_temp.id('x4')),
  'pending', 'a request sent with the old code stays pending');

-- --------------------------------------------------- regenerate: instructor ---
select pg_temp.login(pg_temp.id('o'));
insert into t_codes select 'new_instructor', public.regenerate_invite_code(pg_temp.id('a1'), 'instructor');
select pg_temp.logout();
select is((select count(*)::int from public.academy_invite_codes
           where academy_id = pg_temp.id('a1') and code_type = 'instructor' and status = 'active'),
  1, 'still exactly one active instructor code');
select is((select count(*)::int from public.lookup_invite_code(pg_temp.code('a1_instructor'))), 0,
  'the old instructor code stops working');
select is((select code_type::text from public.lookup_invite_code(pg_temp.code('new_instructor'))), 'instructor',
  'the new instructor code works, with the right kind');
select is((select code from public.academy_invite_codes
           where academy_id = pg_temp.id('a1') and code_type = 'student' and status = 'active'),
  pg_temp.code('new_student'), 'the student code is untouched');
select pg_temp.login(pg_temp.id('x2'));
select throws_ok(format($$ select public.join_with_code(%L) $$, pg_temp.code('a1_instructor')),
  'P0002', 'invite_invalid', 'joining with the old instructor code fails');
select pg_temp.logout();
select is((select status::text from public.memberships where user_id = pg_temp.id('x2')),
  'pending', 'the instructor request sent with the old code stays pending');
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a2') and status = 'active'),
  2, 'the other academy keeps its two active codes');
select is((select count(*)::int from public.lookup_invite_code(pg_temp.code('a2_student')))
        + (select count(*)::int from public.lookup_invite_code(pg_temp.code('a2_instructor'))),
  2, 'and both still work');

select * from finish();
rollback;
