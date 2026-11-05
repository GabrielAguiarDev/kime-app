begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.login(u uuid) returns void language plpgsql as $$begin
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
end$$;
create function pg_temp.admin() returns void language plpgsql as $$begin perform set_config('role','postgres',true);end$$;
grant execute on function pg_temp.login(uuid),pg_temp.admin() to public;
insert into auth.users(id,email,raw_user_meta_data) values
('a1000000-0000-0000-0000-000000000001','owner@privacy.test','{"full_name":"Owner"}'),
('a1000000-0000-0000-0000-000000000002','bjj@privacy.test','{"full_name":"BJJ"}'),
('a1000000-0000-0000-0000-000000000003','peer@privacy.test','{"full_name":"Peer"}'),
('a1000000-0000-0000-0000-000000000004','other@privacy.test','{"full_name":"Other"}');
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
insert into ids values('academy',public.create_academy('Privacy',array['BJJ','Boxe']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status) values
('a1000000-0000-0000-0000-000000000002',pg_temp.id('academy'),'student','active'),
('a1000000-0000-0000-0000-000000000003',pg_temp.id('academy'),'student','active'),
('a1000000-0000-0000-0000-000000000004',pg_temp.id('academy'),'student','active');
insert into public.student_modality_enrollments(membership_id,modality_id,status)
select m.id,case when m.user_id='a1000000-0000-0000-0000-000000000004' then pg_temp.id('Boxe') else pg_temp.id('BJJ') end,'active'
from public.memberships m where m.academy_id=pg_temp.id('academy') and m.role='student';
insert into ids values('schedule',gen_random_uuid());
insert into public.class_schedules(id,academy_id,weekday,start_time,modality_id)
values(pg_temp.id('schedule'),pg_temp.id('academy'),extract(dow from private.academy_local_date(pg_temp.id('academy'))),'18:00',pg_temp.id('BJJ'));
insert into public.checkins(user_id,academy_id,schedule_id,class_date,status) values
('a1000000-0000-0000-0000-000000000003',pg_temp.id('academy'),pg_temp.id('schedule'),private.academy_local_date(pg_temp.id('academy')),'pending');
insert into public.ranking_snapshots(academy_id,modality_id,user_id,period_from,period_to,full_name,score,status)
values(pg_temp.id('academy'),pg_temp.id('BJJ'),'a1000000-0000-0000-0000-000000000002',current_date-28,current_date-1,'BJJ',50,'ranked'),
(pg_temp.id('academy'),pg_temp.id('BJJ'),'a1000000-0000-0000-0000-000000000003',current_date-28,current_date-1,'Peer',70,'ranked');
insert into public.ranking_details(academy_id,modality_id,user_id,attendance_rate,hydration_rate,confirmed_classes,weekly_goal,weeks,hydration_goals_achieved,eligible_hydration_days,protected_days,eligible_days,days_to_qualify)
select academy_id,modality_id,user_id,0.5,0.5,2,2,4,10,20,1,28,0 from public.ranking_snapshots where academy_id=pg_temp.id('academy');
insert into storage.objects(bucket_id,name,owner_id) values
('avatars','a1000000-0000-0000-0000-000000000002/avatar.jpg','a1000000-0000-0000-0000-000000000002'),
('avatars','a1000000-0000-0000-0000-000000000003/avatar.jpg','a1000000-0000-0000-0000-000000000003'),
('avatars','a1000000-0000-0000-0000-000000000004/avatar.jpg','a1000000-0000-0000-0000-000000000004');
insert into ids values('other_academy',public.create_academy('Other academy',array['Judo']));
insert into ids select 'other_modality',id from public.academy_modalities where academy_id=pg_temp.id('other_academy');
insert into ids values('other_schedule',gen_random_uuid());
insert into public.class_schedules(id,academy_id,weekday,start_time,modality_id)
values(pg_temp.id('other_schedule'),pg_temp.id('other_academy'),extract(dow from private.academy_local_date(pg_temp.id('other_academy'))),'19:00',pg_temp.id('other_modality'));
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select throws_ok(format('select * from public.class_attendees(%L,%L)',pg_temp.id('other_schedule'),private.academy_local_date(pg_temp.id('other_academy'))),'42501','forbidden','student cannot read another academy class');
select is((select count(*)::int from storage.objects where bucket_id='avatars'),2,'student reads only own and same-modality avatar');
select is((select count(*)::int from public.ranking_snapshots where academy_id=pg_temp.id('academy') and modality_id=pg_temp.id('BJJ')),2,'linked student sees BJJ ranking');
select is((select count(*)::int from public.ranking_details where academy_id=pg_temp.id('academy')),1,'student sees own details only');
select is((select count(*)::int from public.class_attendees(pg_temp.id('schedule'),private.academy_local_date(pg_temp.id('academy')))),1,'classmate sees pending attendee');
select throws_ok(format('select * from public.class_attendees(%L,%L)',pg_temp.id('schedule'),private.academy_local_date(pg_temp.id('academy'))-1),'42501','forbidden','past check-ins forbidden');
select pg_temp.admin();
update public.profiles set show_in_ranking=false where id='a1000000-0000-0000-0000-000000000003';
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.ranking_snapshots where modality_id=pg_temp.id('BJJ')),1,'ranking opt-out hides the student immediately');
select pg_temp.admin();
update public.profiles set show_checkins_to_peers=false where id='a1000000-0000-0000-0000-000000000003';
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.class_attendees(pg_temp.id('schedule'),private.academy_local_date(pg_temp.id('academy')))),0,'opted out peer hidden');
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.class_attendees(pg_temp.id('schedule'),private.academy_local_date(pg_temp.id('academy')))),1,'staff sees opted out student');
select pg_temp.login('a1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.ranking_snapshots where modality_id=pg_temp.id('BJJ')),0,'unlinked student cannot read ranking');
select throws_ok(format('select * from public.class_attendees(%L,%L)',pg_temp.id('schedule'),private.academy_local_date(pg_temp.id('academy'))),'42501','forbidden','unlinked student cannot read class');
select * from finish();
rollback;
