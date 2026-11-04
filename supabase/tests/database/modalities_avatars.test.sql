-- Modalities, per-modality belts, students-only check-ins, fixed time zone,
-- join_with_code.is_new and profile avatars. Run with: supabase test db
--
-- Academy A1: O owner, I instructor, S and S2 active students, PS pending
-- student, PI pending instructor. Academy A2: O2 owner, S3 student.
-- X belongs to no academy.
begin;
-- Hosted runs log in with a CLI role: act as the schema owner, like migrations do.
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- The hosted test runner may install pgTAP in its own schema: find it.
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(143);

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

-- Modality (by name) / belt (by primary color and optional tip) of academy A1.
create function pg_temp.modality(p_name text) returns uuid language sql as $$
  select m.id from public.academy_modalities m
  where m.academy_id = (select val from t_ids where key = 'a1') and m.name = p_name
$$;
create function pg_temp.belt(p_modality text, p_primary text, p_tip text default null) returns uuid language sql as $$
  select b.id from public.modality_belts b
  where b.modality_id = pg_temp.modality(p_modality) and b.primary_color = p_primary
    and b.tip_color is not distinct from p_tip
$$;
create function pg_temp.membership(p_user text) returns uuid language sql as $$
  select m.id from public.memberships m
  where m.academy_id = (select val from t_ids where key = 'a1')
    and m.user_id = (select val from t_ids where key = p_user)
$$;
grant execute on function pg_temp.modality(text), pg_temp.belt(text, text, text), pg_temp.membership(text) to public;

-- ------------------------------------------------------------------ users ---
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-0000000000a1', 'o@kimi.test',  '{"full_name":"Dona"}'),
  ('10000000-0000-0000-0000-0000000000a2', 'i@kimi.test',  '{"full_name":"Instrutor"}'),
  ('10000000-0000-0000-0000-0000000000a3', 's@kimi.test',  '{"full_name":"Aluno"}'),
  ('10000000-0000-0000-0000-0000000000a4', 's2@kimi.test', '{"full_name":"Aluna"}'),
  ('10000000-0000-0000-0000-0000000000a5', 'ps@kimi.test', '{"full_name":"Aluno Pendente"}'),
  ('10000000-0000-0000-0000-0000000000a6', 'pi@kimi.test', '{"full_name":"Instrutor Pendente"}'),
  ('10000000-0000-0000-0000-0000000000b1', 'o2@kimi.test', '{"full_name":"Dona Dois"}'),
  ('10000000-0000-0000-0000-0000000000b2', 's3@kimi.test', '{"full_name":"Aluno Tres"}'),
  ('10000000-0000-0000-0000-0000000000ff', 'x@kimi.test',  '{}'),
  ('10000000-0000-0000-0000-0000000000c1', 'n@kimi.test',  '{}');
insert into t_ids values
  ('o',  '10000000-0000-0000-0000-0000000000a1'), ('i',  '10000000-0000-0000-0000-0000000000a2'),
  ('s',  '10000000-0000-0000-0000-0000000000a3'), ('s2', '10000000-0000-0000-0000-0000000000a4'),
  ('ps', '10000000-0000-0000-0000-0000000000a5'), ('pi', '10000000-0000-0000-0000-0000000000a6'),
  ('o2', '10000000-0000-0000-0000-0000000000b1'), ('s3', '10000000-0000-0000-0000-0000000000b2'),
  ('x',  '10000000-0000-0000-0000-0000000000ff'), ('n',  '10000000-0000-0000-0000-0000000000c1');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi', array['Jiu-Jitsu', 'Muay Thai', 'Yoga']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra', array['Judô']));
select pg_temp.logout();

insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('i'),  'instructor', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s'),  'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s2'), 'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('ps'), 'student', 'pending'),
  (pg_temp.id('a1'), pg_temp.id('pi'), 'instructor', 'pending'),
  (pg_temp.id('a2'), pg_temp.id('s3'), 'student', 'active');

insert into t_ids select 'a2m', id from public.academy_modalities where academy_id = pg_temp.id('a2');

-- Yoga only counts classes: no belts.
select pg_temp.login(pg_temp.id('o'));
update public.academy_modalities set uses_belts = false where id = pg_temp.modality('Yoga');
select pg_temp.logout();
select is((select uses_belts from public.academy_modalities where id = pg_temp.modality('Yoga')), false,
  'owner turns off belts on a modality');
select is((select uses_belts from public.academy_modalities where id = pg_temp.modality('Jiu-Jitsu')), true,
  'modalities use belts by default');

-- Belts: Jiu-Jitsu and Muay Thai of A1 (owner), Judô of A2.
select pg_temp.login(pg_temp.id('o'));
insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required) values
  (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'white', null, 0, 10),
  (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'blue', null, 1, 20),
  (pg_temp.id('a1'), pg_temp.modality('Muay Thai'), 'yellow', null, 0, 5),
  (pg_temp.id('a1'), pg_temp.modality('Muay Thai'), 'orange', null, 1, 8);
