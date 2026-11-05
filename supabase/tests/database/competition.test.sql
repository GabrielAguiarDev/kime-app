-- Phase 4: competitor team by invite, weight logs, weekly water plan, championship entries.
-- Run with: supabase test db
--
-- Academy A1: O owner, I instructor, S and S2 students. Academy A2: O2 owner.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(43);

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
  ('40000000-0000-0000-0000-0000000000a1', 'o@cp.test',  '{"full_name":"Dona"}'),
  ('40000000-0000-0000-0000-0000000000a2', 'i@cp.test',  '{"full_name":"Instrutor"}'),
  ('40000000-0000-0000-0000-0000000000a3', 's@cp.test',  '{"full_name":"Atleta"}'),
  ('40000000-0000-0000-0000-0000000000a4', 's2@cp.test', '{"full_name":"Aluna"}'),
  ('40000000-0000-0000-0000-0000000000b1', 'o2@cp.test', '{"full_name":"Dona Dois"}');
insert into t_ids values
  ('o',  '40000000-0000-0000-0000-0000000000a1'), ('i', '40000000-0000-0000-0000-0000000000a2'),
  ('s',  '40000000-0000-0000-0000-0000000000a3'), ('s2', '40000000-0000-0000-0000-0000000000a4'),
  ('o2', '40000000-0000-0000-0000-0000000000b1');

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi CP', array['Jiu-Jitsu']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra CP', array['Judô']));
select pg_temp.logout();

insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('i'),  'instructor', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s'),  'student', 'active'),
  (pg_temp.id('a1'), pg_temp.id('s2'), 'student', 'active');
insert into t_ids
  select 'ms', id from public.memberships where user_id = pg_temp.id('s');
insert into t_ids
  select 'ms2', id from public.memberships where user_id = pg_temp.id('s2');
insert into t_ids
  select 'mi', id from public.memberships where user_id = pg_temp.id('i');
-- Active students are linked to the academy's modality (an active student needs one).
select private.activate_enrollment(m.id, mo.id)
from public.memberships m join public.academy_modalities mo on mo.academy_id = m.academy_id
where m.role = 'student' and m.status = 'active';
create function pg_temp.mod() returns uuid language sql as $$
  select id from public.academy_modalities where academy_id = (select val from t_ids where key = 'a1')
$$;
grant execute on function pg_temp.mod() to public;

-- ---------------------------------------------------------------------------
-- Invite
-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ update public.memberships set is_competitor = true where id = pg_temp.id('ms') $$,
  '42501', null, 'is_competitor is not written directly');
select throws_ok($$ select public.invite_competitor(pg_temp.id('mi'), pg_temp.mod()) $$,
  '22023', 'competitor_target_invalid', 'only students are invited');

select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ select public.invite_competitor(pg_temp.id('ms'), pg_temp.mod()) $$,
  '42501', 'forbidden', 'staff of another academy cannot invite');

select pg_temp.login(pg_temp.id('s2'));
select throws_ok($$ select public.invite_competitor(pg_temp.id('ms'), pg_temp.mod()) $$,
  '42501', 'forbidden', 'a student cannot invite');

select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.invite_competitor(pg_temp.id('ms'), pg_temp.mod()) $$, 'instructor invites a student');
select lives_ok($$ select public.invite_competitor(pg_temp.id('ms'), pg_temp.mod()) $$, 'inviting again is a no-op');
select is((select competitor_invited_by from public.student_modality_enrollments
           where membership_id = pg_temp.id('ms') and modality_id = pg_temp.mod()),
  pg_temp.id('i'), 'invite stamped with who sent it (on the modality link)');
select is((select is_competitor from public.memberships where id = pg_temp.id('ms')),
  false, 'an invite alone does not make a competitor');

-- Before accepting, staff do not read the student's weight or water.
select pg_temp.logout();
insert into public.water_logs (id, user_id, amount_ml, logged_at)
values (gen_random_uuid(), pg_temp.id('s'), 500, now());
select pg_temp.login(pg_temp.id('i'));
select is((select count(*)::int from public.water_logs where user_id = pg_temp.id('s')),
  0, 'staff do not read water logs of an invited student');

