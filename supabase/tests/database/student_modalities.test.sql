-- Students <-> modalities: approval with modalities, the set of modalities of a student,
-- the "at least one active modality" invariant, schedule / check-in / attendance RLS,
-- competitor per modality, championships of a modality, water plans and ranking facts.
-- Run with: supabase test db
--
-- Academy A1 (Jiu-Jitsu, Muay Thai, Boxe): O owner, I instructor, students S (JJ), S2 (JJ+MT),
-- B (JJ+MT), V (JJ), W (JJ+MT), K (JJ+MT), R (JJ+MT), R2 (JJ); pending P1, P2.
-- Academy A2 (Judô): O2 owner, T student.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(122);
grant usage on schema private to authenticated;
grant execute on function private.ranking_facts_internal(uuid,uuid,date,date) to authenticated;

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

-- ------------------------------------------------------------------ users ---
insert into auth.users (id, email, raw_user_meta_data)
select ('a0000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, k || '@sm.test', jsonb_build_object('full_name', k)
from (values (1, 'o'), (2, 'i'), (3, 'o2'), (4, 't'), (5, 's'), (6, 's2'), (7, 'b'), (8, 'v'), (9, 'w'),
             (10, 'k'), (11, 'r'), (12, 'r2'), (13, 'p1'), (14, 'p2'), (15, 'z')) u(n, k);
insert into t_ids
select k, ('a0000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
from (values (1, 'o'), (2, 'i'), (3, 'o2'), (4, 't'), (5, 's'), (6, 's2'), (7, 'b'), (8, 'v'), (9, 'w'),
             (10, 'k'), (11, 'r'), (12, 'r2'), (13, 'p1'), (14, 'p2'), (15, 'z')) u(n, k);

select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a1', public.create_academy('Kimi SM', array['Jiu-Jitsu', 'Muay Thai', 'Boxe']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('Outra SM', array['Judô']));
select pg_temp.logout();

insert into t_ids select 'mod:jj',    id from public.academy_modalities where academy_id = pg_temp.id('a1') and name = 'Jiu-Jitsu';
insert into t_ids select 'mod:mt',    id from public.academy_modalities where academy_id = pg_temp.id('a1') and name = 'Muay Thai';
insert into t_ids select 'mod:boxe',  id from public.academy_modalities where academy_id = pg_temp.id('a1') and name = 'Boxe';
insert into t_ids select 'mod:judo',  id from public.academy_modalities where academy_id = pg_temp.id('a2');

insert into public.memberships (academy_id, user_id, role, status)
select pg_temp.id('a1'), pg_temp.id(k), 'student', 'pending'
from (values ('s'), ('s2'), ('b'), ('v'), ('w'), ('k'), ('r'), ('r2'), ('p1'), ('p2')) x(k);
insert into public.memberships (academy_id, user_id, role, status) values
  (pg_temp.id('a1'), pg_temp.id('i'), 'instructor', 'active'),
  (pg_temp.id('a2'), pg_temp.id('t'), 'student', 'pending');
insert into t_ids select 'm:' || u.key, m.id
from public.memberships m join t_ids u on u.val = m.user_id and u.key not in ('a1', 'a2')
where m.academy_id = pg_temp.id('a1');
insert into t_ids select 'm:t', id from public.memberships where user_id = pg_temp.id('t');

create function pg_temp.mod(p text) returns uuid language sql as $$ select val from t_ids where key = 'mod:' || p $$;
create function pg_temp.mid(p text) returns uuid language sql as $$ select val from t_ids where key = 'm:' || p $$;
create function pg_temp.today() returns date language sql as $$
  select private.academy_local_date((select val from t_ids where key = 'a1'))
$$;
grant execute on function pg_temp.mod(text), pg_temp.mid(text), pg_temp.today() to public;

-- Approve the base students through the RPC (also exercises it).
select pg_temp.login(pg_temp.id('o'));
select public.approve_student(pg_temp.mid('s'),  array[pg_temp.mod('jj')]);
select public.approve_student(pg_temp.mid('s2'), array[pg_temp.mod('jj'), pg_temp.mod('mt')]);
select public.approve_student(pg_temp.mid('b'),  array[pg_temp.mod('jj'), pg_temp.mod('mt')]);
select public.approve_student(pg_temp.mid('v'),  array[pg_temp.mod('jj')]);
select public.approve_student(pg_temp.mid('w'),  array[pg_temp.mod('jj'), pg_temp.mod('mt')]);
select public.approve_student(pg_temp.mid('k'),  array[pg_temp.mod('jj'), pg_temp.mod('mt')]);
select public.approve_student(pg_temp.mid('r'),  array[pg_temp.mod('jj'), pg_temp.mod('mt')]);
select public.approve_student(pg_temp.mid('r2'), array[pg_temp.mod('jj')]);
select pg_temp.login(pg_temp.id('o2'));
select public.approve_student(pg_temp.mid('t'), array[pg_temp.mod('judo')]);
select pg_temp.logout();

-- Classes: JJ at 19:00 and 20:00, MT at 19:00, every weekday (so "today" always has one).
insert into public.class_schedules (academy_id, weekday, start_time, modality_id)
select pg_temp.id('a1'), d, x.t::time, pg_temp.mod(x.m)
from generate_series(0, 6) d, (values ('jj', '19:00'), ('jj', '20:00'), ('mt', '19:00')) x(m, t);
insert into t_ids
select 'sch:' || mo.k || ':' || to_char(s.start_time, 'HH24') || ':' || s.weekday, s.id
from public.class_schedules s
join (values ('jj'), ('mt')) mo(k) on pg_temp.mod(mo.k) = s.modality_id
where s.academy_id = pg_temp.id('a1');
-- sched('jj', date) = the 19:00 class; sched('jj', date, '20') = the 20:00 class.
create function pg_temp.sched(p_mod text, p_date date, p_hour text default '19') returns uuid language sql as $$
  select val from t_ids where key = 'sch:' || p_mod || ':' || p_hour || ':' || extract(dow from p_date)::int
$$;
grant execute on function pg_temp.sched(text, date, text) to public;

create function pg_temp.mark(p_user text, p_mod text, p_date date, p_hour text default '19') returns void language sql as $$
  insert into public.checkins (user_id, academy_id, schedule_id, class_date, status, marked_by)
  values (pg_temp.id(p_user), pg_temp.id('a1'), pg_temp.sched(p_mod, p_date, p_hour), p_date, 'confirmed', (select auth.uid()))
$$;
grant execute on function pg_temp.mark(text, text, date, text) to public;

-- =====================================================================
-- approve_student
-- =====================================================================
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), array[pg_temp.mod('jj')]) $$,
  '42501', 'forbidden', 'approve_student: a student cannot approve');