select pg_temp.login(pg_temp.id('o2'));
insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a2'), pg_temp.id('a2m'), 'white', null, 0, 10);
select pg_temp.logout();
insert into t_ids select 'a2belt', id from public.modality_belts where academy_id = pg_temp.id('a2');

-- ------------------------------------------------- modality / belt writes ---
-- Instructor: reads, never writes.
select pg_temp.login(pg_temp.id('i'));
select is((select count(*)::int from public.modality_belts), 4, 'instructor reads the academy belts');
select throws_ok($$ insert into public.academy_modalities (academy_id, name) values (pg_temp.id('a1'), 'Boxe') $$,
  '42501', null, 'instructor cannot add a modality');
update public.academy_modalities set name = 'Hackeada', uses_belts = false where id = pg_temp.modality('Jiu-Jitsu');
delete from public.academy_modalities where id = pg_temp.modality('Yoga');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'purple', null, 2, 30) $$,
  '42501', null, 'instructor cannot add a belt');
update public.modality_belts set primary_color = 'red', tip_color = 'black', classes_required = 1 where modality_id = pg_temp.modality('Jiu-Jitsu');
delete from public.modality_belts where modality_id = pg_temp.modality('Jiu-Jitsu');
select public.reorder_modality_belts(pg_temp.modality('Jiu-Jitsu'), array[pg_temp.belt('Jiu-Jitsu', 'blue'), pg_temp.belt('Jiu-Jitsu', 'white')]);
select pg_temp.logout();
select is((select name || '/' || uses_belts::text from public.academy_modalities where id = pg_temp.modality('Jiu-Jitsu')),
  'Jiu-Jitsu/true', 'instructor cannot rename a modality or change uses_belts');
select is((select count(*)::int from public.academy_modalities where id = pg_temp.modality('Yoga')), 1,
  'instructor cannot delete a modality');
select is((select string_agg(primary_color || coalesce('/' || tip_color, '') || ':' || classes_required, ',' order by position) from public.modality_belts
           where modality_id = pg_temp.modality('Jiu-Jitsu')),
  'white:10,blue:20', 'instructor cannot recolor, delete or reorder belts');

-- Student: same.
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ insert into public.academy_modalities (academy_id, name) values (pg_temp.id('a1'), 'Boxe') $$,
  '42501', null, 'student cannot add a modality');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'purple', null, 2, 30) $$,
  '42501', null, 'student cannot add a belt');
update public.modality_belts set primary_color = 'red', tip_color = 'black' where modality_id = pg_temp.modality('Jiu-Jitsu');
delete from public.modality_belts where modality_id = pg_temp.modality('Jiu-Jitsu');
update public.academy_modalities set name = 'Hackeada' where id = pg_temp.modality('Jiu-Jitsu');
delete from public.academy_modalities where id = pg_temp.modality('Yoga');
select public.reorder_modality_belts(pg_temp.modality('Jiu-Jitsu'), array[pg_temp.belt('Jiu-Jitsu', 'blue'), pg_temp.belt('Jiu-Jitsu', 'white')]);
select is((select count(*)::int from public.modality_belts), 4, 'student reads the academy belts');
select pg_temp.logout();
select is((select string_agg(primary_color || coalesce('/' || tip_color, ''), ',' order by position) from public.modality_belts where modality_id = pg_temp.modality('Jiu-Jitsu'))
          || '/' || (select count(*)::int from public.academy_modalities where academy_id = pg_temp.id('a1')),
  'white,blue/3', 'student cannot recolor, delete or reorder belts or rename modalities');

-- Another academy's owner touches nothing here either.
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.modality_belts where academy_id = pg_temp.id('a1')), 0,
  'owner of another academy reads no belts');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'purple', null, 2, 30) $$,
  '42501', null, 'owner of another academy cannot add belts here');
select pg_temp.logout();

-- Owner.
select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ insert into public.academy_modalities (academy_id, name, position) values (pg_temp.id('a1'), 'Boxe', 5) $$,
  'owner adds a modality');
select lives_ok($$ update public.academy_modalities set name = 'Boxe Tailandês' where name = 'Boxe' and academy_id = pg_temp.id('a1') $$,
  'owner renames a modality');
select lives_ok($$ delete from public.academy_modalities where name = 'Boxe Tailandês' and academy_id = pg_temp.id('a1') $$,
  'owner deletes a modality without schedules');
select is((select count(*)::int from public.academy_modalities where academy_id = pg_temp.id('a1')), 3, 'the new modality is gone');
select lives_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'purple', 'black', 2, 30) $$,
  'owner adds a belt with a tip');
