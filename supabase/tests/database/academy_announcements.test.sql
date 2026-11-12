-- Academy announcements (2026-11-12): owner and professor publish; the author
-- edits and deletes their own, the owner deletes any; audience = everyone or
-- one modality; students stop seeing an expired notice, staff keep seeing it;
-- a finance-blocked student still sees the notices.
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

-- 1 owner · 2 professor · 3 Ana (BJJ) · 4 Caio (Boxe) · 5 outsider (other academy) · 6 Davi (BJJ, blocked) · 7 professor 2
insert into auth.users(id,email,raw_user_meta_data) values
('a1000000-0000-0000-0000-000000000001','owner@an.test','{"full_name":"Owner"}'),
('a1000000-0000-0000-0000-000000000002','prof@an.test','{"full_name":"Prof"}'),
('a1000000-0000-0000-0000-000000000003','ana@an.test','{"full_name":"Ana"}'),
('a1000000-0000-0000-0000-000000000004','caio@an.test','{"full_name":"Caio"}'),
('a1000000-0000-0000-0000-000000000005','out@an.test','{"full_name":"Out"}'),
('a1000000-0000-0000-0000-000000000006','davi@an.test','{"full_name":"Davi"}'),
('a1000000-0000-0000-0000-000000000007','prof2@an.test','{"full_name":"Prof Dois"}');
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
insert into ids values('academy',public.create_academy('Team',array['BJJ','Boxe']));
select pg_temp.login('a1000000-0000-0000-0000-000000000005');
insert into ids values('other',public.create_academy('Outra',array['BJJ']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
create function pg_temp.today() returns date language sql as $$select private.academy_local_date(pg_temp.id('academy'))$$;
grant execute on function pg_temp.today() to public;
insert into public.memberships(user_id,academy_id,role,status) values
('a1000000-0000-0000-0000-000000000002',pg_temp.id('academy'),'instructor','active'),
('a1000000-0000-0000-0000-000000000007',pg_temp.id('academy'),'instructor','active'),
('a1000000-0000-0000-0000-000000000003',pg_temp.id('academy'),'student','active'),
('a1000000-0000-0000-0000-000000000004',pg_temp.id('academy'),'student','active'),
('a1000000-0000-0000-0000-000000000006',pg_temp.id('academy'),'student','active');
insert into public.student_modality_enrollments(membership_id,modality_id,status)
select m.id,
  case when m.user_id='a1000000-0000-0000-0000-000000000004' then pg_temp.id('Boxe') else pg_temp.id('BJJ') end,
  'active'
from public.memberships m where m.academy_id=pg_temp.id('academy') and m.role='student';

-- ---------------------------------------------------------------- publish ---
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select lives_ok(format($q$insert into public.academy_announcements(academy_id,body) values(%L,'Sem aula no feriado')$q$,
  pg_temp.id('academy')),'professor publishes a notice for everyone');
select lives_ok(format($q$insert into public.academy_announcements(academy_id,body,modality_id) values(%L,'Kimono novo do BJJ',%L)$q$,
  pg_temp.id('academy'),pg_temp.id('BJJ')),'professor publishes a notice for one modality');
select lives_ok(format($q$insert into public.academy_announcements(academy_id,body,modality_id) values(%L,'Luvas de Boxe',%L)$q$,
  pg_temp.id('academy'),pg_temp.id('Boxe')),'professor publishes a Boxe notice');
select lives_ok(format($q$insert into public.academy_announcements(academy_id,body,expires_on) values(%L,'Último dia hoje',%L)$q$,
  pg_temp.id('academy'),pg_temp.today()),'expires_on today is accepted');
select lives_ok(format($q$insert into public.academy_announcements(academy_id,body,pinned) values(%L,'Fixado importante',true)$q$,
  pg_temp.id('academy')),'professor pins a notice');
insert into ids select k,id from (values ('all','Sem aula no feriado'),('bjj','Kimono novo do BJJ'),('boxe','Luvas de Boxe'),
  ('last_day','Último dia hoje'),('pinned','Fixado importante')) v(k,b) join public.academy_announcements a on a.body=v.b;
select is((select created_by from public.academy_announcements where id=pg_temp.id('all')),'a1000000-0000-0000-0000-000000000002'::uuid,'created_by is the caller');
select throws_ok(format($q$insert into public.academy_announcements(academy_id,body,created_by) values(%L,'Forjado','a1000000-0000-0000-0000-000000000001')$q$,
  pg_temp.id('academy')),'42501',null,'client cannot send created_by');

select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select lives_ok(format($q$insert into public.academy_announcements(academy_id,body) values(%L,'Aviso do dono')$q$,
  pg_temp.id('academy')),'owner publishes a notice');
insert into ids select 'owner_note',id from public.academy_announcements where body='Aviso do dono';
select is((select created_by from public.academy_announcements where id=pg_temp.id('owner_note')),'a1000000-0000-0000-0000-000000000001'::uuid,'owner is stamped as author');

select throws_ok(format($q$insert into public.academy_announcements(academy_id,body,expires_on) values(%L,'Velho',%L)$q$,
  pg_temp.id('academy'),pg_temp.today()-1),'P0001','announcement_expires_in_past','expires_on in the past is rejected on insert');
select throws_ok(format($q$insert into public.academy_announcements(academy_id,body) values(%L,' x ')$q$,
  pg_temp.id('academy')),'23514',null,'body shorter than 2 characters is rejected');

select pg_temp.login('a1000000-0000-0000-0000-000000000003');
select throws_ok(format($q$insert into public.academy_announcements(academy_id,body) values(%L,'Aviso de aluno')$q$,
  pg_temp.id('academy')),'42501',null,'student cannot publish');
select pg_temp.login('a1000000-0000-0000-0000-000000000005');
select throws_ok(format($q$insert into public.academy_announcements(academy_id,body) values(%L,'De fora')$q$,
  pg_temp.id('academy')),'42501',null,'staff of another academy cannot publish here');

-- An expired notice (inserted past the guard) for the visibility tests.
insert into ids values('expired',gen_random_uuid());
select pg_temp.admin();
alter table public.academy_announcements disable trigger academy_announcements_guard;
insert into public.academy_announcements(id,academy_id,body,expires_on,created_by)
values(pg_temp.id('expired'),pg_temp.id('academy'),'Aviso vencido',pg_temp.today()-1,'a1000000-0000-0000-0000-000000000002');
-- Distinct creation times: all < owner_note < bjj ... (oldest to newest)
update public.academy_announcements set created_at=now()-interval '5 hour' where id=pg_temp.id('all');
update public.academy_announcements set created_at=now()-interval '4 hour' where id=pg_temp.id('bjj');
update public.academy_announcements set created_at=now()-interval '3 hour' where id=pg_temp.id('boxe');
update public.academy_announcements set created_at=now()-interval '2 hour' where id=pg_temp.id('pinned');
update public.academy_announcements set created_at=now()-interval '1 hour' where id=pg_temp.id('last_day');
alter table public.academy_announcements enable trigger academy_announcements_guard;

-- ------------------------------------------------------------- visibility ---
-- visible to students: all, bjj/boxe (by modality), last_day, pinned, owner_note
select pg_temp.login('a1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.academy_announcements),5,'BJJ student sees all, BJJ, last day, pinned and owner notices');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('boxe')),0,'BJJ student does not see the Boxe notice');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('bjj')),1,'BJJ student sees the BJJ notice');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('expired')),0,'student does not see an expired notice');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('last_day')),1,'student still sees the notice on its last day');

select pg_temp.login('a1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.academy_announcements),5,'Boxe student sees all, Boxe, last day, pinned and owner notices');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('bjj')),0,'Boxe student does not see the BJJ notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.academy_announcements where academy_id=pg_temp.id('academy')),0,'student/staff of another academy sees nothing');
select is((select count(*)::int from public.academy_announcements_feed(pg_temp.id('academy'))),0,'outsider feed is empty');

select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.academy_announcements),7,'staff sees every notice, including the expired one');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('expired')),1,'staff still sees the expired notice');