select pg_temp.login(pg_temp.id('s2'));
select throws_ok($$ select public.respond_competitor_invite(pg_temp.id('ms'), pg_temp.mod(), true) $$,
  '42501', 'forbidden', 'nobody answers someone else''s invite');
select throws_ok($$ select public.respond_competitor_invite(pg_temp.id('ms2'), pg_temp.mod(), true) $$,
  'P0002', 'competitor_invite_missing', 'cannot accept without an invite');

select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ select public.respond_competitor_invite(pg_temp.id('ms'), pg_temp.mod(), true) $$, 'student accepts');
select ok((select is_competitor and competitor_since is not null and competitor_invited_at is null
           from public.student_modality_enrollments where membership_id = pg_temp.id('ms') and modality_id = pg_temp.mod())
       and (select is_competitor and competitor_since is not null from public.memberships where id = pg_temp.id('ms')),
  'accepting makes a competitor in the modality (and the membership cache), stamps the date and clears the invite');
select throws_ok($$ select public.invite_competitor(pg_temp.id('ms'), pg_temp.mod()) $$,
  '42501', 'forbidden', 'the student cannot invite themselves');

select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.invite_competitor(pg_temp.id('ms'), pg_temp.mod()) $$,
  '22023', 'already_competitor', 'a competitor is not invited again');
select is((select count(*)::int from public.water_logs where user_id = pg_temp.id('s')),
  1, 'staff read water logs once the student accepted');

-- Decline.
select public.invite_competitor(pg_temp.id('ms2'), pg_temp.mod());
select pg_temp.login(pg_temp.id('s2'));
select lives_ok($$ select public.respond_competitor_invite(pg_temp.id('ms2'), pg_temp.mod(), false) $$, 'student declines');
select ok((select not e.is_competitor and e.competitor_invited_at is null and not m.is_competitor
           from public.student_modality_enrollments e join public.memberships m on m.id = e.membership_id
           where e.membership_id = pg_temp.id('ms2') and e.modality_id = pg_temp.mod()),
  'declining clears the invite');

-- ---------------------------------------------------------------------------
-- Weight logs
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.weight_logs (athlete_id, logged_on, weight_kg) values (pg_temp.id('s2'), current_date, 70) $$,
  '42501', null, 'a non-competitor does not log weight');

select pg_temp.login(pg_temp.id('s'));
select lives_ok(
  $$ insert into public.weight_logs (athlete_id, logged_on, weight_kg) values (pg_temp.id('s'), current_date - 1, 80.4) $$,
  'competitor logs weight');
select lives_ok(
  $$ insert into public.weight_logs (athlete_id, logged_on, weight_kg) values (pg_temp.id('s'), current_date, 79.8) $$,
  'competitor logs another day');
select throws_ok(
  $$ insert into public.weight_logs (athlete_id, logged_on, weight_kg) values (pg_temp.id('s'), current_date, 79) $$,
  '23505', null, 'one weigh-in per day');
select is((select weight_kg from public.get_profile_details(pg_temp.id('s'))),
  79.80::numeric(5, 2), 'the latest weigh-in becomes the profile weight');
update public.weight_logs set weight_kg = 79.5 where athlete_id = pg_temp.id('s') and logged_on = current_date;
select is((select weight_kg from public.get_profile_details(pg_temp.id('s'))),
  79.50::numeric(5, 2), 'correcting the latest weigh-in updates the profile');
delete from public.weight_logs where athlete_id = pg_temp.id('s') and logged_on = current_date;
select is((select weight_kg from public.get_profile_details(pg_temp.id('s'))),
  80.40::numeric(5, 2), 'deleting the latest weigh-in falls back to the previous one');

select pg_temp.login(pg_temp.id('i'));
select is((select count(*)::int from public.weight_logs where athlete_id = pg_temp.id('s')),
  1, 'staff read the competitor weight');