select is((select primary_color || '/' || tip_color from public.modality_belts where modality_id = pg_temp.modality('Jiu-Jitsu') and position = 2),
  'purple/black', 'primary and tip stored as palette keys');
select lives_ok($$ update public.modality_belts set primary_color = 'brown', tip_color = 'red', classes_required = 40
  where id = pg_temp.belt('Jiu-Jitsu', 'purple', 'black') $$, 'owner edits a belt');
select lives_ok(
  $$ select public.reorder_modality_belts(pg_temp.modality('Jiu-Jitsu'), array[
       pg_temp.belt('Jiu-Jitsu', 'brown', 'red'), pg_temp.belt('Jiu-Jitsu', 'white'), pg_temp.belt('Jiu-Jitsu', 'blue')]) $$,
  'owner reorders belts');
select is((select string_agg(primary_color || coalesce('/' || tip_color, ''), ',' order by position) from public.modality_belts where modality_id = pg_temp.modality('Jiu-Jitsu')),
  'brown/red,white,blue', 'new order persisted');
select throws_ok($$ select public.reorder_modality_belts(pg_temp.modality('Jiu-Jitsu'), array[pg_temp.belt('Jiu-Jitsu', 'blue')]) $$,
  '22023', 'belt_order_incomplete', 'reorder must list every belt');
select lives_ok($$ delete from public.modality_belts where id = pg_temp.belt('Jiu-Jitsu', 'brown', 'red') $$,
  'owner deletes an unused belt');

-- Validation.
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Yoga'), 'white', null, 0, 10) $$,
  '42501', null, 'owner cannot add a belt to a modality without belts');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'verde', null, 5, 10) $$,
  '23514', null, 'primary color must be a palette key (unknown name)');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), '#2E9E4F', null, 5, 10) $$,
  '23514', null, 'primary color must be a palette key (hex rejected)');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'Green', null, 5, 10) $$,
  '23514', null, 'primary color keys are lower-case');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'green', 'pink', 5, 10) $$,
  '23514', null, 'tip color must be a palette key');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'green', 'green', 5, 10) $$,
  '23514', null, 'tip cannot equal the primary color');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'green', null, 5, 0) $$,
  '23514', null, 'classes_required must be at least 1');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'green', null, 5, 10001) $$,
  '23514', null, 'classes_required is capped at 10000');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'black', 5, 10) $$,
  '23502', null, 'primary_color is required');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'white', null, 5, 10) $$,
  '23505', null, 'a belt combination without tip is unique per modality');
select lives_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'white', 'black', 6, 10) $$,
  'same primary color with a different tip is allowed');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'white', 'black', 7, 10) $$,
  '23505', null, 'a belt combination with tip is unique per modality');
select lives_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'white', 'red', 8, null) $$,
  'classes_required may be null (entry belt)');
-- The unique position is deferred (swaps), so it is only checked on demand/commit.
select throws_ok($$ do $b$ begin
    insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
      values (pg_temp.id('a1'), pg_temp.modality('Jiu-Jitsu'), 'green', null, 1, 10);
    set constraints modality_belts_position_key immediate;
  end $b$ $$,
  '23505', null, 'belt positions are unique per modality');
select lives_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Muay Thai'), 'blue', null, 2, 10) $$,
  'the same belt combination can exist in another modality');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a2'), pg_temp.modality('Jiu-Jitsu'), 'green', null, 5, 10) $$,
  '42501', null, 'a belt cannot claim another academy for a modality');
select pg_temp.logout();

-- ------------------------------------------------------- class statistics ---
-- Academy-local dates only ("today" in America/Sao_Paulo): the award sits at
-- 23:30 local, which is already the NEXT day in UTC, so a UTC-based "day of the
-- award" would count one class too many.
create temp table t_today on commit drop as select private.academy_local_date(pg_temp.id('a1')) as d;
create function pg_temp.d(p_offset int) returns date language sql as $$ select d + p_offset from t_today $$;
grant execute on function pg_temp.d(int) to public;
grant select on t_today to authenticated;

insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id) values
  ('10000000-0000-0000-0001-00000000000a', pg_temp.id('a1'), 0, '19:00', pg_temp.modality('Jiu-Jitsu')),
  ('10000000-0000-0000-0001-00000000000b', pg_temp.id('a1'), 0, '19:00', pg_temp.modality('Muay Thai')),
  ('10000000-0000-0000-0001-00000000000c', pg_temp.id('a1'), extract(dow from pg_temp.d(0)), '19:00', pg_temp.modality('Jiu-Jitsu')),
  ('10000000-0000-0000-0002-00000000000a', pg_temp.id('a2'), 0, '19:00', pg_temp.id('a2m'));

