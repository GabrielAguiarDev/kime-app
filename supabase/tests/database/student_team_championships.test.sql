-- Student app (2026-11-06): classmates, championships of the modality and the
-- staff's photos. Students see only members who share a modality, only the
-- championships of their modalities, and no health data of classmates.
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
('a2000000-0000-0000-0000-000000000001','owner@team.test','{"full_name":"Owner"}'),
('a2000000-0000-0000-0000-000000000002','bjj@team.test','{"full_name":"Ana"}'),
('a2000000-0000-0000-0000-000000000003','peer@team.test','{"full_name":"Bia"}'),
('a2000000-0000-0000-0000-000000000004','boxe@team.test','{"full_name":"Caio"}');
select pg_temp.login('a2000000-0000-0000-0000-000000000001');
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
insert into ids values('academy',public.create_academy('Team',array['BJJ','Boxe']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status) values
('a2000000-0000-0000-0000-000000000002',pg_temp.id('academy'),'student','active'),
('a2000000-0000-0000-0000-000000000003',pg_temp.id('academy'),'student','active'),
('a2000000-0000-0000-0000-000000000004',pg_temp.id('academy'),'student','active');
insert into public.student_modality_enrollments(membership_id,modality_id,status,is_competitor,competitor_since)
select m.id,
  case when m.user_id='a2000000-0000-0000-0000-000000000004' then pg_temp.id('Boxe') else pg_temp.id('BJJ') end,
  'active',
  m.user_id='a2000000-0000-0000-0000-000000000003',
  case when m.user_id='a2000000-0000-0000-0000-000000000003' then now() end
from public.memberships m where m.academy_id=pg_temp.id('academy') and m.role='student';
insert into ids values('bjj_cup',gen_random_uuid()),('boxe_cup',gen_random_uuid());
insert into public.championships(id,academy_id,modality_id,name,event_date) values
(pg_temp.id('bjj_cup'),pg_temp.id('academy'),pg_temp.id('BJJ'),'Copa BJJ',current_date+10),
(pg_temp.id('boxe_cup'),pg_temp.id('academy'),pg_temp.id('Boxe'),'Copa Boxe',current_date+10);
insert into public.championship_entries(championship_id,academy_id,athlete_id)
values(pg_temp.id('bjj_cup'),pg_temp.id('academy'),'a2000000-0000-0000-0000-000000000003');
insert into public.weight_logs(athlete_id,logged_on,weight_kg)
values('a2000000-0000-0000-0000-000000000003',current_date,70);
insert into storage.objects(bucket_id,name,owner_id) values
('avatars','a2000000-0000-0000-0000-000000000001/avatar.jpg','a2000000-0000-0000-0000-000000000001'),
('avatars','a2000000-0000-0000-0000-000000000003/avatar.jpg','a2000000-0000-0000-0000-000000000003'),
('avatars','a2000000-0000-0000-0000-000000000004/avatar.jpg','a2000000-0000-0000-0000-000000000004');

-- Ana (BJJ)
select pg_temp.login('a2000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.classmates(pg_temp.id('academy'))),3,'student sees the staff, themself and the BJJ classmate');
select is((select count(*)::int from public.classmates(pg_temp.id('academy')) where user_id='a2000000-0000-0000-0000-000000000004'),0,'student does not see a member without a modality in common');
select is((select (modalities->0->>'is_competitor')::boolean from public.classmates(pg_temp.id('academy')) where user_id='a2000000-0000-0000-0000-000000000003'),true,'competitor seal of the modality in common');
select is((select count(*)::int from public.championships),1,'student reads only the championships of their modalities');
select is((select name from public.championships),'Copa BJJ','the BJJ championship');
select is((select count(*)::int from public.championship_competitors(pg_temp.id('bjj_cup'))),1,'student lists the competitors entered');
select throws_ok(format('select * from public.championship_competitors(%L)',pg_temp.id('boxe_cup')),'42501','forbidden','not the competitors of another modality');
select is((select count(*)::int from public.championship_entries),0,'raw entries of others stay hidden');
select is((select count(*)::int from public.weight_logs),0,'no weight of classmates');
select is((select count(*)::int from public.water_logs where user_id<>'a2000000-0000-0000-0000-000000000002'),0,'no water of classmates');
select is((select count(*)::int from storage.objects where bucket_id='avatars'),2,'photos of the staff and of the classmate only');

-- Caio (Boxe)
select pg_temp.login('a2000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.classmates(pg_temp.id('academy')) where role='student'),1,'boxe student sees only themself among students');
select is((select name from public.championships),'Copa Boxe','only the Boxe championship');

-- Staff use their own screens.
select pg_temp.login('a2000000-0000-0000-0000-000000000001');
select throws_ok(format('select * from public.classmates(%L)',pg_temp.id('academy')),'42501','forbidden','classmates() is for students');

select * from finish();
rollback;
