begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('a2000000-0000-0000-0000-000000000001','owner@dailyranking.test','{"full_name":"Owner"}'),
('a2000000-0000-0000-0000-000000000002','student@dailyranking.test','{"full_name":"Student"}');
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temp table ids(k text primary key,v uuid);
insert into ids values('academy',public.create_academy('Daily ranking',array['BJJ']));
insert into ids select 'modality',id from public.academy_modalities where academy_id=(select v from ids where k='academy');
insert into public.memberships(user_id,academy_id,role,status) values
('a2000000-0000-0000-0000-000000000002',(select v from ids where k='academy'),'student','active');
update private.membership_active_periods set starts_at=now()-interval '40 days'
where membership_id in(select m.id from public.memberships m where m.user_id='a2000000-0000-0000-0000-000000000002');
insert into public.student_modality_enrollments(membership_id,modality_id,status)
select m.id,(select v from ids where k='modality'),'active' from public.memberships m where m.user_id='a2000000-0000-0000-0000-000000000002';
insert into private.modality_active_periods(enrollment_id,starts_at)
select e.id,now()-interval '40 days' from public.student_modality_enrollments e
join public.memberships m on m.id=e.membership_id where m.user_id='a2000000-0000-0000-0000-000000000002';
insert into private.water_auto_goal_history(user_id,effective_on,goal_ml) values
('a2000000-0000-0000-0000-000000000002',private.academy_local_date((select v from ids where k='academy'))-28,2000);
insert into public.water_plans(athlete_id,academy_id,week_start) values
('a2000000-0000-0000-0000-000000000002',(select v from ids where k='academy'),
date_trunc('week',private.academy_local_date((select v from ids where k='academy'))-1)::date);
insert into private.water_plan_goal_history(plan_id,weekday,effective_on,target_ml,is_limit)
select p.id,extract(dow from private.academy_local_date(p.academy_id)-1),
private.academy_local_date(p.academy_id)-1,2000,true from public.water_plans p where p.athlete_id='a2000000-0000-0000-0000-000000000002';
insert into public.water_logs(id,user_id,amount_ml,logged_at)
select gen_random_uuid(),'a2000000-0000-0000-0000-000000000002',1800,
(private.academy_local_date((select v from ids where k='academy'))-1+time '12:00') at time zone 'America/Sao_Paulo';
select public.recalculate_ranking((select v from ids where k='academy'));
select is((select hydration_goals_achieved from public.ranking_details where user_id='a2000000-0000-0000-0000-000000000002'),1,'90% completes a limit day in server ranking');
insert into public.water_logs(id,user_id,amount_ml,logged_at)
select gen_random_uuid(),'a2000000-0000-0000-0000-000000000002',201,
(private.academy_local_date((select v from ids where k='academy'))-1+time '13:00') at time zone 'America/Sao_Paulo';
select public.recalculate_ranking((select v from ids where k='academy'));
select is((select hydration_goals_achieved from public.ranking_details where user_id='a2000000-0000-0000-0000-000000000002'),0,'above 100% is not completed in server ranking');
select ok(to_regprocedure('public.academy_ranking_facts(uuid,uuid,date,date)') is null,'raw colleague facts are absent');
select * from finish();
rollback;