-- S in Jiu-Jitsu (A): 6 confirmed (-10 -8 -5 -4 -3 -2), 1 pending (-1), 1 rejected (-7).
-- S in Muay Thai (B): 3 confirmed (-9 -4 -1).
insert into public.checkins (user_id, academy_id, schedule_id, class_date, status)
select pg_temp.id('s'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000a', pg_temp.d(o), st::public.checkin_status
from (values (-10, 'confirmed'), (-8, 'confirmed'), (-5, 'confirmed'), (-4, 'confirmed'), (-3, 'confirmed'), (-2, 'confirmed'),
             (-1, 'pending'), (-7, 'rejected')) v (o, st);
insert into public.checkins (user_id, academy_id, schedule_id, class_date, status)
select pg_temp.id('s'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000b', pg_temp.d(o), 'confirmed'
from (values (-9), (-4), (-1)) v (o);

select is((select modality_id from public.checkins where schedule_id = '10000000-0000-0000-0001-00000000000b' limit 1),
  pg_temp.modality('Muay Thai'), 'the trigger stamps checkins.modality_id from the schedule (insert as postgres too)');

create function pg_temp.stats(p_user text, p_modality text) returns text language sql as $$
  select confirmed_total || '/' || confirmed_since_belt || '/' || coalesce(
    (select b.primary_color || coalesce('/' || b.tip_color, '') from public.modality_belts b where b.id = s.belt_id), '-')
  from public.modality_class_stats s
  where s.membership_id = pg_temp.membership(p_user) and s.modality_id = pg_temp.modality(p_modality)
$$;
grant execute on function pg_temp.stats(text, text) to public;

select is(pg_temp.stats('s', 'Jiu-Jitsu') || ' ' || pg_temp.stats('s', 'Muay Thai') || ' ' || pg_temp.stats('s', 'Yoga'),
  '6/6/- 3/3/- 0/0/-', 'no belt yet: every confirmed class counts, pending and rejected never do');
select is((select confirmed_total from public.membership_class_stats where membership_id = pg_temp.membership('s')),
  9, 'membership_class_stats sums every modality');

-- Award in Jiu-Jitsu at -5 23:30 (local): only classes AFTER that day count.
insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s'), pg_temp.belt('Jiu-Jitsu', 'white'));
update public.belt_history set awarded_at = ((pg_temp.d(-5) + time '23:30') at time zone 'America/Sao_Paulo')
  where membership_id = pg_temp.membership('s');
select is(pg_temp.stats('s', 'Jiu-Jitsu'), '6/3/white',
  'since the belt: only classes after the award''s local day (the award day and the UTC-next-day trap are handled)');
select is(pg_temp.stats('s', 'Muay Thai'), '3/3/-', 'an award in one modality does not touch another');
select is((select confirmed_total from public.membership_class_stats where membership_id = pg_temp.membership('s')),
  9, 'the academy total is unaffected by belts');

-- Award in Muay Thai at -4: A stays the same.
insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s'), pg_temp.belt('Muay Thai', 'yellow'));
update public.belt_history set awarded_at = ((pg_temp.d(-4) + time '12:00') at time zone 'America/Sao_Paulo')
  where membership_id = pg_temp.membership('s') and belt_id = pg_temp.belt('Muay Thai', 'yellow');
select is(pg_temp.stats('s', 'Muay Thai') || ' ' || pg_temp.stats('s', 'Jiu-Jitsu'), '3/1/yellow 6/3/white',
  'each modality counts from its own last award');

-- A later award in Jiu-Jitsu replaces the previous one as the reference.
insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s'), pg_temp.belt('Jiu-Jitsu', 'blue'));
update public.belt_history set awarded_at = ((pg_temp.d(-3) + time '12:00') at time zone 'America/Sao_Paulo')
  where membership_id = pg_temp.membership('s') and belt_id = pg_temp.belt('Jiu-Jitsu', 'blue');
select is(pg_temp.stats('s', 'Jiu-Jitsu') || ' ' || pg_temp.stats('s', 'Muay Thai'), '6/1/blue 3/1/yellow',
  'the latest award in the modality is the reference, other modality unchanged');
select is(pg_temp.stats('s2', 'Jiu-Jitsu') || ' ' || pg_temp.stats('s2', 'Muay Thai'), '0/0/- 0/0/-',
  'a student without classes has zero rows counted but a row per modality');
select is((select count(*)::int from public.modality_class_stats where membership_id = pg_temp.membership('s')), 3,
  'one stats row per modality (including modalities without belts)');
select is((select count(*)::int from public.modality_class_stats where user_id in (pg_temp.id('o'), pg_temp.id('i')))
        + (select count(*)::int from public.membership_class_stats where user_id in (pg_temp.id('o'), pg_temp.id('i'))),
  0, 'owners and instructors have no stats rows (students only)');

select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.modality_class_stats), 3, 'student reads only own modality stats');
select is((select count(*)::int from public.membership_class_stats), 1, 'student reads only own total');
select pg_temp.login(pg_temp.id('s2'));
select is((select sum(confirmed_total)::int from public.modality_class_stats), 0, 'another student reads own (empty) stats, not S''s');
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.modality_class_stats where academy_id = pg_temp.id('a1')), 0,
  'other academy owner reads no stats');
