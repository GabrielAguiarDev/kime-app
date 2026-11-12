-- Inactive students (2026-11-12): staff-only list of active students with no
-- confirmed check-in for academies.inactive_after_days days (default 14, owner
-- sets 7..90); never-trained students count from the membership start.
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

-- 1 owner · 2 professor · 3 Ana (last class 20d ago) · 4 Bia (class 3d ago) · 5 Caio (only pending/rejected)
-- 6 Davi (never trained, joined today) · 7 Edu (never trained, joined 30d ago) · 8 Fabi (old class, membership rejected)
-- 9 Gil (old class, pending membership) · 10 outsider · 11 Hugo (requested 60d ago, approved today, confirmed class 40d ago = before joining)
-- 12 Ivo (approved 60d ago, only confirmed class 70d ago = before joining)
insert into auth.users(id,email,raw_user_meta_data) values
('b1000000-0000-0000-0000-000000000001','owner@in.test','{"full_name":"Owner"}'),
('b1000000-0000-0000-0000-000000000002','prof@in.test','{"full_name":"Prof"}'),
('b1000000-0000-0000-0000-000000000003','ana@in.test','{"full_name":"Ana"}'),
('b1000000-0000-0000-0000-000000000004','bia@in.test','{"full_name":"Bia"}'),
('b1000000-0000-0000-0000-000000000005','caio@in.test','{"full_name":"Caio"}'),
('b1000000-0000-0000-0000-000000000006','davi@in.test','{"full_name":"Davi"}'),
('b1000000-0000-0000-0000-000000000007','edu@in.test','{"full_name":"Edu"}'),
('b1000000-0000-0000-0000-000000000008','fabi@in.test','{"full_name":"Fabi"}'),
('b1000000-0000-0000-0000-000000000009','gil@in.test','{"full_name":"Gil"}'),
('b1000000-0000-0000-0000-000000000010','other@in.test','{"full_name":"Other"}'),
('b1000000-0000-0000-0000-000000000011','hugo@in.test','{"full_name":"Hugo"}'),
('b1000000-0000-0000-0000-000000000012','ivo@in.test','{"full_name":"Ivo"}');
select pg_temp.login('b1000000-0000-0000-0000-000000000001');
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
insert into ids values('academy',public.create_academy('Team',array['BJJ','Boxe']));
select pg_temp.login('b1000000-0000-0000-0000-000000000010');
insert into ids values('other',public.create_academy('Outra',array['BJJ']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
create function pg_temp.today() returns date language sql as $$select private.academy_local_date(pg_temp.id('academy'))$$;
create function pg_temp.u(n int) returns uuid language sql as $$select ('b1000000-0000-0000-0000-0000000000'||lpad(n::text,2,'0'))::uuid$$;
grant execute on function pg_temp.today(),pg_temp.u(int) to public;
insert into public.memberships(user_id,academy_id,role,status) values
(pg_temp.u(2),pg_temp.id('academy'),'instructor','active'),
(pg_temp.u(3),pg_temp.id('academy'),'student','active'),
(pg_temp.u(4),pg_temp.id('academy'),'student','active'),
(pg_temp.u(5),pg_temp.id('academy'),'student','active'),
(pg_temp.u(6),pg_temp.id('academy'),'student','active'),
(pg_temp.u(7),pg_temp.id('academy'),'student','active'),
(pg_temp.u(8),pg_temp.id('academy'),'student','rejected'),
(pg_temp.u(9),pg_temp.id('academy'),'student','pending'),
(pg_temp.u(11),pg_temp.id('academy'),'student','active'),
(pg_temp.u(12),pg_temp.id('academy'),'student','active');
-- Approved (decided_at) 60 days ago, except Davi (today), Edu (30d) and Hugo (requested 60d ago, approved today).
update public.memberships set created_at=now()-interval '60 days', decided_at=now()-interval '60 days' where academy_id=pg_temp.id('academy');
update public.memberships set created_at=now(), decided_at=now() where academy_id=pg_temp.id('academy') and user_id=pg_temp.u(6);
update public.memberships set created_at=now()-interval '30 days', decided_at=now()-interval '30 days' where academy_id=pg_temp.id('academy') and user_id=pg_temp.u(7);
update public.memberships set decided_at=now() where academy_id=pg_temp.id('academy') and user_id=pg_temp.u(11);
insert into public.checkins(user_id,academy_id,class_date,status,modality_id) values
(pg_temp.u(3),pg_temp.id('academy'),pg_temp.today()-40,'confirmed',pg_temp.id('BJJ')),
(pg_temp.u(3),pg_temp.id('academy'),pg_temp.today()-20,'confirmed',pg_temp.id('Boxe')),
(pg_temp.u(3),pg_temp.id('academy'),pg_temp.today()-2,'pending',pg_temp.id('BJJ')),
(pg_temp.u(4),pg_temp.id('academy'),pg_temp.today()-3,'confirmed',pg_temp.id('BJJ')),
(pg_temp.u(5),pg_temp.id('academy'),pg_temp.today()-1,'pending',pg_temp.id('BJJ')),
(pg_temp.u(5),pg_temp.id('academy'),pg_temp.today()-2,'rejected',pg_temp.id('BJJ')),
(pg_temp.u(8),pg_temp.id('academy'),pg_temp.today()-30,'confirmed',pg_temp.id('BJJ')),
(pg_temp.u(9),pg_temp.id('academy'),pg_temp.today()-30,'confirmed',pg_temp.id('BJJ')),
(pg_temp.u(11),pg_temp.id('academy'),pg_temp.today()-40,'confirmed',pg_temp.id('BJJ')),
(pg_temp.u(12),pg_temp.id('academy'),pg_temp.today()-70,'confirmed',pg_temp.id('BJJ'));
-- Edu's class in another academy must not count.
insert into public.memberships(user_id,academy_id,role,status) values(pg_temp.u(7),pg_temp.id('other'),'student','active');
insert into public.checkins(user_id,academy_id,class_date,status,modality_id)
select pg_temp.u(7),pg_temp.id('other'),pg_temp.today()-1,'confirmed',id from public.academy_modalities where academy_id=pg_temp.id('other');

-- ---------------------------------------------------------------- column ---
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),14::smallint,'default is 14 days');

