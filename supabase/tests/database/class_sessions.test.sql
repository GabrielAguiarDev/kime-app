-- Who taught each class (class_sessions) and classes taught per staff member.
-- Run with: supabase test db
--
-- Academy A1: O owner, I instructor, S and S2 students. Academy A2: O2 owner.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(20);

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
  ('20000000-0000-0000-0000-0000000000a1', 'o@cs.test',  '{"full_name":"Dona"}'),
  ('20000000-0000-0000-0000-0000000000a2', 'i@cs.test',  '{"full_name":"Instrutor"}'),
  ('20000000-0000-0000-0000-0000000000a3', 's@cs.test',  '{"full_name":"Aluno"}'),
  ('20000000-0000-0000-0000-0000000000a4', 's2@cs.test', '{"full_name":"Aluna"}'),
  ('20000000-0000-0000-0000-0000000000b1', 'o2@cs.test', '{"full_name":"Dona Dois"}');
insert into t_ids values
  ('o',  '20000000-0000-0000-0000-0000000000a1'), ('i', '20000000-0000-0000-0000-0000000000a2'),
  ('s',  '20000000-0000-0000-0000-0000000000a3'), ('s2', '20000000-0000-0000-0000-0000000000a4'),
  ('o2', '20000000-0000-0000-0000-0000000000b1');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi CS', array['Jiu-Jitsu']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra CS', array['Judô']));
select pg_temp.logout();

insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('i'),  'instructor', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s'),  'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s2'), 'student', 'active');

-- A class every day of the week, so "today" always has one.
insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id)
select ('30000000-0000-0000-0000-00000000000' || d)::uuid, pg_temp.id('a1'), d, '19:00',
       (select id from public.academy_modalities where academy_id = pg_temp.id('a1'))
from generate_series(0, 6) d;
insert into t_ids values ('today', null);
create function pg_temp.today() returns date language sql as $$
  select private.academy_local_date((select val from t_ids where key = 'a1'))
$$;
create function pg_temp.sched() returns uuid language sql as $$
  select ('30000000-0000-0000-0000-00000000000' || extract(dow from pg_temp.today())::int)::uuid
$$;
grant execute on function pg_temp.today(), pg_temp.sched() to public;

-- Two students check in; nothing is a session until a confirmation.
select pg_temp.login(pg_temp.id('s'));
insert into public.checkins (user_id, academy_id, schedule_id, class_date)
values (pg_temp.id('s'), pg_temp.id('a1'), pg_temp.sched(), pg_temp.today());
select pg_temp.login(pg_temp.id('s2'));
insert into public.checkins (user_id, academy_id, schedule_id, class_date)
values (pg_temp.id('s2'), pg_temp.id('a1'), pg_temp.sched(), pg_temp.today());
select pg_temp.logout();
select is((select count(*)::int from public.class_sessions where academy_id = pg_temp.id('a1')), 0,
  'pending check-ins do not create a session');

-- The instructor confirms both: one session, the owner by default.
select pg_temp.login(pg_temp.id('i'));
update public.checkins set status = 'confirmed' where academy_id = pg_temp.id('a1');
select pg_temp.logout();
select is((select count(*)::int from public.class_sessions where academy_id = pg_temp.id('a1')), 1,
  'confirming creates exactly one session per class');
select is((select instructor_id from public.class_sessions where academy_id = pg_temp.id('a1')), pg_temp.id('o'),
  'the owner is the default instructor');
select is((select modality_id is not null from public.class_sessions where academy_id = pg_temp.id('a1')), true,
  'the session keeps the modality');
insert into t_ids select 'sess', id from public.class_sessions where academy_id = pg_temp.id('a1');

-- Stats.
select pg_temp.login(pg_temp.id('i'));
select is((select classes_taught from public.instructor_class_stats where user_id = pg_temp.id('o') and academy_id = pg_temp.id('a1')), 1,
  'owner taught 1 class');
select is((select classes_taught from public.instructor_class_stats where user_id = pg_temp.id('i')), 0,
  'instructor taught none yet');
select is((select count(*)::int from public.instructor_class_stats where user_id in (pg_temp.id('s'), pg_temp.id('s2'))), 0,
  'students have no classes-taught row');

-- Staff switch the instructor.
update public.class_sessions set instructor_id = pg_temp.id('i') where id = pg_temp.id('sess');
select is((select instructor_id from public.class_sessions where id = pg_temp.id('sess')), pg_temp.id('i'),
  'instructor sets themselves as the class instructor');
select is((select classes_taught from public.instructor_class_stats where user_id = pg_temp.id('i')), 1,
  'the count follows the switch');
select throws_ok(format($$ update public.class_sessions set instructor_id = %L where id = %L $$, pg_temp.id('s'), pg_temp.id('sess')),
  '22023', 'instructor_invalid', 'a student cannot be the instructor');
select throws_ok(format($$ update public.class_sessions set instructor_id = %L where id = %L $$, pg_temp.id('o2'), pg_temp.id('sess')),
  '22023', 'instructor_invalid', 'staff of another academy cannot be the instructor');
select throws_ok(format($$ update public.class_sessions set class_date = '2020-01-01' where id = %L $$, pg_temp.id('sess')),
  '42501', null, 'only the instructor column is writable');
select throws_ok(format($$ insert into public.class_sessions (academy_id, class_date) values (%L, current_date) $$, pg_temp.id('a1')),
  '42501', null, 'clients cannot create sessions');

select pg_temp.login(pg_temp.id('o'));
update public.class_sessions set instructor_id = pg_temp.id('o') where id = pg_temp.id('sess');
select is((select instructor_id from public.class_sessions where id = pg_temp.id('sess')), pg_temp.id('o'),
  'owner switches it back');

-- Students and other academies.
select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.class_sessions), 0, 'students do not read sessions');
update public.class_sessions set instructor_id = pg_temp.id('i') where id = pg_temp.id('sess');
select is((select count(*)::int from public.instructor_class_stats), 0, 'students do not read classes taught');
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.class_sessions), 0, 'another academy owner reads no sessions');
update public.class_sessions set instructor_id = pg_temp.id('o2') where id = pg_temp.id('sess');
select pg_temp.logout();
select is((select instructor_id from public.class_sessions where id = pg_temp.id('sess')), pg_temp.id('o'),
  'neither a student nor another academy can switch the instructor');

-- Deleting the schedule keeps the session and the count.
delete from public.class_schedules where id = pg_temp.sched();
select is((select schedule_id is null from public.class_sessions where id = pg_temp.id('sess')), true,
  'schedule deleted: the session stays, unlinked');
select is((select classes_taught from public.instructor_class_stats where user_id = pg_temp.id('o') and academy_id = pg_temp.id('a1')), 1,
  'and still counts');

select * from finish();
rollback;