select pg_temp.login(pg_temp.id('i'));
select is((select confirmed_since_belt from public.modality_class_stats
           where membership_id = pg_temp.membership('s') and modality_id = pg_temp.modality('Jiu-Jitsu')),
  1, 'instructor reads the student''s stats');
select pg_temp.logout();

-- Belt history is anchored to the belt's modality; belts with awards stay.
select is((select string_agg(modality_id::text, ',') from public.belt_history where belt_id = pg_temp.belt('Muay Thai', 'yellow')),
  pg_temp.modality('Muay Thai')::text, 'belt_history.modality_id is stamped from the belt');
select pg_temp.login(pg_temp.id('o'));
select throws_ok($$ delete from public.modality_belts where id = pg_temp.belt('Jiu-Jitsu', 'white') $$,
  '23503', null, 'a belt that was awarded cannot be deleted');

-- ----------------------------------------- schedules, modalities and FKs ---
select throws_ok($$ insert into public.class_schedules (academy_id, weekday, start_time, modality_id)
  values (pg_temp.id('a1'), 1, '08:00', pg_temp.id('a2m')) $$,
  '23503', null, 'a schedule cannot point at another academy''s modality');
select throws_ok($$ update public.class_schedules set modality_id = pg_temp.id('a2m')
  where id = '10000000-0000-0000-0001-00000000000a' $$,
  '23503', null, 'a schedule cannot be moved to another academy''s modality');
select throws_ok($$ insert into public.class_schedules (academy_id, weekday, start_time) values (pg_temp.id('a1'), 1, '08:00') $$,
  '23502', null, 'a schedule needs a modality');
select throws_ok($$ delete from public.academy_modalities where id = pg_temp.modality('Jiu-Jitsu') $$,
  '23503', null, 'a modality with schedules cannot be deleted');
select is((select count(*)::int from public.academy_modalities where id = pg_temp.modality('Jiu-Jitsu')), 1,
  'the modality is still there');

-- Deleting a modality without schedules keeps the check-ins (modality nulled, still counted).
select pg_temp.logout();
insert into public.academy_modalities (id, academy_id, name, position) values
  ('10000000-0000-0000-0003-000000000001', pg_temp.id('a1'), 'Boxe', 9);
insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id) values
  ('10000000-0000-0000-0001-00000000000d', pg_temp.id('a1'), 0, '19:00', '10000000-0000-0000-0003-000000000001');
