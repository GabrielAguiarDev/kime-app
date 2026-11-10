-- Instructor profile (2026-11-10): schedule instructor, bio/contacts, staff
-- modalities and belts, and get_instructor_profile().
-- Run with: supabase test db
--
-- Academy A (BJJ with belts, Boxe without): O owner, I and J instructors,
-- students S (BJJ competitor), C (BJJ+Boxe, competitor in Boxe), N (BJJ).
-- Academy B: O2 owner, X student (outsider to A).
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.login(u uuid) returns void language plpgsql as $$begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end$$;
create function pg_temp.admin() returns void language plpgsql as $$begin perform set_config('role', 'postgres', true); end$$;
grant execute on function pg_temp.login(uuid), pg_temp.admin() to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$ select v from ids where ids.k = $1 $$;
grant execute on function pg_temp.id(text) to public;

insert into ids values
  ('o',  'a3000000-0000-0000-0000-000000000001'),
  ('i',  'a3000000-0000-0000-0000-000000000002'),
  ('j',  'a3000000-0000-0000-0000-000000000003'),
  ('s',  'a3000000-0000-0000-0000-000000000004'),
  ('c',  'a3000000-0000-0000-0000-000000000005'),
  ('n',  'a3000000-0000-0000-0000-000000000006'),
  ('o2', 'a3000000-0000-0000-0000-000000000007'),
  ('x',  'a3000000-0000-0000-0000-000000000008');
insert into auth.users (id, email, raw_user_meta_data)
select v, k || '@ip.test', jsonb_build_object('full_name', upper(k)) from ids;

select pg_temp.login(pg_temp.id('o'));
insert into ids values ('a', public.create_academy('Prof A', array['BJJ', 'Boxe']));
select pg_temp.login(pg_temp.id('o2'));
insert into ids values ('b', public.create_academy('Prof B', array['Judô']));
select pg_temp.admin();
insert into ids select 'mod:' || name, id from public.academy_modalities where academy_id in (pg_temp.id('a'), pg_temp.id('b'));
update public.academy_modalities set uses_belts = false where id = pg_temp.id('mod:Boxe');

insert into public.memberships (user_id, academy_id, role, status) values
  (pg_temp.id('i'), pg_temp.id('a'), 'instructor', 'active'),
  (pg_temp.id('j'), pg_temp.id('a'), 'instructor', 'active'),
  (pg_temp.id('s'), pg_temp.id('a'), 'student', 'active'),
  (pg_temp.id('c'), pg_temp.id('a'), 'student', 'active'),
  (pg_temp.id('n'), pg_temp.id('a'), 'student', 'active'),
  (pg_temp.id('x'), pg_temp.id('b'), 'student', 'active'),
  (pg_temp.id('i'), pg_temp.id('b'), 'student', 'active');
insert into ids select 'm:' || i.k, m.id from public.memberships m join ids i on i.v = m.user_id
where m.academy_id = pg_temp.id('a') or i.k in ('x');
insert into ids select 'mb:i', id from public.memberships where user_id = pg_temp.id('i') and academy_id = pg_temp.id('b');

insert into public.student_modality_enrollments (membership_id, modality_id, status, is_competitor, competitor_since) values
  (pg_temp.id('m:s'), pg_temp.id('mod:BJJ'), 'active', true, now()),
  (pg_temp.id('m:c'), pg_temp.id('mod:BJJ'), 'active', false, null),
  (pg_temp.id('m:c'), pg_temp.id('mod:Boxe'), 'active', true, now()),
  (pg_temp.id('m:n'), pg_temp.id('mod:BJJ'), 'active', false, null),
  (pg_temp.id('m:x'), pg_temp.id('mod:Judô'), 'active', true, now()),
  (pg_temp.id('mb:i'), pg_temp.id('mod:Judô'), 'active', false, null);

insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required) values
  (pg_temp.id('a'), pg_temp.id('mod:BJJ'), 'white', null, 0, 10),
  (pg_temp.id('a'), pg_temp.id('mod:BJJ'), 'black', 'red', 1, 10);
insert into ids select 'belt:' || position, id from public.modality_belts where modality_id = pg_temp.id('mod:BJJ');
insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
values (pg_temp.id('b'), pg_temp.id('mod:Judô'), 'white', null, 0, 10);
insert into ids select 'belt:judo', id from public.modality_belts where modality_id = pg_temp.id('mod:Judô');

