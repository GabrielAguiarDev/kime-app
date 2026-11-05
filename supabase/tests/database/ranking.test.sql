-- Server facts and access; score/freeze calculations are exercised in Jest.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$ begin
 perform set_config('role', 'authenticated', true);
 perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$ begin
 perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
end $$;
grant execute on function pg_temp.login(uuid), pg_temp.logout() to public;
create temp table ids(k text primary key, v uuid);
grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k = $1$$;
grant execute on function pg_temp.id(text) to public;
insert into auth.users(id,email,raw_user_meta_data) values
 ('90000000-0000-0000-0000-000000000001','owner@gamified.test','{"full_name":"Owner"}'),
 ('90000000-0000-0000-0000-000000000002','student@gamified.test','{"full_name":"Student"}'),
 ('90000000-0000-0000-0000-000000000003','other@gamified.test','{"full_name":"Other"}');
insert into ids values ('owner','90000000-0000-0000-0000-000000000001'),('student','90000000-0000-0000-0000-000000000002'),('other','90000000-0000-0000-0000-000000000003');
select pg_temp.login(pg_temp.id('owner'));
insert into ids values ('academy',public.create_academy('Ranking tests',array['BJJ']));
select pg_temp.logout();
insert into ids select 'modality',id from public.academy_modalities where academy_id=pg_temp.id('academy') limit 1;
insert into public.memberships(id,user_id,academy_id,role,status,created_at,decided_at)
values ('90000000-0000-0000-0000-000000000004',pg_temp.id('student'),pg_temp.id('academy'),'student','active',now()-interval '40 days',now()-interval '30 days');
insert into ids values ('membership','90000000-0000-0000-0000-000000000004');
update private.membership_active_periods set starts_at=now()-interval '30 days' where membership_id=pg_temp.id('membership');
insert into public.class_schedules(id,academy_id,weekday,start_time,modality_id) values
 ('90000000-0000-0000-0000-000000000005',pg_temp.id('academy'),extract(dow from private.academy_local_date(pg_temp.id('academy'))-1),'10:00',pg_temp.id('modality')),
 ('90000000-0000-0000-0000-000000000006',pg_temp.id('academy'),extract(dow from private.academy_local_date(pg_temp.id('academy'))-1),'12:00',pg_temp.id('modality'));
