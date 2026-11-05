-- "Marcar presença": staff register a confirmed attendance for a student of their academy.
-- Run with: supabase test db
--
-- A1: owner O, instructor I, students S and S2, pending P. A2: owner O2, student T.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(14);

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
  ('b0000000-0000-0000-0000-000000000001', 'o@at.test',  '{"full_name":"Dona"}'),
  ('b0000000-0000-0000-0000-000000000002', 'i@at.test',  '{"full_name":"Instrutor"}'),
  ('b0000000-0000-0000-0000-000000000003', 's@at.test',  '{"full_name":"Aluno"}'),
  ('b0000000-0000-0000-0000-000000000004', 's2@at.test', '{"full_name":"Aluna"}'),
  ('b0000000-0000-0000-0000-000000000005', 'p@at.test',  '{"full_name":"Pendente"}'),
  ('b0000000-0000-0000-0000-000000000006', 'o2@at.test', '{"full_name":"Outra"}'),
  ('b0000000-0000-0000-0000-000000000007', 't@at.test',  '{"full_name":"Fora"}');
insert into t_ids values
  ('o', 'b0000000-0000-0000-0000-000000000001'), ('i', 'b0000000-0000-0000-0000-000000000002'),
  ('s', 'b0000000-0000-0000-0000-000000000003'), ('s2', 'b0000000-0000-0000-0000-000000000004'),
  ('p', 'b0000000-0000-0000-0000-000000000005'), ('o2', 'b0000000-0000-0000-0000-000000000006'),
  ('t', 'b0000000-0000-0000-0000-000000000007');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi AT', array['Jiu-Jitsu']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra AT', array['Judô']));
select pg_temp.logout();

insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('i'),  'instructor', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s'),  'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s2'), 'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('p'),  'student', 'pending'),
  (pg_temp.id('a2'), pg_temp.id('t'),  'student', 'active');

-- A class every weekday in A1 and A2.
insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id)
select ('c1000000-0000-0000-0000-00000000000' || d)::uuid, pg_temp.id('a1'), d, '19:00',
       (select id from public.academy_modalities where academy_id = pg_temp.id('a1'))
from generate_series(0, 6) d;
insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id)
select ('c2000000-0000-0000-0000-00000000000' || d)::uuid, pg_temp.id('a2'), d, '19:00',
       (select id from public.academy_modalities where academy_id = pg_temp.id('a2'))
from generate_series(0, 6) d;

create function pg_temp.today() returns date language sql as $$
  select private.academy_local_date((select val from t_ids where key = 'a1'))
$$;
create function pg_temp.sched(p_academy text, p_date date) returns uuid language sql as $$
  select ((case p_academy when 'a1' then 'c1' else 'c2' end) || '000000-0000-0000-0000-00000000000'
          || extract(dow from p_date)::int)::uuid
$$;
grant execute on function pg_temp.today(), pg_temp.sched(text, date) to public;

create function pg_temp.mark(p_user text, p_date date, p_academy text default 'a1') returns void language sql as $$
  insert into public.checkins (user_id, academy_id, schedule_id, class_date, status, marked_by)
  values (pg_temp.id(p_user), pg_temp.id(p_academy), pg_temp.sched(p_academy, p_date), p_date, 'confirmed', (select auth.uid()))
$$;
grant execute on function pg_temp.mark(text, date, text) to public;

-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select pg_temp.mark('s', pg_temp.today()) $$, 'the instructor marks a student present today');
select is((select status::text || '/' || (marked_by = pg_temp.id('i'))::text || '/' || (reviewed_by = pg_temp.id('i'))::text
           from public.checkins where user_id = pg_temp.id('s')),
  'confirmed/true/true', 'confirmed, with who marked and who reviewed');
select is((select count(*)::int from public.class_sessions where academy_id = pg_temp.id('a1')),
  1, 'the class becomes a class given');
select throws_ok($$ select pg_temp.mark('s', pg_temp.today()) $$,
  '23505', null, 'the same student is not marked twice in the same class');
select lives_ok($$ select pg_temp.mark('s', pg_temp.today() - 3) $$, 'a past class can be marked');
select throws_ok($$ select pg_temp.mark('s2', pg_temp.today() + 1) $$,
  '42501', null, 'a future class cannot');
select throws_ok($$ select pg_temp.mark('p', pg_temp.today()) $$,
  '42501', null, 'only active students');
select throws_ok($$ select pg_temp.mark('i', pg_temp.today()) $$,
  '42501', null, 'not staff (nor themselves)');
select throws_ok($$ select pg_temp.mark('t', pg_temp.today(), 'a2') $$,
  '42501', null, 'not students of another academy');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date, status, marked_by)
     values (pg_temp.id('s2'), pg_temp.id('a1'), pg_temp.sched('a1', pg_temp.today()), pg_temp.today(), 'confirmed', pg_temp.id('o')) $$,
  '42501', null, 'marked_by is always the one marking');

select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ select pg_temp.mark('s2', pg_temp.today()) $$, 'the owner marks too');

select pg_temp.login(pg_temp.id('s2'));
select throws_ok($$ select pg_temp.mark('s', pg_temp.today() - 1) $$,
  '42501', null, 'students do not mark attendance');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date, marked_by)
     values (pg_temp.id('s2'), pg_temp.id('a1'), pg_temp.sched('a1', pg_temp.today() - 1), pg_temp.today() - 1, pg_temp.id('s2')) $$,
  '42501', null, 'a student cannot fill marked_by in their own check-in');

select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ select pg_temp.mark('s', pg_temp.today() - 2) $$,
  '42501', null, 'staff of another academy cannot mark');

select * from finish();
rollback;