-- A student whose enrollment is no longer active loses the modality notices only.
select pg_temp.admin();
update public.student_modality_enrollments set status='ended' where membership_id=(select id from public.memberships where user_id='a1000000-0000-0000-0000-000000000004');
select pg_temp.login('a1000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('boxe')),0,'unlinked student loses the modality notice');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('all')),1,'unlinked student keeps the "all" notice');
select pg_temp.admin();
update public.student_modality_enrollments set status='active' where membership_id=(select id from public.memberships where user_id='a1000000-0000-0000-0000-000000000004');

-- --------------------------------------------------------- finance block ---
select pg_temp.admin();
insert into public.academy_finance_settings(academy_id,enabled,default_due_day,block_overdue) values(pg_temp.id('academy'),true,10,true);
insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents) values
(pg_temp.id('academy'),'a1000000-0000-0000-0000-000000000006','Davi',(date_trunc('month',pg_temp.today())-interval '1 month')::date,pg_temp.today()-10,15000);
select pg_temp.login('a1000000-0000-0000-0000-000000000006');
select is(private.is_finance_blocked(pg_temp.id('academy')),true,'fixture: Davi is finance-blocked');
select is((select count(*)::int from public.academy_events),0,'blocked student sees no events (block really applies)');
select is((select count(*)::int from public.academy_announcements),5,'blocked student still sees the notices (all + BJJ + ...)');
select is((select count(*)::int from public.academy_announcements_feed(pg_temp.id('academy'))),5,'blocked student feed still returns notices');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('bjj')),1,'blocked student still sees his modality notice');

