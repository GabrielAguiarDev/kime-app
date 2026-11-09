-- Fight history before the app ("Histórico anterior"), 2026-11-09.
-- Rules: only owner/instructor create, edit and delete the previous record and
-- previous championships; the athlete only reads. Previous championships are
-- individual: no other student (nor the athlete, through the table) sees them,
-- so they stay out of the Início and of the academy's list. The summary adds
-- previous record + previous championships + championships in the app.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.login(u uuid) returns void language plpgsql as $$begin
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
end$$;
create function pg_temp.admin() returns void language plpgsql as $$begin
 perform set_config('role','postgres',true);
 perform set_config('request.jwt.claims','',true);
end$$;
grant execute on function pg_temp.login(uuid),pg_temp.admin() to public;
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users(id,email,raw_user_meta_data) values
('a4000000-0000-0000-0000-000000000001','owner@ph.test','{"full_name":"Owner"}'),
('a4000000-0000-0000-0000-000000000002','inst@ph.test','{"full_name":"Instrutor"}'),
('a4000000-0000-0000-0000-000000000003','ana@ph.test','{"full_name":"Ana"}'),
('a4000000-0000-0000-0000-000000000004','bia@ph.test','{"full_name":"Bia"}'),
('a4000000-0000-0000-0000-000000000005','out@ph.test','{"full_name":"Outro"}');
insert into ids values
('owner','a4000000-0000-0000-0000-000000000001'),('inst','a4000000-0000-0000-0000-000000000002'),
('ana','a4000000-0000-0000-0000-000000000003'),('bia','a4000000-0000-0000-0000-000000000004'),
('out','a4000000-0000-0000-0000-000000000005');