-- =================================================== schedules → instructor ===
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$
  insert into public.class_schedules (academy_id, weekday, start_time, modality_id, instructor_id)
  values (pg_temp.id('a'), 1, '19:00', pg_temp.id('mod:BJJ'), pg_temp.id('i')),
         (pg_temp.id('a'), 3, '19:00', pg_temp.id('mod:BJJ'), pg_temp.id('i')),
         (pg_temp.id('a'), 2, '07:00', pg_temp.id('mod:Boxe'), pg_temp.id('i')),
         (pg_temp.id('a'), 4, '07:00', pg_temp.id('mod:Boxe'), null)
$$, 'schedules: staff set an instructor (or none) on insert');
select throws_ok($$
  insert into public.class_schedules (academy_id, weekday, start_time, modality_id, instructor_id)
  values (pg_temp.id('a'), 5, '19:00', pg_temp.id('mod:BJJ'), pg_temp.id('s'))
$$, '22023', 'instructor_invalid', 'schedules: a student cannot be the instructor');
select throws_ok($$
  insert into public.class_schedules (academy_id, weekday, start_time, modality_id, instructor_id)
  values (pg_temp.id('a'), 5, '19:00', pg_temp.id('mod:BJJ'), pg_temp.id('o2'))
$$, '22023', 'instructor_invalid', 'schedules: staff of another academy cannot be the instructor');
select lives_ok($$
  update public.class_schedules set instructor_id = pg_temp.id('j')
  where academy_id = pg_temp.id('a') and weekday = 4
$$, 'schedules: staff switch the instructor');
select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from (
  select 1 from public.class_schedules where academy_id = pg_temp.id('a') and weekday = 4 and instructor_id is not null
  -- RLS: a student updating a schedule touches nothing.
) q), 0, 'schedules: a BJJ-only student does not read Boxe schedules (RLS unchanged)');
update public.class_schedules set instructor_id = null where academy_id = pg_temp.id('a');
select pg_temp.admin();
select is((select count(*)::int from public.class_schedules where academy_id = pg_temp.id('a') and instructor_id is not null), 4,
  'schedules: a student cannot clear the instructor');

-- =================================================== instructor_profiles ===
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$
  insert into public.instructor_profiles (user_id, bio, instagram, whatsapp, show_contacts_to_students)
  values (pg_temp.id('i'), '  Faixa preta, 15 anos de tatame.  ', '@Prof.I', '+55 (11) 99999-0000', false)
$$, 'profiles: the instructor writes their own bio and contacts');
select is((select bio || '|' || instagram || '|' || whatsapp from public.instructor_profiles where user_id = pg_temp.id('i')),
  'Faixa preta, 15 anos de tatame.|prof.i|5511999990000', 'profiles: bio trimmed, handle without @ in lower case, phone digits only');
select throws_ok($$ update public.instructor_profiles set bio = repeat('a', 161) where user_id = pg_temp.id('i') $$,
  '23514', null, 'profiles: bio has at most 160 characters');
select lives_ok($$ update public.instructor_profiles set bio = '   ' where user_id = pg_temp.id('i') $$, 'profiles: a blank bio is accepted');
select is((select bio from public.instructor_profiles where user_id = pg_temp.id('i')), null, 'profiles: a blank bio becomes null');
select lives_ok($$
  insert into public.instructor_profiles as t (user_id, bio, instagram, whatsapp, show_contacts_to_students)
  values (pg_temp.id('i'), 'Faixa preta.', 'prof.i', '5511999990000', false)
  on conflict (user_id) do update set user_id = excluded.user_id, bio = excluded.bio, instagram = excluded.instagram,
    whatsapp = excluded.whatsapp, show_contacts_to_students = excluded.show_contacts_to_students
$$, 'profiles: the PostgREST upsert (SET on every column, key included) works');
select pg_temp.login(pg_temp.id('j'));
select lives_ok($$
  insert into public.instructor_profiles as t (user_id, bio)
  values (pg_temp.id('j'), 'Prof J')
  on conflict (user_id) do update set user_id = excluded.user_id, bio = excluded.bio
$$, 'profiles: the first save (no row yet) also goes through the upsert');
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ insert into public.instructor_profiles (user_id, bio) values (pg_temp.id('j'), 'not mine') $$,
  '42501', null, 'profiles: nobody writes someone else''s profile');