-- ------------------------------------------------------------------- feed ---
select pg_temp.login('a1000000-0000-0000-0000-000000000003');
select is((select author_name from public.academy_announcements_feed(pg_temp.id('academy')) where id=pg_temp.id('all')),'Prof','feed returns the author name to a student');
select is((select author_name from public.academy_announcements_feed(pg_temp.id('academy')) where id=pg_temp.id('owner_note')),'Owner','feed returns the owner as author');
select is((select id from public.academy_announcements_feed(pg_temp.id('academy')) limit 1),pg_temp.id('pinned'),'pinned notice comes first');
select is((select array_agg(id order by ord) from (select id,row_number() over () ord from public.academy_announcements_feed(pg_temp.id('academy'))) f where id in (pg_temp.id('last_day'),pg_temp.id('all'))),
  array[pg_temp.id('last_day'),pg_temp.id('all')],'unpinned come newest first');
select is((select count(*)::int from public.academy_announcements_feed(pg_temp.id('academy')) where id=pg_temp.id('expired')),0,'student feed hides expired');
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.academy_announcements_feed(pg_temp.id('academy'))),7,'owner feed has every notice');
select is((select author_name from public.academy_announcements_feed(pg_temp.id('academy')) where id=pg_temp.id('expired')),'Prof','owner feed names the author of an expired notice');

-- Author deleted: the notice stays with a null author name.
select pg_temp.admin();
alter table public.academy_announcements disable trigger academy_announcements_guard;
update public.academy_announcements set created_by=null where id=pg_temp.id('owner_note');
alter table public.academy_announcements enable trigger academy_announcements_guard;
select pg_temp.login('a1000000-0000-0000-0000-000000000003');
select is((select author_name from public.academy_announcements_feed(pg_temp.id('academy')) where id=pg_temp.id('owner_note')),null,'notice without author still listed, name null');
select is((select count(*)::int from public.academy_announcements_feed(pg_temp.id('academy')) where id=pg_temp.id('owner_note')),1,'left join keeps notice with no author');
select pg_temp.admin();
alter table public.academy_announcements disable trigger academy_announcements_guard;
update public.academy_announcements set created_by='a1000000-0000-0000-0000-000000000001' where id=pg_temp.id('owner_note');
alter table public.academy_announcements enable trigger academy_announcements_guard;