select pg_temp.login(pg_temp.id('owner'));
insert into ids values('academy',public.create_academy('Histórico',array['BJJ','Boxe']));
select pg_temp.login(pg_temp.id('out'));
insert into ids values('other',public.create_academy('Outra',array['Judô']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status) values
(pg_temp.id('inst'),pg_temp.id('academy'),'instructor','active'),
(pg_temp.id('ana'),pg_temp.id('academy'),'student','active'),
(pg_temp.id('bia'),pg_temp.id('academy'),'student','active');
-- Ana and Bia train BJJ; both compete in it.
insert into public.student_modality_enrollments(membership_id,modality_id,status,is_competitor,competitor_since)
select m.id,pg_temp.id('BJJ'),'active',true,now()
from public.memberships m where m.academy_id=pg_temp.id('academy') and m.role='student';

-- A championship recorded in the app (team event): Ana 1 win, silver.
insert into ids values('app',gen_random_uuid());
insert into public.championships(id,academy_id,modality_id,name,event_date) values
(pg_temp.id('app'),pg_temp.id('academy'),pg_temp.id('BJJ'),'Copa do App',current_date-10);
insert into public.championship_entries(championship_id,academy_id,athlete_id,placement) values
(pg_temp.id('app'),pg_temp.id('academy'),pg_temp.id('ana'),'silver');
insert into public.championship_fights(entry_id,result,method)
select id,'win','points' from public.championship_entries where championship_id=pg_temp.id('app');

-- ------------------------------------------------- previous championship ---
select pg_temp.login(pg_temp.id('inst'));
select throws_ok(format($$select public.create_previous_championship(%L,%L,%L,'Copa Futura',current_date,'')$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ')),'22023','previous_championship_not_past',
  'a previous championship must be in the past');
insert into ids select 'prev',public.create_previous_championship(pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ'),
  ' Estadual 2023 ',current_date-800,'São Paulo');
select is((select is_historical::text||'/'||historical_athlete_id::text||'/'||name from public.championships where id=pg_temp.id('prev')),
  'true/'||pg_temp.id('ana')::text||'/Estadual 2023','staff create a previous championship marked historical and individual');
select is((select count(*)::int from public.championship_entries where championship_id=pg_temp.id('prev')),1,
  'the athlete is entered with it');
insert into ids select 'e_prev',id from public.championship_entries where championship_id=pg_temp.id('prev');
-- Placement and fights as in any championship.
update public.championship_entries set placement='gold' where id=pg_temp.id('e_prev');
insert into public.championship_fights(entry_id,result,method) values
(pg_temp.id('e_prev'),'win','submission'),(pg_temp.id('e_prev'),'draw','points');
select is((select placement from public.championship_entries where id=pg_temp.id('e_prev')),'gold',
  'staff record the placement of a previous championship');
select throws_ok(format($$update public.championships set event_date=current_date+1 where id=%L$$,pg_temp.id('prev')),
  '22023','previous_championship_not_past','the date cannot move to today or later');
update public.championships set name='Estadual SP 2023' where id=pg_temp.id('prev');
select is((select name from public.championships where id=pg_temp.id('prev')),'Estadual SP 2023','staff edit it');
-- It stays individual.
select throws_ok(format($$insert into public.championship_entries(championship_id,academy_id,athlete_id) values(%L,%L,%L)$$,
  pg_temp.id('prev'),pg_temp.id('academy'),pg_temp.id('bia')),'42501',null,'no other athlete is entered in it');
delete from public.championship_entries where id=pg_temp.id('e_prev');
select is((select count(*)::int from public.championship_entries where id=pg_temp.id('e_prev')),1,
  'its entry is not removed alone');
select throws_ok(format($$update public.championships set is_historical=false where id=pg_temp.id('prev')$$),
  '42501',null,'the flag is not changed through the API');
select throws_ok(format($$insert into public.championships(academy_id,modality_id,name,event_date,is_historical,historical_athlete_id)
  values(%L,%L,'Fake',current_date-5,true,%L)$$,pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.id('bia')),
  '42501',null,'a previous championship is created only through the RPC');
select throws_ok(format($$select public.create_previous_championship(%L,%L,%L,'Copa',current_date-5,'')$$,
  pg_temp.id('academy'),pg_temp.id('out'),pg_temp.id('BJJ')),'42501','forbidden','only for a student of the academy');

-- ------------------------------------------------------ previous record ---
select pg_temp.login(pg_temp.id('owner'));
select lives_ok(format($$select public.set_previous_record(%L,%L,%L,8,2,1,3,1,0)$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ')),'owner records the previous record');
select pg_temp.login(pg_temp.id('inst'));
select lives_ok(format($$select public.set_previous_record(%L,%L,%L,8,2,1,3,1,1)$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ')),'instructor edits it');
select is((select wins||'-'||losses||'-'||draws||'/'||gold||'-'||silver||'-'||bronze from public.athlete_previous_records
  where athlete_id=pg_temp.id('ana')),'8-2-1/3-1-1','one row per modality, replaced');
select lives_ok(format($$select public.set_previous_record(%L,%L,%L,0,0,0,0,0,0)$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('Boxe')),'all zeros on an empty modality');
select is((select count(*)::int from public.athlete_previous_records where athlete_id=pg_temp.id('ana')),1,
  'all zeros stores nothing');
select throws_ok(format($$select public.set_previous_record(%L,%L,%L,-1,0,0,0,0,0)$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('Boxe')),'23514',null,'numbers are not negative');

-- -------------------------------------------- the athlete cannot write ---
select pg_temp.login(pg_temp.id('ana'));
select throws_ok(format($$select public.set_previous_record(%L,%L,%L,99,0,0,0,0,0)$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ')),'42501','forbidden','the athlete cannot set the previous record');
select throws_ok(format($$insert into public.athlete_previous_records(academy_id,athlete_id,modality_id,wins)
  values(%L,%L,%L,99)$$,pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('Boxe')),'42501',null,
  'the athlete cannot insert a previous record');
update public.athlete_previous_records set wins=99;
delete from public.athlete_previous_records;
select throws_ok(format($$select public.create_previous_championship(%L,%L,%L,'Minha copa',current_date-5,'')$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ')),'42501','forbidden','the athlete cannot add a previous championship');
update public.championships set name='Hack' where id=pg_temp.id('prev');
delete from public.championships where id=pg_temp.id('prev');
update public.championship_entries set placement='none' where id=pg_temp.id('e_prev');
select throws_ok(format($$insert into public.championship_fights(entry_id,result,method) values(%L,'win','ko')$$,
  pg_temp.id('e_prev')),'42501',null,'the athlete cannot add fights to a previous championship');
select pg_temp.admin();
select is((select wins from public.athlete_previous_records where athlete_id=pg_temp.id('ana')),8,
  'the athlete cannot edit the previous record');
select is((select count(*)::int from public.athlete_previous_records where athlete_id=pg_temp.id('ana')),1,
  'the athlete cannot delete the previous record');
select is((select name from public.championships where id=pg_temp.id('prev')),'Estadual SP 2023',
  'the athlete cannot edit or delete a previous championship');
select is((select placement from public.championship_entries where id=pg_temp.id('e_prev')),'gold',
  'the athlete cannot change its placement');

-- Staff of another academy write nothing.
select pg_temp.login(pg_temp.id('out'));
select throws_ok(format($$select public.set_previous_record(%L,%L,%L,1,0,0,0,0,0)$$,
  pg_temp.id('academy'),pg_temp.id('ana'),pg_temp.id('BJJ')),'42501','forbidden','staff of another academy cannot write');
select is((select count(*)::int from public.athlete_previous_records),0,'nor read the previous record');

-- ---------------------------------------------------------------- reads ---
select pg_temp.login(pg_temp.id('ana'));
select is((select count(*)::int from public.athlete_previous_records),1,'the athlete reads own previous record');
select is((select string_agg(name||':'||is_historical,',' order by event_date desc)
  from public.athlete_fight_history(pg_temp.id('academy'),pg_temp.id('ana'))),
  'Copa do App:false,Estadual SP 2023:true','the cartel lists previous and app championships by date, flagged');
select is((select count(*)::int from public.championships where id=pg_temp.id('prev')),0,
  'the previous championship is not in the athlete''s championship lists (Início)');
select is((select count(*)::int from public.championship_entries e join public.championships c on c.id=e.championship_id
  where e.athlete_id=pg_temp.id('ana')),1,'nor through the athlete''s entries (Início / countdown)');
-- Summary: previous record 8-2-1 / 3-1-1 + previous championship 1-0-1 gold + app 1-0-0 silver.
select is((select wins||'-'||losses||'-'||draws||'/'||gold||'-'||silver||'-'||bronze||'/'||championships
  from public.fight_record_summary(pg_temp.id('academy'),pg_temp.id('ana')) where modality_id=pg_temp.id('BJJ')),
  '10-2-2/4-2-1/2','the summary adds the three sources');

select pg_temp.login(pg_temp.id('bia'));
select is((select count(*)::int from public.championships where id=pg_temp.id('prev')),0,
  'another student does not see the previous championship');
select is((select count(*)::int from public.championships where academy_id=pg_temp.id('academy')),1,
  'the academy''s list for students has only team events');
select throws_ok(format('select * from public.championship_competitors(%L)',pg_temp.id('prev')),
  '42501','forbidden','another student cannot list its competitor');
select is((select count(*)::int from public.athlete_previous_records),0,'another student does not read the previous record');
select is((select wins||'-'||losses||'-'||draws||'/'||gold from public.fight_record_summary(pg_temp.id('academy'),pg_temp.id('ana'))),
  '10-2-2/4','a classmate sees the same summary totals');

-- Staff see it (to manage it); the app filters it out of their lists.
select pg_temp.login(pg_temp.id('inst'));
select is((select is_historical from public.championships where id=pg_temp.id('prev')),true,'staff read it, flagged');
select is((select count(*)::int from public.championship_competitors(pg_temp.id('prev'))),1,'staff list its athlete');

-- Staff delete it; the fights go with it.
delete from public.championships where id=pg_temp.id('prev');
select pg_temp.admin();
select is((select count(*)::int from public.championship_fights where entry_id=pg_temp.id('e_prev')),0,
  'deleting a previous championship removes its fights');
select pg_temp.login(pg_temp.id('owner'));
delete from public.athlete_previous_records;
select is((select count(*)::int from public.athlete_previous_records),0,'staff delete the previous record');

select * from finish();
rollback;