-- ----------------------------------------------------------------- RPC ---
select pg_temp.login('b1000000-0000-0000-0000-000000000002');
select is((select array_agg(user_id order by user_id) from public.inactive_students(pg_temp.id('academy'))),
  array[pg_temp.u(3),pg_temp.u(5),pg_temp.u(7),pg_temp.u(12)],'instructor sees exactly Ana (old class), Caio (only pending/rejected), Edu (never trained, approved 30d ago) and Ivo (class only before joining)');
select is((select last_class_date from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(3)),pg_temp.today()-20,'last class is the latest CONFIRMED one (pending ignored)');
select is((select inactive_since from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(3)),pg_temp.today()-20,'inactive_since = last class');
select is((select last_class_date from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(7)),null,'never trained: no last class (other academy ignored)');
select is((select joined_on from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(7)),pg_temp.today()-30,'never trained: joined_on from the membership');
select is((select inactive_since from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(7)),pg_temp.today()-30,'never trained: inactive_since = joined_on');
select is((select membership_id from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(3)),
  (select id from public.memberships where user_id=pg_temp.u(3) and academy_id=pg_temp.id('academy')),'membership_id returned');
select ok((select user_id from public.inactive_students(pg_temp.id('academy')) limit 1) in (pg_temp.u(5),pg_temp.u(12)),'ordered by oldest inactive_since first (Caio or Ivo, 60d)');
select is((select inactive_since from public.inactive_students(pg_temp.id('academy')) limit 1),pg_temp.today()-60,'first row has the oldest inactive_since');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(11)),0,'approved today with a confirmed class before joining: not listed');
select is((select last_class_date from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(12)),null,'class before joined_on does not count: last_class_date null');
select is((select inactive_since from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(12)),pg_temp.today()-60,'class before joined_on: inactive_since = joined_on');
select is((select joined_on from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(12)),pg_temp.today()-60,'Ivo joined_on is the approval date');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(11)),0,'old request but approved today: not listed');

select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(4)),0,'recent confirmed class: not listed');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(5)),1,'only pending/rejected check-ins: listed (joined 60d ago)');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(6)),0,'never trained, joined today: not listed');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id in (pg_temp.u(8),pg_temp.u(9))),0,'rejected and pending memberships excluded');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id in (pg_temp.u(1),pg_temp.u(2))),0,'staff never listed');