-- ----------------------------------------------------------------- update ---
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
update public.academy_announcements set body='Editado pelo autor', pinned=true where id=pg_temp.id('all');
select is((select body from public.academy_announcements where id=pg_temp.id('all')),'Editado pelo autor','author edits own notice');
select is((select pinned from public.academy_announcements where id=pg_temp.id('all')),true,'author pins own notice');
update public.academy_announcements set body='Hack do professor' where id=pg_temp.id('owner_note');
select pg_temp.admin();
select is((select body from public.academy_announcements where id=pg_temp.id('owner_note')),'Aviso do dono','instructor cannot update the owner''s notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000007');
update public.academy_announcements set body='Hack do professor 2' where id=pg_temp.id('bjj');
select pg_temp.admin();
select is((select body from public.academy_announcements where id=pg_temp.id('bjj')),'Kimono novo do BJJ','instructor cannot update another instructor''s notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000001');
update public.academy_announcements set body='Hack do dono' where id=pg_temp.id('bjj');
select pg_temp.admin();
select is((select body from public.academy_announcements where id=pg_temp.id('bjj')),'Kimono novo do BJJ','owner cannot update an instructor''s notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000003');
update public.academy_announcements set body='Hack do aluno' where id=pg_temp.id('bjj');
select pg_temp.admin();
select is((select body from public.academy_announcements where id=pg_temp.id('bjj')),'Kimono novo do BJJ','student cannot update');

-- Guarded columns and past expiry on update.
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
select throws_ok(format($q$update public.academy_announcements set created_by='a1000000-0000-0000-0000-000000000001' where id=%L$q$,pg_temp.id('all')),
  '42501',null,'author cannot change created_by (no column grant)');
select throws_ok(format($q$update public.academy_announcements set academy_id=%L where id=%L$q$,pg_temp.id('other'),pg_temp.id('all')),
  '42501',null,'author cannot move the notice to another academy');
select throws_ok(format($q$update public.academy_announcements set expires_on=%L where id=%L$q$,pg_temp.today()-1,pg_temp.id('all')),
  'P0001','announcement_expires_in_past','changing expires_on to the past is rejected');
select lives_ok(format($q$update public.academy_announcements set expires_on=%L where id=%L$q$,pg_temp.today()+3,pg_temp.id('all')),'future expires_on accepted on update');
-- Editing an already-expired notice without touching expires_on is allowed.
select lives_ok(format($q$update public.academy_announcements set body='Vencido corrigido' where id=%L$q$,pg_temp.id('expired')),'editing an expired notice without changing its date is allowed');
select is((select body from public.academy_announcements where id=pg_temp.id('expired')),'Vencido corrigido','expired notice edit applied');

-- ----------------------------------------------------------------- delete ---
select pg_temp.login('a1000000-0000-0000-0000-000000000002');
delete from public.academy_announcements where id=pg_temp.id('owner_note');
select pg_temp.admin();
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('owner_note')),1,'instructor cannot delete the owner''s notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000007');
delete from public.academy_announcements where id=pg_temp.id('boxe');
select pg_temp.admin();
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('boxe')),1,'instructor cannot delete another instructor''s notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000003');
delete from public.academy_announcements where id=pg_temp.id('boxe');
select pg_temp.admin();
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('boxe')),1,'student cannot delete');

select pg_temp.login('a1000000-0000-0000-0000-000000000002');
delete from public.academy_announcements where id=pg_temp.id('pinned');
select pg_temp.admin();
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('pinned')),0,'author deletes own notice');

select pg_temp.login('a1000000-0000-0000-0000-000000000001');
delete from public.academy_announcements where id=pg_temp.id('boxe');
select pg_temp.admin();
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('boxe')),0,'owner deletes an instructor''s notice');

-- Deleting a modality cascades its notices.
select pg_temp.admin();
delete from public.student_modality_enrollments where modality_id=pg_temp.id('BJJ');
delete from public.academy_modalities where id=pg_temp.id('BJJ');
select is((select count(*)::int from public.academy_announcements where id=pg_temp.id('bjj')),0,'deleting a modality removes its notices');

select * from finish();
rollback;