insert into ids values ('required','90000000-0000-0000-0000-000000000005'),('optional','90000000-0000-0000-0000-000000000006');
insert into public.student_class_enrollments(membership_id,schedule_id,starts_on,weekday,start_time,modality_id)
select pg_temp.id('membership'),id,private.academy_local_date(academy_id)-20,weekday,start_time,modality_id from public.class_schedules where id=pg_temp.id('required');
insert into public.student_modality_enrollments(membership_id,modality_id,status) values(pg_temp.id('membership'),pg_temp.id('modality'),'active');
insert into private.modality_active_periods(enrollment_id,starts_at)
select id,now()-interval '30 days' from public.student_modality_enrollments where membership_id=pg_temp.id('membership');
create function pg_temp.facts() returns jsonb language sql as $$
select to_jsonb(r) from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),private.academy_local_date(pg_temp.id('academy'))-1,private.academy_local_date(pg_temp.id('academy'))-1) r where r.user_id=pg_temp.id('student')$$;
grant execute on function pg_temp.facts() to public;
select pg_temp.login(pg_temp.id('student'));
select is(jsonb_array_length(pg_temp.facts()->'attendance'),1,'only the explicitly required class is eligible');
select is(pg_temp.facts()->'attendance'->0->>'done','false','a required absence is an uncompleted obligation');
select throws_ok($$select public.set_student_class_enrollment(pg_temp.id('membership'),pg_temp.id('optional'),true)$$,'42501','forbidden','student cannot assign their own obligations');
select throws_ok($$update public.student_class_enrollments set ends_on=current_date$$,'42501',null,'student cannot remove past obligations');
select throws_ok($$insert into public.water_goal_days(user_id,day,goal_ml) values(pg_temp.id('student'),current_date,1)$$,'42501',null,'client cannot forge a hydration goal');
select throws_ok($$update public.water_goal_days set goal_ml=1$$,'42501',null,'client cannot change historical targets');
select pg_temp.logout();
insert into public.checkins(user_id,academy_id,schedule_id,class_date,status)
values(pg_temp.id('student'),pg_temp.id('academy'),pg_temp.id('required'),private.academy_local_date(pg_temp.id('academy'))-1,'confirmed');
select is(pg_temp.facts()->'attendance'->0->>'done','true','confirmed check-in completes the required class');
select throws_ok($$insert into public.checkins(user_id,academy_id,schedule_id,class_date,status) values(pg_temp.id('student'),pg_temp.id('academy'),pg_temp.id('required'),private.academy_local_date(pg_temp.id('academy'))-1,'confirmed')$$,'23505',null,'duplicate check-in is rejected');
insert into public.checkins(user_id,academy_id,schedule_id,class_date,status)
values(pg_temp.id('student'),pg_temp.id('academy'),pg_temp.id('optional'),private.academy_local_date(pg_temp.id('academy'))-1,'confirmed');
select is(jsonb_array_length(pg_temp.facts()->'attendance'),1,'optional attendance supplies no unfair extra points or obligations');
insert into public.class_attendance_exceptions(academy_id,schedule_id,class_date,reason)
values(pg_temp.id('academy'),pg_temp.id('required'),private.academy_local_date(pg_temp.id('academy'))-1,'Cancelled');
select is(jsonb_array_length(pg_temp.facts()->'attendance'),0,'cancelled class is excluded');
delete from public.class_attendance_exceptions;
insert into public.class_attendance_exceptions(academy_id,schedule_id,membership_id,class_date,reason)
values(pg_temp.id('academy'),pg_temp.id('required'),pg_temp.id('membership'),private.academy_local_date(pg_temp.id('academy'))-1,'Justified absence');
select is(jsonb_array_length(pg_temp.facts()->'attendance'),0,'justified absence is excluded');
delete from public.class_attendance_exceptions;
update private.membership_active_periods set starts_at=now() where membership_id=pg_temp.id('membership');
select is(jsonb_array_length(pg_temp.facts()->'attendance'),0,'no obligation before membership activation');
update private.membership_active_periods set starts_at=now()-interval '30 days',ends_at=now()-interval '2 days' where membership_id=pg_temp.id('membership');
select is(jsonb_array_length(pg_temp.facts()->'attendance'),0,'inactive interval does not generate an obligation');
update private.membership_active_periods set ends_at=null where membership_id=pg_temp.id('membership');
-- Historical observations are exact; current weight must never be backfilled.
insert into public.water_goal_days(user_id,day,goal_ml)
values (pg_temp.id('student'),private.academy_local_date(pg_temp.id('academy'))-2,2000),
       (pg_temp.id('student'),private.academy_local_date(pg_temp.id('academy'))-1,3000);