insert into public.checkins (user_id, academy_id, schedule_id, class_date, status) values
  (pg_temp.id('s'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000d', pg_temp.d(-20), 'confirmed');
select is((select modality_id from public.checkins where schedule_id = '10000000-0000-0000-0001-00000000000d'),
  '10000000-0000-0000-0003-000000000001'::uuid, 'check-in stamped with the Boxe modality');
select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ delete from public.class_schedules where id = '10000000-0000-0000-0001-00000000000d' $$,
  'owner deletes the Boxe schedule');
select lives_ok($$ delete from public.academy_modalities where id = '10000000-0000-0000-0003-000000000001' $$,
  'owner then deletes the Boxe modality');
select pg_temp.logout();
select is((select count(*)::int || '/' || count(modality_id)::int from public.checkins
           where user_id = pg_temp.id('s') and class_date = pg_temp.d(-20)),
  '1/0', 'the check-in survived with modality_id null');
select is((select confirmed_total from public.membership_class_stats where membership_id = pg_temp.membership('s')),
  10, 'and it still counts in the academy total');
select is(pg_temp.stats('s', 'Jiu-Jitsu') || ' ' || pg_temp.stats('s', 'Muay Thai'), '6/1/blue 3/1/yellow',
  'but in no modality row');

-- --------------------------------------------------- students-only check-in ---
-- Today's class (weekday of the academy-local date) in Jiu-Jitsu.
select pg_temp.login(pg_temp.id('o'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('o'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000c', pg_temp.d(0)) $$,
  '42501', null, 'the owner cannot check in');
select pg_temp.login(pg_temp.id('i'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('i'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000c', pg_temp.d(0)) $$,
  '42501', null, 'an instructor cannot check in');
select pg_temp.login(pg_temp.id('ps'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('ps'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000c', pg_temp.d(0)) $$,
  '42501', null, 'a pending student cannot check in');
select pg_temp.login(pg_temp.id('s3'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('s3'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000c', pg_temp.d(0)) $$,
  '42501', null, 'a student of another academy cannot check in');
select pg_temp.login(pg_temp.id('s2'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date, modality_id)
     values (pg_temp.id('s2'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000c', pg_temp.d(0), pg_temp.modality('Muay Thai')) $$,
  '42501', null, 'the client cannot set modality_id');
select lives_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('s2'), pg_temp.id('a1'), '10000000-0000-0000-0001-00000000000c', pg_temp.d(0)) $$,
  'an active student checks in to today''s class');
select pg_temp.logout();
select is((select modality_id from public.checkins where user_id = pg_temp.id('s2')), pg_temp.modality('Jiu-Jitsu'),
  'the trigger stamps the modality of the schedule on a client check-in');
-- The stamp is a snapshot: moving the schedule does not rewrite history.
update public.class_schedules set modality_id = pg_temp.modality('Muay Thai') where id = '10000000-0000-0000-0001-00000000000c';
select is((select modality_id from public.checkins where user_id = pg_temp.id('s2')), pg_temp.modality('Jiu-Jitsu'),
  'moving the schedule to another modality keeps the check-in''s modality');
update public.class_schedules set modality_id = pg_temp.modality('Jiu-Jitsu') where id = '10000000-0000-0000-0001-00000000000c';

-- ------------------------------------------------------------ belt awards ---
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s2'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  'an instructor awards a belt to an active student');
select is((select awarded_by from public.belt_history where membership_id = pg_temp.membership('s2')), pg_temp.id('i'),
  'stamped with the instructor');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('o'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  '42501', null, 'an instructor cannot award a belt to the owner');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('i'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  '42501', null, 'an instructor cannot award a belt to themselves');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('ps'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  '42501', null, 'nobody awards a belt to a pending student');
select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s2'), pg_temp.belt('Muay Thai', 'yellow')) $$,
  'the owner awards a belt in another modality');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('i'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  '42501', null, 'the owner cannot award a belt to an instructor');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('pi'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  '42501', null, 'nobody awards a belt to a pending instructor');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id)
  values (pg_temp.membership('s'), pg_temp.id('a2belt')) $$,
  '42501', null, 'a belt from another academy cannot be awarded (by the student''s own owner)');
select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ insert into public.belt_history (membership_id, belt_id)
  values (pg_temp.membership('s'), pg_temp.id('a2belt')) $$,
  '42501', null, 'staff of another academy cannot award its belt to this academy''s student');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s'), pg_temp.belt('Jiu-Jitsu', 'white')) $$,
  '42501', null, 'nor award this academy''s belt to its student');
select lives_ok($$ insert into public.belt_history (membership_id, belt_id)
  select m.id, pg_temp.id('a2belt')
  from public.memberships m where m.user_id = pg_temp.id('s3') $$,
  'positive control: an owner awards own belt to own student');
-- Staff of BOTH academies sees both belt sets: the belt must still belong to the student's academy.
select pg_temp.logout();
insert into public.memberships (academy_id, user_id, role, status) values (pg_temp.id('a2'), pg_temp.id('i'), 'instructor', 'active');
select pg_temp.login(pg_temp.id('i'));
select is((select count(*)::int from public.modality_belts where id = pg_temp.id('a2belt')), 1, 'precondition: this instructor reads the other academy''s belt');
select throws_ok($$ insert into public.belt_history (membership_id, belt_id) values (pg_temp.membership('s'), pg_temp.id('a2belt')) $$,
  '42501', null, 'a visible belt of another academy is still rejected for this academy''s student');
select pg_temp.logout();
delete from public.memberships where academy_id = pg_temp.id('a2') and user_id = pg_temp.id('i');
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ insert into public.belt_history (membership_id, belt_id, modality_id) values (pg_temp.membership('s'), pg_temp.belt('Jiu-Jitsu', 'white'), pg_temp.modality('Jiu-Jitsu')) $$,
  '42501', null, 'the client cannot set belt_history.modality_id');
select pg_temp.logout();

-- --------------------------------------------------------------- timezone ---
select is((select timezone from public.academies where id = pg_temp.id('a1')), 'America/Sao_Paulo',
  'new academies are created in America/Sao_Paulo');
select ok(not has_column_privilege('authenticated', 'public.academies', 'timezone', 'update'),
  'authenticated has no UPDATE on academies.timezone');
select pg_temp.login(pg_temp.id('o'));
select throws_ok($$ update public.academies set timezone = 'Pacific/Kiritimati' where id = pg_temp.id('a1') $$,
  '42501', null, 'the owner cannot change the academy time zone');
select lives_ok($$ update public.academies set name = 'Kimi Renomeada' where id = pg_temp.id('a1') $$,
  'the owner still edits the name (only the timezone grant is gone)');
select pg_temp.logout();
select is((select timezone from public.academies where id = pg_temp.id('a1')), 'America/Sao_Paulo', 'time zone unchanged');

-- ---------------------------------------------------------------- avatars ---
select ok((select not public from storage.buckets where id = 'avatars'), 'the avatars bucket is private');

-- One object per user, set up as postgres: <uid>/avatar-1.jpg
insert into storage.objects (bucket_id, name, owner_id)
select 'avatars', val::text || '/avatar-1.jpg', val::text
from t_ids where key in ('s', 's2', 'ps', 'pi', 'i', 's3');

-- Keys of the users whose avatar the caller can see.
create function pg_temp.seen() returns text language sql as $$
  select string_agg(k.key, ',' order by k.key)
  from t_ids k
  join storage.objects o on o.bucket_id = 'avatars' and o.name = k.val::text || '/avatar-1.jpg'
$$;
grant execute on function pg_temp.seen() to public;

select pg_temp.login(pg_temp.id('s'));
select is(pg_temp.seen(), 's', 'a student sees only own avatar (not the same academy''s other student)');
select pg_temp.login(pg_temp.id('s2'));
select is(pg_temp.seen(), 's2', 'the other student sees only own avatar');
select pg_temp.login(pg_temp.id('o'));
select is(pg_temp.seen(), 'i,pi,ps,s,s2', 'the owner sees every member and requester of the academy, no one from another academy');
select pg_temp.login(pg_temp.id('i'));
select is(pg_temp.seen(), 'i,ps,s,s2', 'an instructor sees students (also pending ones) and staff, not a pending instructor requester');
select pg_temp.login(pg_temp.id('pi'));
select is(pg_temp.seen(), 'pi', 'a pending instructor is not staff yet: sees only own avatar');
select pg_temp.login(pg_temp.id('ps'));
select is(pg_temp.seen(), 'ps', 'a pending student sees only own avatar');
select pg_temp.login(pg_temp.id('o2'));
select is(pg_temp.seen(), 's3', 'staff of another academy sees only own academy''s avatars');
select pg_temp.login(pg_temp.id('x'));
select is(pg_temp.seen(), null, 'a user without academy sees no avatar');
select pg_temp.as_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'anon sees no avatar');
select pg_temp.logout();

-- Writes: only inside the user's own folder.
select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('avatars', pg_temp.id('s')::text || '/avatar-2.jpg', pg_temp.id('s')::text) $$,
  'a user uploads into own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('avatars', pg_temp.id('s2')::text || '/avatar-2.jpg', pg_temp.id('s')::text) $$,
  '42501', null, 'a user cannot upload into another user''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('avatars', 'avatar.jpg', pg_temp.id('s')::text) $$,
  '42501', null, 'a file outside any user folder is rejected');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('avatars', 'not-a-uuid/avatar.jpg', pg_temp.id('s')::text) $$,
  '42501', null, 'a non-uuid folder is rejected');