select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), array[pg_temp.mod('jj')]) $$,
  '42501', 'forbidden', 'approve_student: staff of another academy cannot approve');

select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), '{}'::uuid[]) $$,
  '22023', 'student_modality_required', 'approve_student: an empty set of modalities is refused');
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), null) $$,
  '22023', 'student_modality_required', 'approve_student: a null set of modalities is refused');
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), array[pg_temp.mod('judo')]) $$,
  '22023', 'student_modality_required', 'approve_student: a modality of another academy is refused');
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), array[pg_temp.mod('jj'), pg_temp.mod('judo')]) $$,
  '22023', 'student_modality_required', 'approve_student: one foreign modality in the set refuses all of it');
select pg_temp.logout();
select is((select m.status::text || '/' || (select count(*) from public.student_modality_enrollments e where e.membership_id = m.id)
           from public.memberships m where m.id = pg_temp.mid('p1')),
  'pending/0', 'approve_student: a refused approval leaves the request pending and creates no link');

select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.approve_student(pg_temp.mid('p1'), array[pg_temp.mod('jj')]) $$,
  'approve_student: an instructor approves a student with a modality');
select pg_temp.logout();
select is((select m.status::text || '/' || m.decided_by::text || '/' ||
             (select string_agg(e.status || ':' || (e.modality_id = pg_temp.mod('jj'))::text, ',') from public.student_modality_enrollments e where e.membership_id = m.id)
           from public.memberships m where m.id = pg_temp.mid('p1')),
  'active/' || pg_temp.id('i')::text || '/active:true', 'approve_student: active, decision stamped, one active link to the chosen modality');
select is((select count(*)::int from private.modality_active_periods ap
           join public.student_modality_enrollments e on e.id = ap.enrollment_id
           where e.membership_id = pg_temp.mid('p1') and ap.ends_at is null),
  1, 'approve_student: the link opens an active period');

select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.approve_student(pg_temp.mid('p1'), array[pg_temp.mod('jj')]) $$,
  '22023', 'membership_not_pending', 'approve_student: only pending students');
select throws_ok($$ select public.approve_student(pg_temp.mid('i'), array[pg_temp.mod('jj')]) $$,
  '22023', 'membership_not_pending', 'approve_student: not for staff memberships');
select pg_temp.login(pg_temp.id('o'));
select lives_ok($$ select public.approve_student(pg_temp.mid('p2'), array[pg_temp.mod('jj'), pg_temp.mod('mt'), pg_temp.mod('jj')]) $$,
  'approve_student: the owner approves with several modalities (duplicates ignored)');
select pg_temp.logout();
select is((select count(*)::int from public.student_modality_enrollments where membership_id = pg_temp.mid('p2') and status = 'active'),
  2, 'approve_student: one active link per distinct modality');

-- =====================================================================
-- set_student_modalities
-- =====================================================================
select pg_temp.login(pg_temp.id('b'));
select throws_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj')]) $$,
  '42501', 'forbidden', 'set_student_modalities: a student cannot change their own modalities');
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj')]) $$,
  '42501', 'forbidden', 'set_student_modalities: nor another student''s');
select pg_temp.login(pg_temp.id('o2'));
select throws_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj')]) $$,
  '42501', 'forbidden', 'set_student_modalities: staff of another academy cannot');