select pg_temp.login(pg_temp.id('o'));
update public.instructor_profiles set bio = 'owner wrote this' where user_id = pg_temp.id('i');
select is((select bio from public.instructor_profiles where user_id = pg_temp.id('i')), 'Faixa preta.',
  'profiles: not even the owner edits an instructor''s bio');
select is((select count(*)::int from public.instructor_profiles where user_id = pg_temp.id('i')), 1,
  'profiles: staff read the instructor profile directly');

select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.instructor_profiles), 0, 'profiles: students do not read the table directly');
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.instructor_profiles where user_id = pg_temp.id('i')), 0,
  'profiles: staff of an academy where the person is only a student do not read it');

-- ================================================ instructor_modalities ===
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.set_instructor_modalities(pg_temp.id('m:i'), array[pg_temp.id('mod:BJJ')]) $$,
  '42501', 'forbidden', 'modalities: an instructor does not set their own modalities');
select pg_temp.login(pg_temp.id('o'));
select throws_ok($$ select public.set_instructor_modalities(pg_temp.id('m:s'), array[pg_temp.id('mod:BJJ')]) $$,
  '42501', 'forbidden', 'modalities: only staff memberships get instructor modalities');
select throws_ok($$ select public.set_instructor_modalities(pg_temp.id('m:i'), array[pg_temp.id('mod:Judô')]) $$,
  '23503', null, 'modalities: a modality of another academy is rejected');
select lives_ok($$ select public.set_instructor_modalities(pg_temp.id('m:i'), array[pg_temp.id('mod:BJJ'), pg_temp.id('mod:Boxe')]) $$,
  'modalities: the owner sets an instructor''s modalities');
select lives_ok($$ select public.set_instructor_modalities(pg_temp.id('m:j'), array[pg_temp.id('mod:Boxe')]) $$,
  'modalities: the owner sets another instructor''s modalities');
select lives_ok($$ select public.set_instructor_modalities(pg_temp.id('m:j'), '{}') $$, 'modalities: an empty set clears them');
select is((select count(*)::int from public.instructor_modalities where membership_id = pg_temp.id('m:j')), 0, 'modalities: cleared');
select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ select public.set_instructor_modalities(pg_temp.id('m:i'), '{}') $$,
  '42501', 'forbidden', 'modalities: the owner of another academy cannot touch them');
select pg_temp.login(pg_temp.id('n'));
select is((select count(*)::int from public.instructor_modalities where membership_id = pg_temp.id('m:i')), 2,
  'modalities: members read them');
select pg_temp.login(pg_temp.id('x'));
select is((select count(*)::int from public.instructor_modalities), 0, 'modalities: outsiders read nothing');

