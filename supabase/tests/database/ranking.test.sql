-- Academy ranking: monthly, per modality, champions, opt-out, access, avatars.
-- Run with: supabase test db
--
-- A1: owner O, students S1, S2, S3. A2: owner O2.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(11);

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
  ('90000000-0000-0000-0000-0000000000a1', 'o@rk.test',  '{"full_name":"Dona"}'),
  ('90000000-0000-0000-0000-0000000000a2', 's1@rk.test', '{"full_name":"Ana"}'),
  ('90000000-0000-0000-0000-0000000000a3', 's2@rk.test', '{"full_name":"Bruno"}'),
  ('90000000-0000-0000-0000-0000000000a4', 's3@rk.test', '{"full_name":"Caio"}'),
  ('90000000-0000-0000-0000-0000000000b1', 'o2@rk.test', '{"full_name":"Outra"}');
insert into t_ids values
  ('o', '90000000-0000-0000-0000-0000000000a1'), ('s1', '90000000-0000-0000-0000-0000000000a2'),
  ('s2', '90000000-0000-0000-0000-0000000000a3'), ('s3', '90000000-0000-0000-0000-0000000000a4'),
  ('o2', '90000000-0000-0000-0000-0000000000b1');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi RK', array['Jiu-Jitsu', 'No-Gi']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra RK', array['Judô']));
select pg_temp.logout();
insert into t_ids select 'jj', id from public.academy_modalities where academy_id = pg_temp.id('a1') and name = 'Jiu-Jitsu';
insert into t_ids select 'ng', id from public.academy_modalities where academy_id = pg_temp.id('a1') and name = 'No-Gi';

insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('s1'), 'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s2'), 'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s3'), 'student', 'active');

-- Confirmed classes (inserted directly as postgres): October and November 2026.
-- S1: Oct 3 JJ; Nov 2 JJ + 1 NG. S2: Oct 1 JJ; Nov 3 NG. S3: Nov 3 JJ (opts out later). Pending ones do not count.
-- modality_id is stamped from the schedule: one schedule per modality.
insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id) values
  ('91000000-0000-0000-0000-000000000001', pg_temp.id('a1'), 1, '19:00', pg_temp.id('jj')),
  ('91000000-0000-0000-0000-000000000002', pg_temp.id('a1'), 1, '20:00', pg_temp.id('ng'));
insert into public.checkins (user_id, academy_id, class_date, status, schedule_id)
select u, pg_temp.id('a1'), d::date, st::public.checkin_status,
       case when md = pg_temp.id('jj') then '91000000-0000-0000-0000-000000000001'::uuid
            else '91000000-0000-0000-0000-000000000002'::uuid end
from (values
  (pg_temp.id('s1'), '2026-10-05', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s1'), '2026-10-06', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s1'), '2026-10-07', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s2'), '2026-10-05', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s1'), '2026-11-02', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s1'), '2026-11-03', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s1'), '2026-11-04', 'confirmed', pg_temp.id('ng')),
  (pg_temp.id('s2'), '2026-11-02', 'confirmed', pg_temp.id('ng')),
  (pg_temp.id('s2'), '2026-11-03', 'confirmed', pg_temp.id('ng')),
  (pg_temp.id('s2'), '2026-11-04', 'confirmed', pg_temp.id('ng')),
  (pg_temp.id('s2'), '2026-11-05', 'pending', pg_temp.id('ng')),
  (pg_temp.id('s3'), '2026-11-02', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s3'), '2026-11-03', 'confirmed', pg_temp.id('jj')),
  (pg_temp.id('s3'), '2026-11-04', 'confirmed', pg_temp.id('jj'))
) v(u, d, st, md);

select pg_temp.login(pg_temp.id('s1'));
select is(
  (select array_agg("position" || ':' || full_name || ':' || classes order by "position", full_name)
   from public.academy_ranking(pg_temp.id('a1'), '2026-11-15')),
  array['1:Ana:3', '1:Bruno:3', '1:Caio:3'],
  'November overall: ties share the position, pending check-ins do not count');
select is(
  (select array_agg("position" || ':' || full_name || ':' || classes order by "position", full_name)
   from public.academy_ranking(pg_temp.id('a1'), '2026-11-01', pg_temp.id('jj'))),
  array['1:Caio:3', '2:Ana:2'],
  'per modality');
select is(
  (select array_agg(full_name || ':' || classes order by "position")
   from public.academy_ranking(pg_temp.id('a1'), '2026-10-31')),
  array['Ana:3', 'Bruno:1'],
  'any day of the month picks the month');

-- Champions: only finished months (today is in the academy calendar; October 2026 is past from November on).
select ok(
  (select bool_and(month < date_trunc('month', private.academy_local_date(pg_temp.id('a1')))::date)
   from public.academy_ranking_champions(pg_temp.id('a1'))) is not false,
  'champions only of finished months');

-- S3 opts out.
select pg_temp.login(pg_temp.id('s3'));
update public.profiles set show_in_ranking = false where id = pg_temp.id('s3');
select pg_temp.login(pg_temp.id('s1'));
select is(
  (select array_agg(full_name order by full_name) from public.academy_ranking(pg_temp.id('a1'), '2026-11-15')),
  array['Ana', 'Bruno'],
  'a student who opted out is not listed');
select is(private.is_ranked_classmate(pg_temp.id('s2')), true, 'a ranked classmate''s photo is readable');
select is(private.is_ranked_classmate(pg_temp.id('s3')), false, 'an opted-out classmate''s photo is not');

select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ select * from public.academy_ranking(pg_temp.id('a1'), '2026-11-01') $$,
  '42501', 'forbidden', 'outsiders do not read the ranking');
select throws_ok($$ select * from public.academy_ranking_champions(pg_temp.id('a1')) $$,
  '42501', 'forbidden', 'nor the champions');
select is(private.is_ranked_classmate(pg_temp.id('s1')), false, 'outsiders do not see the photos');

select pg_temp.login(pg_temp.id('o'));
select is((select count(*)::int from public.academy_ranking(pg_temp.id('a1'), '2026-11-01')), 2, 'staff read the ranking');

select * from finish();
rollback;