select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.set_student_modalities(pg_temp.mid('b'), '{}'::uuid[]) $$,
  '22023', 'student_modality_required', 'set_student_modalities: an empty set is refused');
select throws_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('judo')]) $$,
  '22023', 'student_modality_required', 'set_student_modalities: a modality of another academy is refused');
select throws_ok($$ select public.set_student_modalities(pg_temp.mid('i'), array[pg_temp.mod('jj')]) $$,
  '22023', 'invalid_modality_enrollment', 'set_student_modalities: only for active students');
select pg_temp.logout();
select is((select count(*)::int from public.student_modality_enrollments where membership_id = pg_temp.mid('b') and status = 'active'),
  2, 'set_student_modalities: refused calls change nothing');

-- History of the modality that will be removed: a confirmed class and a belt.
insert into public.checkins (user_id, academy_id, schedule_id, class_date, status)
values (pg_temp.id('b'), pg_temp.id('a1'), pg_temp.sched('mt', pg_temp.today() - 1), pg_temp.today() - 1, 'confirmed');
insert into public.modality_belts (id, academy_id, modality_id, primary_color, position, classes_required)
values ('a0000000-0000-0000-00ee-000000000001', pg_temp.id('a1'), pg_temp.mod('mt'), 'yellow', 0, 1);
insert into public.belt_history (membership_id, belt_id)
values (pg_temp.mid('b'), 'a0000000-0000-0000-00ee-000000000001');

select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj')]) $$,
  'set_student_modalities: staff remove a modality');
select pg_temp.logout();
select is((select array_agg(e.status order by mo.name) from public.student_modality_enrollments e
           join public.academy_modalities mo on mo.id = e.modality_id where e.membership_id = pg_temp.mid('b')),
  array['active', 'ended'], 'set_student_modalities: the removed modality becomes ended (not deleted)');
select is((select count(*)::int from public.checkins where user_id = pg_temp.id('b')),
  1, 'set_student_modalities: ending a modality keeps the check-ins');
select is((select count(*)::int from public.belt_history where membership_id = pg_temp.mid('b')),
  1, 'set_student_modalities: ending a modality keeps the belt history');
select is((select count(*)::int from private.modality_active_periods ap
           join public.student_modality_enrollments e on e.id = ap.enrollment_id
           where e.membership_id = pg_temp.mid('b') and e.modality_id = pg_temp.mod('mt') and ap.ends_at is not null),
  1, 'set_student_modalities: the active period of the ended link is closed');

select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj')]) $$,
  'set_student_modalities: repeating the same set is harmless');
select lives_ok($$ select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj'), pg_temp.mod('mt')]) $$,
  'set_student_modalities: re-adding a modality');
select pg_temp.logout();
select is((select e.status || '/' || count(*) over ()
           from public.student_modality_enrollments e where e.membership_id = pg_temp.mid('b') and e.modality_id = pg_temp.mod('mt')),
  'active/1', 'set_student_modalities: re-adding reopens the same link (no duplicate row)');
select is((select count(*)::int || '/' || count(*) filter (where ap.ends_at is null)::int
           from private.modality_active_periods ap join public.student_modality_enrollments e on e.id = ap.enrollment_id
           where e.membership_id = pg_temp.mid('b') and e.modality_id = pg_temp.mod('mt')),
  '2/1', 'set_student_modalities: re-adding opens a new period and keeps the old one');
select is((select count(*)::int from public.checkins where user_id = pg_temp.id('b'))
        + (select count(*)::int from public.belt_history where membership_id = pg_temp.mid('b')),
  2, 'set_student_modalities: history survives remove and re-add');

-- =====================================================================
-- Invariant: an active student keeps at least one active link (checked at commit)
-- =====================================================================
select throws_ok($$ do $b$ begin
    update public.student_modality_enrollments set status = 'ended' where membership_id = pg_temp.mid('v');
    set constraints enrollments_student_needs_modality immediate;
  end $b$ $$,
  '23514', 'student_modality_required', 'invariant: ending the last active link of an active student fails at commit');
select throws_ok($$ do $b$ begin
    delete from public.student_modality_enrollments where membership_id = pg_temp.mid('v');
    set constraints enrollments_student_needs_modality immediate;
  end $b$ $$,
  '23514', 'student_modality_required', 'invariant: deleting the last link of an active student fails at commit');
select lives_ok($$ do $b$ begin
    update public.student_modality_enrollments set status = 'ended'
      where membership_id = pg_temp.mid('w') and modality_id = pg_temp.mod('mt');
    set constraints enrollments_student_needs_modality immediate;
  end $b$ $$,
  'invariant: ending one of two active links is fine');
set constraints enrollments_student_needs_modality deferred;
select throws_ok($$ do $b$ begin
    insert into public.memberships (academy_id, user_id, role, status)
      values (pg_temp.id('a1'), pg_temp.id('z'), 'student', 'active');
    set constraints memberships_student_needs_modality immediate;
  end $b$ $$,
  '23514', 'student_modality_required', 'invariant: a student membership activated without any link fails at commit');
