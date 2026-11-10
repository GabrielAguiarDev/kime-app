-- Academy events (2026-11-10): owner and professor create, edit and cancel,
-- mark attendance and payment; members see only the events of their
-- modalities (or "all") and manage only their own answer.
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

-- 1 owner · 2 professor · 3 Ana (BJJ) · 4 Bia (BJJ) · 5 Caio (Boxe) · 6 outsider
insert into auth.users(id,email,raw_user_meta_data) values
('e1000000-0000-0000-0000-000000000001','owner@ev.test','{"full_name":"Owner"}'),
('e1000000-0000-0000-0000-000000000002','prof@ev.test','{"full_name":"Prof"}'),
('e1000000-0000-0000-0000-000000000003','ana@ev.test','{"full_name":"Ana"}'),
('e1000000-0000-0000-0000-000000000004','bia@ev.test','{"full_name":"Bia"}'),
('e1000000-0000-0000-0000-000000000005','caio@ev.test','{"full_name":"Caio"}'),
('e1000000-0000-0000-0000-000000000006','out@ev.test','{"full_name":"Out"}');
select pg_temp.login('e1000000-0000-0000-0000-000000000001');
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
insert into ids values('academy',public.create_academy('Team',array['BJJ','Boxe']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status) values
('e1000000-0000-0000-0000-000000000002',pg_temp.id('academy'),'instructor','active'),
('e1000000-0000-0000-0000-000000000003',pg_temp.id('academy'),'student','active'),
('e1000000-0000-0000-0000-000000000004',pg_temp.id('academy'),'student','active'),
('e1000000-0000-0000-0000-000000000005',pg_temp.id('academy'),'student','active');
insert into public.student_modality_enrollments(membership_id,modality_id,status)
select m.id,
  case when m.user_id='e1000000-0000-0000-0000-000000000005' then pg_temp.id('Boxe') else pg_temp.id('BJJ') end,
  'active'
from public.memberships m where m.academy_id=pg_temp.id('academy') and m.role='student';
insert into storage.objects(bucket_id,name,owner_id) values
('avatars','e1000000-0000-0000-0000-000000000005/avatar.jpg','e1000000-0000-0000-0000-000000000005');

-- ---------------------------------------------------------------- create ---
select pg_temp.login('e1000000-0000-0000-0000-000000000002');
insert into ids values('party',public.save_academy_event(null,pg_temp.id('academy'),'Confraternização',null,
  current_date+7,'19:00',null,null,null,null,null,null,null));
select ok(pg_temp.id('party') is not null,'professor creates an event for all modalities');
insert into ids values('boxe_seminar',public.save_academy_event(null,pg_temp.id('academy'),'Seminário de Boxe','Técnica',
  current_date+3,'10:00','12:00','Ginásio',array[pg_temp.id('Boxe')],4000,1,current_date+1,null));
select is((select count(*)::int from public.academy_event_modalities where event_id=pg_temp.id('boxe_seminar')),1,'event of some modalities keeps them');
select is((select created_by from public.academy_events where id=pg_temp.id('party')),'e1000000-0000-0000-0000-000000000002'::uuid,'creator stamped');

select pg_temp.login('e1000000-0000-0000-0000-000000000001');
insert into ids values('bjj_today',public.save_academy_event(null,pg_temp.id('academy'),'Aula especial',null,
  current_date,'08:00',null,null,array[pg_temp.id('BJJ')],null,2,null,null));
select ok(pg_temp.id('bjj_today') is not null,'owner creates an event');

select pg_temp.login('e1000000-0000-0000-0000-000000000003');
select throws_ok(format($q$select public.save_academy_event(null,%L,'Festa',null,current_date+1,'20:00',null,null,null,null,null,null,null)$q$,
  pg_temp.id('academy')),'42501','forbidden','student cannot create an event');
select throws_ok(format($q$insert into public.academy_events(academy_id,title,event_date,start_time) values(%L,'Festa',current_date,'20:00')$q$,
  pg_temp.id('academy')),'42501',null,'student cannot insert an event directly');
update public.academy_events set title='Hack' where id=pg_temp.id('party');
select pg_temp.admin();
select is((select title from public.academy_events where id=pg_temp.id('party')),'Confraternização','student cannot edit an event');

-- ------------------------------------------------------------ visibility ---
select pg_temp.login('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.academy_events),2,'BJJ student sees the "all" event and the BJJ event');
select is((select count(*)::int from public.academy_events where id=pg_temp.id('boxe_seminar')),0,'BJJ student does not see the Boxe event');
select throws_ok(format('select * from public.academy_event_people(%L)',pg_temp.id('boxe_seminar')),'42501','forbidden','no people of an event they cannot see');

select pg_temp.login('e1000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.academy_events),2,'Boxe student sees the "all" event and the Boxe event');

select pg_temp.login('e1000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.academy_events),0,'outsider sees nothing');

select pg_temp.login('e1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.academy_events),3,'staff sees every event of the academy');

-- ----------------------------------------------------------------- RSVPs ---
select pg_temp.login('e1000000-0000-0000-0000-000000000005');
insert into public.academy_event_rsvps(event_id,user_id,status) values(pg_temp.id('boxe_seminar'),'e1000000-0000-0000-0000-000000000005','going');
select is((select status::text from public.academy_event_rsvps where event_id=pg_temp.id('boxe_seminar') and user_id='e1000000-0000-0000-0000-000000000005'),'going','student answers "going"');
insert into public.academy_event_rsvps(event_id,user_id,status) values(pg_temp.id('party'),'e1000000-0000-0000-0000-000000000005','going');
select throws_ok(format($q$insert into public.academy_event_rsvps(event_id,user_id,status) values(%L,'e1000000-0000-0000-0000-000000000003','going')$q$,
  pg_temp.id('party')),'42501',null,'cannot answer for someone else');

select pg_temp.login('e1000000-0000-0000-0000-000000000003');
select throws_ok(format($q$insert into public.academy_event_rsvps(event_id,user_id,status) values(%L,'e1000000-0000-0000-0000-000000000003','going')$q$,
  pg_temp.id('boxe_seminar')),null,null,'cannot answer an event of another modality');
insert into public.academy_event_rsvps(event_id,user_id,status) values(pg_temp.id('party'),'e1000000-0000-0000-0000-000000000003','not_going');
update public.academy_event_rsvps set status='going' where event_id=pg_temp.id('party') and user_id='e1000000-0000-0000-0000-000000000003';
select is((select status::text from public.academy_event_rsvps where event_id=pg_temp.id('party') and user_id='e1000000-0000-0000-0000-000000000003'),'going','student changes their answer');
update public.academy_event_rsvps set status='not_going' where event_id=pg_temp.id('party') and user_id='e1000000-0000-0000-0000-000000000005';
select pg_temp.admin();
select is((select status::text from public.academy_event_rsvps where event_id=pg_temp.id('party') and user_id='e1000000-0000-0000-0000-000000000005'),'going','cannot change someone else''s answer');

-- The going list is visible to members who see the event (check-in preference does not apply).
select pg_temp.login('e1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.academy_event_rsvps where event_id=pg_temp.id('party')),2,'member sees who is going');
select is((select count(*)::int from public.academy_event_people(pg_temp.id('party'))),3,'people: who is going plus the member''s own row');
select is((select count(*)::int from public.academy_event_people(pg_temp.id('party')) where status is null and user_id<>'e1000000-0000-0000-0000-000000000004'),0,'member does not see who has not answered');
select is((select count(*)::int from public.academy_event_people(pg_temp.id('party')) where attended is not null and user_id<>'e1000000-0000-0000-0000-000000000004'),0,'member gets no attendance of others');
select is((select count(*)::int from storage.objects where bucket_id='avatars' and name like 'e1000000-0000-0000-0000-000000000005/%'),1,
  'member sees the photo of someone going from another modality');
select pg_temp.login('e1000000-0000-0000-0000-000000000003');
insert into public.academy_event_rsvps(event_id,user_id,status) values(pg_temp.id('bjj_today'),'e1000000-0000-0000-0000-000000000003','not_going');
select pg_temp.login('e1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.academy_event_rsvps where event_id=pg_temp.id('bjj_today')),0,'"not going" of others stays hidden');

-- Capacity (1 spot on the Boxe seminar, taken by Caio).
select pg_temp.admin();
insert into public.memberships(user_id,academy_id,role,status) values
('e1000000-0000-0000-0000-000000000006',pg_temp.id('academy'),'student','active');
insert into public.student_modality_enrollments(membership_id,modality_id,status)
select id,pg_temp.id('Boxe'),'active' from public.memberships where user_id='e1000000-0000-0000-0000-000000000006';
select pg_temp.login('e1000000-0000-0000-0000-000000000006');
select throws_ok(format($q$insert into public.academy_event_rsvps(event_id,user_id,status) values(%L,'e1000000-0000-0000-0000-000000000006','going')$q$,
  pg_temp.id('boxe_seminar')),'P0001','event_full','no "going" without spots');
insert into public.academy_event_rsvps(event_id,user_id,status) values(pg_temp.id('boxe_seminar'),'e1000000-0000-0000-0000-000000000006','not_going');
select is((select count(*)::int from public.academy_event_rsvps where event_id=pg_temp.id('boxe_seminar') and user_id='e1000000-0000-0000-0000-000000000006'),1,'"not going" is fine when full');

-- Deadline passed.
select pg_temp.admin();
update public.academy_events set rsvp_deadline=current_date-1, event_date=current_date+3 where id=pg_temp.id('boxe_seminar');
select pg_temp.login('e1000000-0000-0000-0000-000000000005');
select throws_ok(format($q$update public.academy_event_rsvps set status='not_going' where event_id=%L and user_id='e1000000-0000-0000-0000-000000000005'$q$,
  pg_temp.id('boxe_seminar')),'P0001','event_rsvp_closed','no change after the deadline');

-- ------------------------------------------------------ attendance/payment ---
select pg_temp.login('e1000000-0000-0000-0000-000000000003');
select throws_ok(format($q$insert into public.academy_event_attendance(event_id,user_id) values(%L,'e1000000-0000-0000-0000-000000000003')$q$,
  pg_temp.id('bjj_today')),'42501',null,'student cannot mark attendance');

select pg_temp.login('e1000000-0000-0000-0000-000000000002');
select throws_ok(format($q$insert into public.academy_event_attendance(event_id,user_id) values(%L,'e1000000-0000-0000-0000-000000000003')$q$,
  pg_temp.id('party')),'42501',null,'no attendance before the event day');
insert into public.academy_event_attendance(event_id,user_id) values(pg_temp.id('bjj_today'),'e1000000-0000-0000-0000-000000000004');
select is((select marked_by from public.academy_event_attendance where event_id=pg_temp.id('bjj_today')),'e1000000-0000-0000-0000-000000000002'::uuid,'professor marks attendance on the day, stamped');
select throws_ok(format($q$insert into public.academy_event_attendance(event_id,user_id) values(%L,'e1000000-0000-0000-0000-000000000005')$q$,
  pg_temp.id('bjj_today')),'42501',null,'only people of the event''s modalities');
select throws_ok(format($q$insert into public.academy_event_payments(event_id,user_id) values(%L,'e1000000-0000-0000-0000-000000000003')$q$,
  pg_temp.id('party')),'42501',null,'no payment on a free event');
insert into public.academy_event_payments(event_id,user_id) values(pg_temp.id('boxe_seminar'),'e1000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.academy_event_payments),1,'staff marks payment on a paid event');
select is((select count(*)::int from public.academy_event_people(pg_temp.id('bjj_today'))),4,'staff sees the whole audience: BJJ students and staff, answered or not');
select is((select attended from public.academy_event_people(pg_temp.id('bjj_today')) where user_id='e1000000-0000-0000-0000-000000000004'),true,'staff sees attendance');
delete from public.academy_event_attendance where event_id=pg_temp.id('bjj_today');
select is((select count(*)::int from public.academy_event_attendance),0,'staff unmarks attendance');

select pg_temp.login('e1000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.academy_event_payments),1,'student reads own payment');
delete from public.academy_event_payments;
select pg_temp.admin();
select is((select count(*)::int from public.academy_event_payments),1,'student cannot unmark payment');
select pg_temp.login('e1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.academy_event_payments),0,'student does not read others'' payments');

-- --------------------------------------------------------------- cancel ---
select pg_temp.login('e1000000-0000-0000-0000-000000000002');
update public.academy_events set cancelled_at=now() where id=pg_temp.id('party');
select is((select cancelled_by from public.academy_events where id=pg_temp.id('party')),'e1000000-0000-0000-0000-000000000002'::uuid,'professor cancels, stamped');
select throws_ok(format($q$update public.academy_events set title='Outra' where id=%L$q$,pg_temp.id('party')),'P0001','event_cancelled','a cancelled event is frozen');
select pg_temp.login('e1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.academy_events where id=pg_temp.id('party') and cancelled_at is not null),1,'members still see it as cancelled');
select throws_ok(format($q$insert into public.academy_event_rsvps(event_id,user_id,status) values(%L,'e1000000-0000-0000-0000-000000000004','going')$q$,
  pg_temp.id('party')),'P0001','event_cancelled','no answer on a cancelled event');

-- A wrong academy_id from the client is overwritten by the event's academy.
select pg_temp.login('e1000000-0000-0000-0000-000000000004');
insert into public.academy_event_rsvps(academy_id,event_id,user_id,status)
values(gen_random_uuid(),pg_temp.id('bjj_today'),'e1000000-0000-0000-0000-000000000004','going');
select is((select academy_id from public.academy_event_rsvps where event_id=pg_temp.id('bjj_today') and user_id='e1000000-0000-0000-0000-000000000004'),
  pg_temp.id('academy'),'academy_id comes from the event');

-- Events are not classes: nothing reaches check-ins.
select pg_temp.admin();
select is((select count(*)::int from public.checkins where academy_id=pg_temp.id('academy')),0,'events create no check-ins');

select * from finish();
rollback;