select lives_ok($$ update storage.objects set metadata = '{"v":2}'
  where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-2.jpg' $$,
  'a user replaces a file of own folder');
select throws_ok($$ update storage.objects set name = pg_temp.id('s2')::text || '/moved.jpg'
  where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-2.jpg' $$,
  '42501', null, 'a user cannot move a file into another user''s folder');
update storage.objects set metadata = '{"hijacked":true}'
  where bucket_id = 'avatars' and name = pg_temp.id('s2')::text || '/avatar-1.jpg';
-- Direct deletes from storage tables need the Storage API's escape hatch.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s2')::text || '/avatar-1.jpg';
select lives_ok($$ delete from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-2.jpg' $$,
  'a user deletes a file of own folder');

select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('avatars', pg_temp.id('s')::text || '/avatar-3.jpg', pg_temp.id('i')::text) $$,
  '42501', null, 'an instructor cannot upload into a student''s folder');
update storage.objects set metadata = '{"hijacked":true}'
  where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-1.jpg';
delete from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-1.jpg';
select pg_temp.login(pg_temp.id('o'));
update storage.objects set metadata = '{"hijacked":true}'
  where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-1.jpg';
delete from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-1.jpg';
select pg_temp.logout();
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s2')::text || '/avatar-1.jpg'
             and metadata is null), 1, 'another user''s file was neither replaced nor deleted by the student');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-1.jpg'
             and metadata is null), 1, 'staff can read but neither replace nor delete a member''s file');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = pg_temp.id('s')::text || '/avatar-2.jpg'), 0,
  'the own file the student deleted is gone');

-- profiles.avatar_path
select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ update public.profiles set avatar_path = pg_temp.id('s')::text || '/avatar-1.jpg' where id = pg_temp.id('s') $$,
  'a user sets own avatar_path');
select throws_ok($$ update public.profiles set avatar_path = pg_temp.id('s2')::text || '/avatar-1.jpg' where id = pg_temp.id('s') $$,
  '23514', null, 'avatar_path cannot point into another user''s folder');