select lives_ok($$ do $b$ begin
    update public.memberships set status = 'rejected' where id = pg_temp.mid('v');
    set constraints enrollments_student_needs_modality, memberships_student_needs_modality immediate;
  end $b$ $$,
  'invariant: a student who stops being active no longer needs a link');
set constraints enrollments_student_needs_modality deferred;
set constraints memberships_student_needs_modality deferred;
select is((select string_agg(e.status, ',') from public.student_modality_enrollments e where e.membership_id = pg_temp.mid('v')),
  'ended', 'invariant: leaving the academy ends the links');

-- =====================================================================
-- Schedules and check-ins follow the student's modalities
-- =====================================================================
select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.class_schedules), 14, 'RLS: a JJ-only student reads the JJ schedules (2 per weekday)');
select is((select count(*)::int from public.class_schedules where modality_id = pg_temp.mod('mt')), 0,
  'RLS: and none of the Muay Thai ones');
select pg_temp.login(pg_temp.id('s2'));
select is((select count(*)::int from public.class_schedules), 21, 'RLS: a JJ+MT student reads both modalities');
select pg_temp.login(pg_temp.id('i'));
select is((select count(*)::int from public.class_schedules), 21, 'RLS: staff read every schedule');
select pg_temp.login(pg_temp.id('t'));
select is((select count(*)::int from public.class_schedules), 0, 'RLS: a student of another academy reads none');

select pg_temp.login(pg_temp.id('s'));
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('s'), pg_temp.id('a1'), pg_temp.sched('mt', pg_temp.today()), pg_temp.today()) $$,
  '42501', null, 'check-in: refused into a class of a modality the student is not linked to');
select lives_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('s'), pg_temp.id('a1'), pg_temp.sched('jj', pg_temp.today()), pg_temp.today()) $$,
  'check-in: allowed into a class of a linked modality');
select pg_temp.login(pg_temp.id('s2'));
select lives_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('s2'), pg_temp.id('a1'), pg_temp.sched('mt', pg_temp.today()), pg_temp.today()) $$,
  'check-in: a student linked to two modalities checks in to either');

-- Ending a link closes the door: B ends Muay Thai.
select pg_temp.login(pg_temp.id('i'));
select public.set_student_modalities(pg_temp.mid('b'), array[pg_temp.mod('jj')]);
select pg_temp.login(pg_temp.id('b'));
select is((select count(*)::int from public.class_schedules where modality_id = pg_temp.mod('mt')), 0,
  'RLS: after the link ended the student stops reading that modality''s schedules');
select throws_ok(
  $$ insert into public.checkins (user_id, academy_id, schedule_id, class_date)
     values (pg_temp.id('b'), pg_temp.id('a1'), pg_temp.sched('mt', pg_temp.today()), pg_temp.today()) $$,
  '42501', null, 'check-in: refused into the class of an ended link');
select pg_temp.logout();
select is((select count(*)::int from public.checkins where user_id = pg_temp.id('b')), 1,
  'the ended link''s old check-in is still there');

-- =====================================================================
-- Staff mark attendance only for linked students
-- =====================================================================
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select pg_temp.mark('s', 'mt', pg_temp.today() - 1) $$,
  '42501', null, 'mark attendance: refused for a student not linked to the class modality');
select lives_ok($$ select pg_temp.mark('s', 'jj', pg_temp.today() - 1) $$,
  'mark attendance: allowed for a student linked to the class modality');
select lives_ok($$ select pg_temp.mark('s2', 'mt', pg_temp.today() - 1) $$,
  'mark attendance: allowed for the second modality of a multi-modality student');
select throws_ok($$ select pg_temp.mark('b', 'mt', pg_temp.today() - 2) $$,
  '42501', null, 'mark attendance: refused for a student whose link to the modality ended');
select lives_ok($$ select pg_temp.mark('b', 'jj', pg_temp.today() - 2) $$,
  'mark attendance: still allowed for the modality they keep');

-- =====================================================================
-- Competitor per modality (K), with the water plan on top
-- =====================================================================
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.invite_competitor(pg_temp.mid('k'), pg_temp.mod('jj')) $$, 'competitor: staff invite K in Jiu-Jitsu');
select throws_ok($$ select public.invite_competitor(pg_temp.mid('k'), pg_temp.mod('boxe')) $$,
  '22023', 'competitor_target_invalid', 'competitor: cannot invite for a modality the student is not linked to');
select throws_ok($$ select public.invite_competitor(pg_temp.mid('i'), pg_temp.mod('jj')) $$,
  '22023', 'competitor_target_invalid', 'competitor: only students are invited');
select pg_temp.logout();
select is((select string_agg(mo.name || ':' || (e.competitor_invited_at is not null)::text || ':' || e.is_competitor::text, ',' order by mo.name)
           from public.student_modality_enrollments e join public.academy_modalities mo on mo.id = e.modality_id
           where e.membership_id = pg_temp.mid('k')),
  'Jiu-Jitsu:true:false,Muay Thai:false:false', 'competitor: the invite is on the Jiu-Jitsu link only');