-- Boundary: exactly N days ago is listed, N-1 is not.
select pg_temp.admin();
update public.checkins set class_date=pg_temp.today()-14 where user_id=pg_temp.u(4);
select pg_temp.login('b1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(4)),1,'exactly 14 days ago: listed');
select pg_temp.admin();
update public.checkins set class_date=pg_temp.today()-13 where user_id=pg_temp.u(4);
select pg_temp.login('b1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(4)),0,'13 days ago: not listed');

-- A confirmed class in any modality revives a student.
select pg_temp.admin();
insert into public.checkins(user_id,academy_id,class_date,status,modality_id)
values(pg_temp.u(3),pg_temp.id('academy'),pg_temp.today()-1,'confirmed',pg_temp.id('Boxe'));
select pg_temp.login('b1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy')) where user_id=pg_temp.u(3)),0,'new confirmed class removes the student from the list');
select pg_temp.admin();
delete from public.checkins where user_id=pg_temp.u(3) and class_date=pg_temp.today()-1;

-- ------------------------------------------------------------ permissions ---
select pg_temp.login('b1000000-0000-0000-0000-000000000003');
select throws_ok(format('select * from public.inactive_students(%L)',pg_temp.id('academy')),'42501','forbidden','student gets forbidden');
select pg_temp.login('b1000000-0000-0000-0000-000000000010');
select throws_ok(format('select * from public.inactive_students(%L)',pg_temp.id('academy')),'42501','forbidden','staff of another academy gets forbidden');
select throws_ok(format('select * from public.inactive_students(%L)','00000000-0000-0000-0000-000000000000'),'42501','forbidden','unknown academy: forbidden');
select pg_temp.admin();
select set_config('request.jwt.claims','',true);
grant select on ids to anon;
set local role anon;
select throws_ok(format('select * from public.inactive_students(%L)',pg_temp.id('academy')),'42501',null,'anon cannot execute');
select pg_temp.admin();

-- --------------------------------------------------------------- threshold ---
select pg_temp.login('b1000000-0000-0000-0000-000000000001');
update public.academies set inactive_after_days=30 where id=pg_temp.id('academy');
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),30::smallint,'owner changes the threshold');
select is((select array_agg(user_id order by user_id) from public.inactive_students(pg_temp.id('academy'))),array[pg_temp.u(5),pg_temp.u(7),pg_temp.u(12)],'threshold 30: Ana (20d) leaves, Caio, Edu (30d) and Ivo stay');
update public.academies set inactive_after_days=7 where id=pg_temp.id('academy');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy'))),5,'threshold 7: Ana, Bia (13d), Caio, Edu, Ivo listed; Davi and Hugo (approved today) not');
update public.academies set inactive_after_days=90 where id=pg_temp.id('academy');
select is((select count(*)::int from public.inactive_students(pg_temp.id('academy'))),0,'threshold 90: nobody (oldest is 60d)');

select throws_ok(format($q$update public.academies set inactive_after_days=6 where id=%L$q$,pg_temp.id('academy')),'23514',null,'6 rejected');
select throws_ok(format($q$update public.academies set inactive_after_days=91 where id=%L$q$,pg_temp.id('academy')),'23514',null,'91 rejected');
select throws_ok(format($q$update public.academies set inactive_after_days=0 where id=%L$q$,pg_temp.id('academy')),'23514',null,'0 rejected');
select throws_ok(format($q$update public.academies set inactive_after_days=null where id=%L$q$,pg_temp.id('academy')),'23502',null,'null rejected');
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),90::smallint,'rejected values leave the column unchanged');
update public.academies set inactive_after_days=7 where id=pg_temp.id('academy');
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),7::smallint,'lower bound 7 accepted');

select pg_temp.login('b1000000-0000-0000-0000-000000000002');
update public.academies set inactive_after_days=45 where id=pg_temp.id('academy');
select pg_temp.admin();
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),7::smallint,'instructor cannot change the threshold (no row updated)');
select pg_temp.login('b1000000-0000-0000-0000-000000000003');
update public.academies set inactive_after_days=45 where id=pg_temp.id('academy');
select pg_temp.admin();
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),7::smallint,'student cannot change the threshold');
select pg_temp.login('b1000000-0000-0000-0000-000000000010');
update public.academies set inactive_after_days=45 where id=pg_temp.id('academy');
select pg_temp.admin();
select is((select inactive_after_days from public.academies where id=pg_temp.id('academy')),7::smallint,'another academy''s owner cannot change it');
select is((select inactive_after_days from public.academies where id=pg_temp.id('other')),14::smallint,'other academy keeps its own default');

select * from finish();
rollback;