-- ===================================================== instructor_belts ===
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.set_instructor_belt(pg_temp.id('m:i'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:0')) $$,
  'belts: the instructor sets their own belt');
select lives_ok($$ select public.set_instructor_belt(pg_temp.id('m:i'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:1')) $$,
  'belts: setting it again switches it');
select is((select belt_id from public.instructor_belts where membership_id = pg_temp.id('m:i')), pg_temp.id('belt:1'), 'belts: switched');
select throws_ok($$ select public.set_instructor_belt(pg_temp.id('m:j'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:0')) $$,
  '42501', 'forbidden', 'belts: an instructor does not set a colleague''s belt');
select throws_ok($$ select public.set_instructor_belt(pg_temp.id('m:i'), pg_temp.id('mod:Boxe'), pg_temp.id('belt:0')) $$,
  '42501', null, 'belts: only in modalities that use belts');
select throws_ok($$ select public.set_instructor_belt(pg_temp.id('mb:i'), pg_temp.id('mod:Judô'), pg_temp.id('belt:judo')) $$,
  '42501', 'forbidden', 'belts: not where the person is a student');
select throws_ok($$ update public.instructor_belts set modality_id = pg_temp.id('mod:Boxe') where membership_id = pg_temp.id('m:i') $$,
  '42501', null, 'belts: the key columns cannot be updated directly');

select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ select public.set_instructor_belt(pg_temp.id('m:j'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:0')) $$,
  'belts: the owner sets any instructor''s belt');
select lives_ok($$ select public.set_instructor_belt(pg_temp.id('m:o'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:1')) $$,
  'belts: the owner sets their own belt');
select throws_ok($$ select public.set_instructor_belt(pg_temp.id('m:s'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:0')) $$,
  '42501', 'forbidden', 'belts: students are not staff (their belts live in belt_history)');
select lives_ok($$ select public.set_instructor_belt(pg_temp.id('m:j'), pg_temp.id('mod:BJJ'), null) $$, 'belts: null clears it');
select is((select count(*)::int from public.instructor_belts where membership_id = pg_temp.id('m:j')), 0, 'belts: cleared');
select public.set_instructor_belt(pg_temp.id('m:j'), pg_temp.id('mod:BJJ'), pg_temp.id('belt:0'));

select pg_temp.login(pg_temp.id('j'));
delete from public.instructor_belts where membership_id = pg_temp.id('m:i');
select is((select count(*)::int from public.instructor_belts where membership_id = pg_temp.id('m:i')), 1,
  'belts: an instructor cannot delete a colleague''s belt');
select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.instructor_belts), 3, 'belts: members read them');
select pg_temp.login(pg_temp.id('x'));
select is((select count(*)::int from public.instructor_belts), 0, 'belts: outsiders read nothing');

-- =============================================== get_instructor_profile ===
-- Graduations: I graduates S and N; J graduates C.
select pg_temp.login(pg_temp.id('i'));
insert into public.belt_history (membership_id, belt_id) values
  (pg_temp.id('m:s'), pg_temp.id('belt:0')), (pg_temp.id('m:n'), pg_temp.id('belt:0'));
select pg_temp.login(pg_temp.id('j'));
insert into public.belt_history (membership_id, belt_id) values (pg_temp.id('m:c'), pg_temp.id('belt:0'));

select pg_temp.login(pg_temp.id('s'));
select is((select graduations_count from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 2,
  'rpc: graduations made by the instructor in the academy');
-- I teaches BJJ + Boxe: S (BJJ) and C (Boxe) compete; N does not. X is of another academy.
select is((select competitors_count from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 2,
  'rpc: active competitors in the instructor''s modalities');
select is((select competitors_count from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('j'))), 0,
  'rpc: no modalities, no competitors');
select is((select jsonb_array_length(schedules) from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 3,
  'rpc: a student sees every active class the instructor gives, even of other modalities');
select is((select schedules->0->>'start_time' from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), '07:00',
  'rpc: schedules ordered by time, as HH:MM');
select is((select belts->0->>'belt_id' from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), pg_temp.id('belt:1')::text,
  'rpc: the instructor''s belt per modality');
select is((select bio from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 'Faixa preta.', 'rpc: students read the bio');
select is((select coalesce(instagram, '-') || coalesce(whatsapp, '-') from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), '--',
  'rpc: contacts hidden from students while "show to students" is off');

select pg_temp.login(pg_temp.id('j'));
select is((select instagram from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 'prof.i',
  'rpc: staff of the academy always read the contacts');
select pg_temp.login(pg_temp.id('i'));
select is((select whatsapp from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), '5511999990000',
  'rpc: the person reads their own contacts');
update public.instructor_profiles set show_contacts_to_students = true where user_id = pg_temp.id('i');

select pg_temp.login(pg_temp.id('s'));
select is((select instagram from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 'prof.i',
  'rpc: students read the contacts once they are turned on');
select is((select count(*)::int from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('c'))), 0,
  'rpc: a student is not an instructor profile');
select is((select full_name || ':' || role from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('o'))), 'O:owner',
  'rpc: the owner has a profile too');

select pg_temp.login(pg_temp.id('x'));
select is((select count(*)::int from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i'))), 0,
  'rpc: outsiders get nothing');
select pg_temp.admin();
set local role anon;
select throws_ok($$ select * from public.get_instructor_profile(pg_temp.id('a'), pg_temp.id('i')) $$,
  '42501', null, 'rpc: anon cannot call it');
set local role postgres;

-- Removing a belt from the sequence clears it from the staff.
delete from public.modality_belts where id = pg_temp.id('belt:1')
  and not exists (select 1 from public.belt_history where belt_id = pg_temp.id('belt:1'));
select is((select count(*)::int from public.instructor_belts where belt_id = pg_temp.id('belt:1')), 0,
  'belts: deleting a belt of the sequence clears it from the staff');

select * from finish();
rollback;