select is((select competitor_invited_by from public.student_modality_enrollments where membership_id = pg_temp.mid('k') and modality_id = pg_temp.mod('jj')),
  pg_temp.id('i'), 'competitor: the invite is stamped with who sent it');
select is((select is_competitor from public.memberships where id = pg_temp.mid('k')), false, 'competitor: an invite alone does not make a competitor');

select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ select public.respond_competitor_invite(pg_temp.mid('k'), pg_temp.mod('jj'), true) $$,
  '42501', 'forbidden', 'competitor: nobody answers someone else''s invite');
select pg_temp.login(pg_temp.id('k'));
select throws_ok($$ select public.respond_competitor_invite(pg_temp.mid('k'), pg_temp.mod('mt'), true) $$,
  'P0002', 'competitor_invite_missing', 'competitor: cannot accept in a modality without an invite');
select throws_ok($$ update public.student_modality_enrollments set is_competitor = true where membership_id = pg_temp.mid('k') $$,
  '42501', null, 'competitor: a client cannot write the competitor columns directly');
select lives_ok($$ select public.respond_competitor_invite(pg_temp.mid('k'), pg_temp.mod('jj'), true) $$, 'competitor: K accepts the Jiu-Jitsu invite');
select pg_temp.logout();
select is((select string_agg(mo.name || ':' || e.is_competitor::text || ':' || (e.competitor_since is not null)::text || ':' || (e.competitor_invited_at is null)::text, ',' order by mo.name)
           from public.student_modality_enrollments e join public.academy_modalities mo on mo.id = e.modality_id
           where e.membership_id = pg_temp.mid('k')),
  'Jiu-Jitsu:true:true:true,Muay Thai:false:false:true', 'competitor: accepting competes in that modality only');
select is((select is_competitor and competitor_since is not null from public.memberships where id = pg_temp.mid('k')),
  true, 'competitor: the membership cache says competitor (competes in any modality)');
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.invite_competitor(pg_temp.mid('k'), pg_temp.mod('jj')) $$,
  '22023', 'already_competitor', 'competitor: a competitor is not invited again in the same modality');

-- Water plan: accessible to staff and the athlete (competes in one modality only).
select lives_ok($$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('k'),
  array[2000, 2500, 2500, 2500, 2500, 2500, 3000], array[true, false, false, false, false, false, false]) $$,
  'water plan: staff set a plan for an athlete who competes in one modality');
select throws_ok($$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('k'), array[1, 2, 3, 4, 5, 6, 7], array[true]) $$,
  '22023', 'water_plan_invalid', 'water plan: the limits array must have 7 days too');
select is((select count(*)::int from public.water_plans where athlete_id = pg_temp.id('k')), 1, 'water plan: staff read it');
select is((select is_limit from public.water_plan_days d join public.water_plans p on p.id = d.plan_id
           where p.athlete_id = pg_temp.id('k') and d.weekday = 0), true, 'water plan: a limit day is stored as limit');
select is((select count(*)::int from public.water_plan_days d join public.water_plans p on p.id = d.plan_id
           where p.athlete_id = pg_temp.id('k') and not d.is_limit), 6, 'water plan: the other days are goals');
select pg_temp.login(pg_temp.id('k'));
select is((select count(*)::int from public.water_plan_days), 7, 'water plan: the athlete reads their own plan');

-- A second modality, then the first one leaves: still a competitor through Muay Thai.
select pg_temp.login(pg_temp.id('i'));
select public.invite_competitor(pg_temp.mid('k'), pg_temp.mod('mt'));
select pg_temp.login(pg_temp.id('k'));
select public.respond_competitor_invite(pg_temp.mid('k'), pg_temp.mod('mt'), true);
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ select public.remove_competitor(pg_temp.mid('k'), pg_temp.mod('jj')) $$,
  '42501', 'forbidden', 'competitor: another student cannot take K off a team');
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.remove_competitor(pg_temp.mid('k'), pg_temp.mod('jj')) $$, 'competitor: staff remove K from Jiu-Jitsu');
select pg_temp.logout();
select is((select string_agg(mo.name || ':' || e.is_competitor::text, ',' order by mo.name)
           from public.student_modality_enrollments e join public.academy_modalities mo on mo.id = e.modality_id
           where e.membership_id = pg_temp.mid('k')),
  'Jiu-Jitsu:false,Muay Thai:true', 'competitor: removed from Jiu-Jitsu, still competing in Muay Thai');
select is((select is_competitor from public.memberships where id = pg_temp.mid('k')), true,
  'competitor: the cache stays true while any modality remains');
select pg_temp.login(pg_temp.id('i'));
select lives_ok($$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('k'), array[2000, 2000, 2000, 2000, 2000, 2000, 2000]) $$,
  'water plan: still settable while the athlete competes in the other modality');
select is((select count(*)::int from public.water_plans where athlete_id = pg_temp.id('k')), 1, 'water plan: staff still read it');
select pg_temp.login(pg_temp.id('k'));
select is((select count(*)::int from public.water_plan_days), 7, 'water plan: the athlete still reads it');