update public.weight_logs set weight_kg = 50 where athlete_id = pg_temp.id('s');
delete from public.weight_logs where athlete_id = pg_temp.id('s');
select pg_temp.logout();
select is((select weight_kg from public.weight_logs where athlete_id = pg_temp.id('s')),
  80.40::numeric(5, 2), 'staff neither change nor delete weigh-ins');

select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.weight_logs where athlete_id = pg_temp.id('s')),
  0, 'staff of another academy do not read the weight');

-- ---------------------------------------------------------------------------
-- Water plan
-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('i'));
select throws_ok(
  $$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('s2'), array[3000, null, null, null, null, null, null]) $$,
  '42501', null, 'no plan for a non-competitor');
select throws_ok(
  $$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('s'), array[3000]) $$,
  '22023', 'water_plan_invalid', 'a plan has 7 days');
select lives_ok(
  $$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('s'), array[null, 3000, 3000, 3500, 3000, 3000, null]) $$,
  'staff set the weekly plan');
select lives_ok(
  $$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('s'), array[2500, 3000, 3000, 3500, 3000, 3000, null]) $$,
  'setting it again replaces the week');
select is((select count(*)::int from public.water_plans where athlete_id = pg_temp.id('s')),
  1, 'one plan per week');
select is((select array_agg(weekday || ':' || target_ml order by weekday) from public.water_plan_days),
  array['0:2500', '1:3000', '2:3000', '3:3500', '4:3000', '5:3000'], 'days stored with 0 = Sunday');
select is((select extract(isodow from week_start)::int from public.water_plans where athlete_id = pg_temp.id('s')),
  1, 'the plan starts on Monday');

select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.water_plan_days), 6, 'competitor reads own plan');
select throws_ok(
  $$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('s'), array[1, 1, 1, 1, 1, 1, 1]) $$,
  '42501', null, 'the competitor does not write their plan');

-- ---------------------------------------------------------------------------
-- Championship entries
-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('i'));
insert into public.championships (id, academy_id, name, event_date, modality_id) values
  ('50000000-0000-0000-0000-000000000001', pg_temp.id('a1'), 'Copa Futura', current_date + 30, pg_temp.mod()),
  ('50000000-0000-0000-0000-000000000002', pg_temp.id('a1'), 'Copa Passada', current_date - 30, pg_temp.mod());
select throws_ok(
  $$ select public.set_championship_entries('50000000-0000-0000-0000-000000000001', array[pg_temp.id('s'), pg_temp.id('s2')]) $$,
  '42501', null, 'only competitors are entered');
select lives_ok(
  $$ select public.set_championship_entries('50000000-0000-0000-0000-000000000001', array[pg_temp.id('s')]) $$,
  'staff enter a competitor');
select public.set_championship_entries('50000000-0000-0000-0000-000000000002', array[pg_temp.id('s')]);

select pg_temp.login(pg_temp.id('o2'));
select throws_ok(
  $$ select public.set_championship_entries('50000000-0000-0000-0000-000000000001', '{}') $$,
  '42501', 'forbidden', 'staff of another academy cannot change entries');

-- ---------------------------------------------------------------------------
-- Leaving the team
-- ---------------------------------------------------------------------------
select pg_temp.login(pg_temp.id('s2'));
select throws_ok($$ select public.remove_competitor(pg_temp.id('ms'), pg_temp.mod()) $$,
  '42501', 'forbidden', 'another student cannot take someone off the team');

select pg_temp.login(pg_temp.id('s'));
select lives_ok($$ select public.remove_competitor(pg_temp.id('ms'), pg_temp.mod()) $$, 'the competitor leaves the team');
select pg_temp.logout();
select is((select array_agg(c.name) from public.championship_entries e
           join public.championships c on c.id = e.championship_id
           where e.athlete_id = pg_temp.id('s')),
  array['Copa Passada'], 'leaving drops future entries and keeps past ones');

select * from finish();
rollback;