insert into public.water_logs(id,user_id,amount_ml,logged_at)
values(gen_random_uuid(),pg_temp.id('student'),2000,((private.academy_local_date(pg_temp.id('academy'))-2)::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo'),
(gen_random_uuid(),pg_temp.id('student'),3000,((private.academy_local_date(pg_temp.id('academy'))-1)::timestamp+interval '12 hours') at time zone 'America/Sao_Paulo');
select is((select hydration->-1->>'done' from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),private.academy_local_date(pg_temp.id('academy'))-28,private.academy_local_date(pg_temp.id('academy'))-1) where user_id=pg_temp.id('student')),'true','individual goal reached');
update public.profiles set weight_kg=100 where id=pg_temp.id('student');
select is(private.ranking_water_goal(pg_temp.id('student'),pg_temp.id('academy'),private.academy_local_date(pg_temp.id('academy'))-2),2000,'weight change preserves the earlier goal');
select is(private.ranking_water_goal(pg_temp.id('student'),pg_temp.id('academy'),private.academy_local_date(pg_temp.id('academy'))-1),3000,'later day has its own goal');
select is(private.ranking_water_goal(pg_temp.id('student'),pg_temp.id('academy'),private.academy_local_date(pg_temp.id('academy'))-3),null::integer,'unknown historical goal is not invented');
select ok(not exists(select 1 from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),private.academy_local_date(pg_temp.id('academy'))-28,private.academy_local_date(pg_temp.id('academy'))-1) r, lateral jsonb_array_elements(r.hydration) d where (d->>'day')::date>=r.today),'today never appears as a completed or failed hydration day');
select ok(not exists(select 1 from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),private.academy_local_date(pg_temp.id('academy'))-28,private.academy_local_date(pg_temp.id('academy'))-1) r,lateral jsonb_array_elements(r.hydration) d where d ? 'goal_ml' or d ? 'total_ml'),'classmates receive no weight, goal or consumption amounts');
select pg_temp.login(pg_temp.id('owner'));
select lives_ok($$select public.set_student_class_enrollment(pg_temp.id('membership'),pg_temp.id('optional'),true)$$,'staff can explicitly enrol in a required class');
select is((select starts_on from public.student_class_enrollments where schedule_id=pg_temp.id('optional')),private.academy_local_date(pg_temp.id('academy'))+1,'new obligation starts tomorrow, not retroactively');
select lives_ok($$select public.set_student_class_enrollment(pg_temp.id('membership'),pg_temp.id('optional'),true)$$,'enrolment retry is idempotent');
select is((select count(*)::int from public.student_class_enrollments where schedule_id=pg_temp.id('optional')),1,'retry creates no duplicate commitment');
select pg_temp.login(pg_temp.id('student'));
select lives_ok($$select public.record_my_water_goal()$$,'server records current goal without trusting client goal or date');
select is((select goal_ml from public.water_goal_days where user_id=pg_temp.id('student') and day=private.academy_local_date(pg_temp.id('academy'))),3500,'server derives goal from profile weight');
select pg_temp.logout();
update public.profiles set show_in_ranking=false where id=pg_temp.id('student');
select pg_temp.login(pg_temp.id('owner'));
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),private.academy_local_date(pg_temp.id('academy'))-28,private.academy_local_date(pg_temp.id('academy'))-1)),0,'privacy opt-out is preserved');
select pg_temp.login(pg_temp.id('other'));
select throws_ok($$select * from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),private.academy_local_date(pg_temp.id('academy'))-28,private.academy_local_date(pg_temp.id('academy'))-1)$$,'42501','forbidden','outsider cannot read ranking facts');
select throws_ok($$select public.set_student_class_enrollment(pg_temp.id('membership'),pg_temp.id('optional'),true)$$,'42501','forbidden','outsider cannot assign obligations');
select pg_temp.login(pg_temp.id('owner'));
select throws_ok($$select * from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('modality'),'2027-01-02','2026-01-01')$$,'22023','invalid_ranking_period','invalid custom period rejected');
select pg_temp.logout();
update public.profiles set show_in_ranking=true where id=pg_temp.id('student');
select pg_temp.login(pg_temp.id('student'));
select is(pg_temp.facts(),pg_temp.facts(),'repeated queries are deterministic');
select pg_temp.logout();
delete from public.class_schedules where id=pg_temp.id('required');
select pg_temp.login(pg_temp.id('student'));
select is(jsonb_array_length(pg_temp.facts()->'attendance'),1,'schedule deletion preserves past expected occurrence');
select is(pg_temp.facts()->'attendance'->0->>'done','true','schedule deletion preserves its confirmed attendance');
select * from finish();
rollback;