-- The athlete leaves the last team on their own.
select lives_ok($$ select public.remove_competitor(pg_temp.mid('k'), pg_temp.mod('mt')) $$, 'competitor: the athlete leaves the team on their own');
select pg_temp.logout();
select is((select is_competitor or competitor_since is not null from public.memberships where id = pg_temp.mid('k')), false,
  'competitor: no modality left, the cache is false (and the since date cleared)');
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ select public.set_water_plan(pg_temp.id('a1'), pg_temp.id('k'), array[1, 1, 1, 1, 1, 1, 1]) $$,
  '42501', null, 'water plan: unavailable once the athlete competes in none');
select is((select count(*)::int from public.water_plans where athlete_id = pg_temp.id('k')), 0, 'water plan: staff no longer read it');
select pg_temp.login(pg_temp.id('k'));
select is((select count(*)::int from public.water_plans), 0, 'water plan: nor does the athlete');

-- Declining an invite.
select pg_temp.login(pg_temp.id('i'));
select public.invite_competitor(pg_temp.mid('k'), pg_temp.mod('mt'));
select pg_temp.login(pg_temp.id('k'));
select lives_ok($$ select public.respond_competitor_invite(pg_temp.mid('k'), pg_temp.mod('mt'), false) $$, 'competitor: K declines');
select pg_temp.logout();
select is((select not e.is_competitor and e.competitor_invited_at is null and not m.is_competitor
           from public.student_modality_enrollments e join public.memberships m on m.id = e.membership_id
           where e.membership_id = pg_temp.mid('k') and e.modality_id = pg_temp.mod('mt')),
  true, 'competitor: declining clears the invite and nobody competes');

-- =====================================================================
-- Championships belong to a modality (S2 competes in Jiu-Jitsu only)
-- =====================================================================
select pg_temp.login(pg_temp.id('i'));
select public.invite_competitor(pg_temp.mid('s2'), pg_temp.mod('jj'));
select pg_temp.login(pg_temp.id('s2'));
select public.respond_competitor_invite(pg_temp.mid('s2'), pg_temp.mod('jj'), true);
select pg_temp.login(pg_temp.id('i'));
select throws_ok($$ insert into public.championships (academy_id, name, event_date) values (pg_temp.id('a1'), 'Sem modalidade', current_date + 30) $$,
  '23502', null, 'championship: the modality is mandatory');
select throws_ok($$ insert into public.championships (academy_id, name, event_date, modality_id)
  values (pg_temp.id('a1'), 'Modalidade alheia', current_date + 30, pg_temp.mod('judo')) $$,
  '23503', null, 'championship: the modality must belong to the academy');
insert into public.championships (id, academy_id, name, event_date, modality_id) values
  ('a0000000-0000-0000-00dd-000000000001', pg_temp.id('a1'), 'Copa JJ', current_date + 30, pg_temp.mod('jj')),
  ('a0000000-0000-0000-00dd-000000000002', pg_temp.id('a1'), 'Copa MT', current_date + 30, pg_temp.mod('mt'));
select throws_ok($$ insert into public.championship_entries (championship_id, academy_id, athlete_id)
  values ('a0000000-0000-0000-00dd-000000000002', pg_temp.id('a1'), pg_temp.id('s2')) $$,
  '42501', null, 'entry: direct insert refused for an athlete who does not compete in the championship''s modality');
select throws_ok($$ select public.set_championship_entries('a0000000-0000-0000-00dd-000000000002', array[pg_temp.id('s2')]) $$,
  '42501', null, 'entry: set_championship_entries refused for the same athlete');
select throws_ok($$ insert into public.championship_entries (championship_id, academy_id, athlete_id)
  values ('a0000000-0000-0000-00dd-000000000001', pg_temp.id('a1'), pg_temp.id('s')) $$,
  '42501', null, 'entry: refused for a student who competes in nothing');
select lives_ok($$ insert into public.championship_entries (championship_id, academy_id, athlete_id)
  values ('a0000000-0000-0000-00dd-000000000001', pg_temp.id('a1'), pg_temp.id('s2')) $$,
  'entry: direct insert allowed where the athlete competes');
select lives_ok($$ select public.set_championship_entries('a0000000-0000-0000-00dd-000000000001', array[pg_temp.id('s2')]) $$,
  'entry: set_championship_entries allowed where the athlete competes (idempotent)');

-- An entry that exists but whose modality the athlete does not compete in (legacy row) is not readable.
select pg_temp.logout();
insert into public.championship_entries (championship_id, academy_id, athlete_id)
values ('a0000000-0000-0000-00dd-000000000002', pg_temp.id('a1'), pg_temp.id('s2'));
select pg_temp.login(pg_temp.id('s2'));
select is((select array_agg(name) from public.championships), array['Copa JJ'],
  'read: a student reads only the championships of the modality they compete in');