select throws_ok($$ update public.profiles set avatar_path = 'avatar-1.jpg' where id = pg_temp.id('s') $$,
  '23514', null, 'avatar_path needs the user folder');
select throws_ok($$ update public.profiles set avatar_path = pg_temp.id('s')::text || '/a b.jpg' where id = pg_temp.id('s') $$,
  '23514', null, 'avatar_path rejects unsafe characters');
select throws_ok($$ update public.profiles set avatar_path = pg_temp.id('s')::text || '/x/y.jpg' where id = pg_temp.id('s') $$,
  '23514', null, 'avatar_path rejects nested folders');
select throws_ok($$ update public.profiles set avatar_path = pg_temp.id('s')::text || '/' where id = pg_temp.id('s') $$,
  '23514', null, 'avatar_path needs a file name');
select pg_temp.login(pg_temp.id('o'));
update public.profiles set avatar_path = null where id = pg_temp.id('s');
select pg_temp.logout();
select is((select avatar_path from public.profiles where id = pg_temp.id('s')), pg_temp.id('s')::text || '/avatar-1.jpg',
  'staff cannot change a member''s avatar_path');
select throws_ok($$ update public.profiles set avatar_path = pg_temp.id('s2')::text || '/avatar-1.jpg' where id = pg_temp.id('s') $$,
  '23514', null, 'the constraint holds even for the schema owner');
select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ update public.profiles set avatar_path = null where id = pg_temp.id('s') $$, 'a user removes own avatar_path');
select pg_temp.logout();

-- ---------------------------------------------------------- join_with_code ---
create temp table t_codes on commit drop as select id, invite_code from public.academies;
grant select on t_codes to authenticated;
create temp table t_pcodes (key text primary key, id uuid, code text) on commit drop;
grant all on t_pcodes to authenticated;

select pg_temp.login(pg_temp.id('n'));
select is((select status::text || '/' || is_new::text from public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  'pending/true', 'first request with the student code is new');
select is((select status::text || '/' || is_new::text from public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  'pending/false', 'the same request again is reported as existing');
select is((select count(*)::int from public.memberships where user_id = pg_temp.id('n')), 1, 'no duplicate membership');
select is((select academy_id from public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  pg_temp.id('a1'), 'the academy comes back too');
select pg_temp.logout();
update public.memberships set status = 'active' where user_id = pg_temp.id('n');
select pg_temp.login(pg_temp.id('n'));
select is((select status::text || '/' || is_new::text from public.join_with_code((select invite_code from t_codes where id = pg_temp.id('a1')))),
  'active/false', 'an active member asking again: active, not new');

select pg_temp.login(pg_temp.id('o'));
insert into t_pcodes select 'first', id, code from public.create_professor_code(pg_temp.id('a1'));
insert into t_pcodes select 'second', id, code from public.create_professor_code(pg_temp.id('a1'));
insert into t_pcodes select 'third', id, code from public.create_professor_code(pg_temp.id('a1'));

select pg_temp.login(pg_temp.id('n'));
select is((select status::text || '/' || is_new::text from public.join_with_code((select code from t_pcodes where key = 'third'))),
  'active/false', 'an active student using a professor code gets the existing membership (not new)');
select pg_temp.logout();
select is((select role::text from public.memberships where user_id = pg_temp.id('n')), 'student',
  'and stays a student');
select is((select used_at from public.professor_codes where id = (select id from t_pcodes where key = 'third')), null,
  'and the professor code is not spent');

select pg_temp.login(pg_temp.id('x'));
select is((select status::text || '/' || is_new::text from public.join_with_code((select code from t_pcodes where key = 'first'))),
  'pending/true', 'a professor code creates a new pending request');
select is((select status::text || '/' || is_new::text from public.join_with_code((select code from t_pcodes where key = 'second'))),
  'pending/false', 'a second code from the same pending user is not new');
select pg_temp.logout();
select is((select used_by from public.professor_codes where id = (select id from t_pcodes where key = 'first')), pg_temp.id('x'),
  'the first code was spent by the requester');
select is((select used_at from public.professor_codes where id = (select id from t_pcodes where key = 'second')), null,
  'the second code was not spent');
select is((select role::text from public.memberships where user_id = pg_temp.id('x')), 'instructor',
  'the professor code request is an instructor request');

-- Extra shades ("Mais cores").
select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Muay Thai'), 'light_blue', 'dark_blue', 90, 30) $$,
  'owner uses the light/dark shades');
select throws_ok($$ insert into public.modality_belts (academy_id, modality_id, primary_color, position, classes_required)
  values (pg_temp.id('a1'), pg_temp.modality('Muay Thai'), 'light_pink', 91, 30) $$,
  '23514', null, 'a shade outside the palette is rejected');
select pg_temp.logout();

select * from finish();
rollback;