select is((select count(*)::int from public.championship_entries), 1, 'read: and only the entries of that modality');
select pg_temp.login(pg_temp.id('s'));
select is((select count(*)::int from public.championships), 0, 'read: a non-competitor reads no championship');
select pg_temp.login(pg_temp.id('i'));
select is((select count(*)::int from public.championships), 2, 'read: staff read every championship');
select pg_temp.login(pg_temp.id('s2'));
select lives_ok($$ select public.remove_competitor(pg_temp.mid('s2'), pg_temp.mod('jj')) $$, 'competitor: S2 leaves the Jiu-Jitsu team');
select pg_temp.logout();
select is((select count(*)::int from public.championship_entries e where e.athlete_id = pg_temp.id('s2') and e.championship_id = 'a0000000-0000-0000-00dd-000000000001'),
  0, 'competitor: leaving a modality drops the future entries of that modality');

-- Ending the link (set_student_modalities) also drops competitor status and future entries.
select pg_temp.login(pg_temp.id('i'));
select public.invite_competitor(pg_temp.mid('s2'), pg_temp.mod('mt'));
select pg_temp.login(pg_temp.id('s2'));
select public.respond_competitor_invite(pg_temp.mid('s2'), pg_temp.mod('mt'), true);
select pg_temp.login(pg_temp.id('i'));
select public.set_student_modalities(pg_temp.mid('s2'), array[pg_temp.mod('jj')]);
select pg_temp.logout();
select is((select (select count(*) from public.championship_entries e where e.athlete_id = pg_temp.id('s2'))::int || '/' || m.is_competitor::text
           from public.memberships m where m.id = pg_temp.mid('s2')),
  '0/false', 'removing a modality ends the competitor status and the future entries of it');

-- =====================================================================
-- Weekly goal and ranking facts (R: JJ+MT, R2: JJ)
-- =====================================================================
update private.membership_active_periods set starts_at = now() - interval '40 days'
where membership_id in (pg_temp.mid('r'), pg_temp.mid('r2'));
update private.modality_active_periods set starts_at = now() - interval '40 days'
where enrollment_id in (select id from public.student_modality_enrollments where membership_id in (pg_temp.mid('r'), pg_temp.mid('r2')));

create function pg_temp.facts(p_user text, p_mod text) returns jsonb language sql as $$
  select to_jsonb(f) from private.ranking_facts_internal(pg_temp.id('a1'), pg_temp.mod(p_mod), pg_temp.today() - 5, pg_temp.today() - 1) f
  where f.user_id = pg_temp.id(p_user)
$$;
create function pg_temp.classes(p_user text, p_mod text, p_day date) returns int language sql as $$
  select (e->>'classes')::int from jsonb_array_elements(pg_temp.facts(p_user, p_mod)->'attendance') e where e->>'day' = p_day::text
$$;
create function pg_temp.scheduled(p_user text, p_mod text, p_day date) returns int language sql as $$
  select (e->>'scheduled')::int from jsonb_array_elements(pg_temp.facts(p_user, p_mod)->'attendance') e where e->>'day' = p_day::text
$$;
grant execute on function pg_temp.scheduled(text, text, date) to public;
create function pg_temp.done(p_user text, p_day date) returns boolean language sql as $$
  select (e->>'done')::boolean from jsonb_array_elements(pg_temp.facts(p_user, 'jj')->'hydration') e where e->>'day' = p_day::text
$$;
grant execute on function pg_temp.facts(text, text), pg_temp.classes(text, text, date), pg_temp.done(text, date) to public;

select pg_temp.login(pg_temp.id('o'));
-- Ranking presence follows the modality's grid: scheduled classes per eligible day.
select pg_temp.logout();
update public.class_schedules set created_at = now() - interval '40 days' where academy_id = pg_temp.id('a1');
select pg_temp.login(pg_temp.id('o'));
select is(pg_temp.scheduled('r', 'jj', pg_temp.today() - 3), 2, 'grid: both Jiu-Jitsu classes of that weekday');
select is(pg_temp.scheduled('r', 'mt', pg_temp.today() - 3), 1, 'grid: the Muay Thai ranking counts only its own classes');
select pg_temp.logout();
insert into public.class_schedules (academy_id, weekday, start_time, modality_id, active, created_at) values
  (pg_temp.id('a1'), extract(dow from pg_temp.today() - 4)::int, '21:00', pg_temp.mod('jj'), false, now() - interval '40 days'),
  (pg_temp.id('a1'), extract(dow from pg_temp.today() - 2)::int, '21:00', pg_temp.mod('jj'), true, now());
select pg_temp.login(pg_temp.id('o'));
select is(pg_temp.scheduled('r', 'jj', pg_temp.today() - 4), 2, 'grid: an inactive schedule is not counted');
select is(pg_temp.scheduled('r', 'jj', pg_temp.today() - 2), 2, 'grid: a schedule created after the day is not counted for it');
select pg_temp.logout();
delete from public.class_schedules where academy_id = pg_temp.id('a1') and start_time = '21:00';
select ok(to_regprocedure('public.set_student_weekly_goal(uuid,uuid,smallint)') is null, 'weekly goal: the per-student RPC is gone');
select hasnt_column('public', 'academy_modalities', 'weekly_class_goal', 'weekly goal: modalities have no goal');
select hasnt_column('public', 'student_modality_enrollments', 'weekly_class_goal', 'weekly goal: students have no goal');

-- Confirmed classes per day, by modality.
insert into public.checkins (user_id, academy_id, schedule_id, class_date, status) values
  (pg_temp.id('r'), pg_temp.id('a1'), pg_temp.sched('jj', pg_temp.today() - 3), pg_temp.today() - 3, 'confirmed'),
  (pg_temp.id('r'), pg_temp.id('a1'), pg_temp.sched('jj', pg_temp.today() - 3, '20'), pg_temp.today() - 3, 'confirmed'),
  (pg_temp.id('r'), pg_temp.id('a1'), pg_temp.sched('mt', pg_temp.today() - 3), pg_temp.today() - 3, 'confirmed'),
  (pg_temp.id('r'), pg_temp.id('a1'), pg_temp.sched('jj', pg_temp.today() - 2), pg_temp.today() - 2, 'pending');
select pg_temp.login(pg_temp.id('o'));
select is(jsonb_array_length(pg_temp.facts('r', 'jj')->'attendance'), 5, 'facts: one attendance entry per eligible day');
select is(pg_temp.classes('r', 'jj', pg_temp.today() - 3), 2, 'facts: two confirmed Jiu-Jitsu classes the same day count 2');
select is(pg_temp.classes('r', 'mt', pg_temp.today() - 3), 1, 'facts: the Muay Thai ranking counts only its own class');
select is(pg_temp.classes('r', 'jj', pg_temp.today() - 2), 0, 'facts: a pending check-in is not a class');
select is(pg_temp.classes('r', 'jj', pg_temp.today() - 4), 0, 'facts: a day without class has zero');
select is((select count(*)::int from private.ranking_facts_internal(pg_temp.id('a1'), pg_temp.mod('mt'), pg_temp.today() - 5, pg_temp.today() - 1) where user_id = pg_temp.id('r2')),
  0, 'facts: a student not linked to the modality is not a participant');

-- Water: a limit day is done between 90 % and 100 % of the goal; a goal day at or above it.
select pg_temp.logout();
insert into private.water_auto_goal_history (user_id, effective_on, goal_ml)
select pg_temp.id(k), pg_temp.today() - 30, 3000 from (values ('r'), ('r2')) x(k);
create temp table t_plan (k text primary key, id uuid) on commit drop;
insert into public.water_plans (athlete_id, academy_id, week_start)
select pg_temp.id(k), pg_temp.id('a1'), (pg_temp.today() - 14) - (extract(isodow from pg_temp.today() - 14)::int - 1)
from (values ('r'), ('r2')) x(k);
insert into t_plan select u.key, p.id from public.water_plans p join t_ids u on u.val = p.athlete_id where u.key in ('r', 'r2');
insert into private.water_plan_goal_history (plan_id, weekday, effective_on, target_ml, is_limit)
select p.id, d, pg_temp.today() - 20, 2000, p.k = 'r' from t_plan p, generate_series(0, 6) d;
insert into public.water_logs (id, user_id, amount_ml, logged_at)
select gen_random_uuid(), pg_temp.id(x.u), x.ml, ((pg_temp.today() + x.off)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo'
from (values ('r', -5, 1800), ('r', -4, 2100), ('r', -3, 1700), ('r', -2, 2000), ('r', -1, 1799),
             ('r2', -3, 2100), ('r2', -2, 2000), ('r2', -1, 1999)) x(u, off, ml);
select pg_temp.login(pg_temp.id('o'));
select is(pg_temp.done('r', pg_temp.today() - 5), true, 'limit day: 1800 of a 2000 limit is done (lower bound, 90 %)');
select is(pg_temp.done('r', pg_temp.today() - 4), false, 'limit day: 2100 is over the limit, not done');
select is(pg_temp.done('r', pg_temp.today() - 3), false, 'limit day: 1700 is under 90 %, not done');
select is(pg_temp.done('r', pg_temp.today() - 2), true, 'limit day: exactly the limit (2000) is done');
select is(pg_temp.done('r', pg_temp.today() - 1), false, 'limit day: 1799 is just under 90 %, not done');
select is(pg_temp.done('r2', pg_temp.today() - 3), true, 'goal day: above the goal is done');
select is(pg_temp.done('r2', pg_temp.today() - 2), true, 'goal day: exactly the goal is done');
select is(pg_temp.done('r2', pg_temp.today() - 1), false, 'goal day: below the goal is not done');

-- =====================================================================
-- Final consistency: every active student has a link at commit time
-- =====================================================================
select pg_temp.logout();
select lives_ok($$ set constraints enrollments_student_needs_modality, memberships_student_needs_modality immediate $$,
  'every active student of the fixture ends with at least one active modality');
set constraints enrollments_student_needs_modality, memberships_student_needs_modality deferred;

select * from finish();
rollback;
