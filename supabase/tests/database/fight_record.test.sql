-- Reach and fight record ("Cartel"), 2026-11-09.
-- Rules: only owner/instructor of the academy write fights and placements,
-- only for athletes entered in that championship, only from the championship
-- day on. Students never write. Classmates read only the summary of shared
-- modalities; reach follows weight/height (self or staff of a competitor).
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
('a3000000-0000-0000-0000-000000000001','owner@fr.test','{"full_name":"Owner"}'),
('a3000000-0000-0000-0000-000000000002','inst@fr.test','{"full_name":"Instrutor"}'),
('a3000000-0000-0000-0000-000000000003','ana@fr.test','{"full_name":"Ana"}'),
('a3000000-0000-0000-0000-000000000004','bia@fr.test','{"full_name":"Bia"}'),
('a3000000-0000-0000-0000-000000000005','caio@fr.test','{"full_name":"Caio"}'),
('a3000000-0000-0000-0000-000000000006','out@fr.test','{"full_name":"Outro"}');
insert into ids values
('owner','a3000000-0000-0000-0000-000000000001'),('inst','a3000000-0000-0000-0000-000000000002'),
('ana','a3000000-0000-0000-0000-000000000003'),('bia','a3000000-0000-0000-0000-000000000004'),
('caio','a3000000-0000-0000-0000-000000000005'),('out','a3000000-0000-0000-0000-000000000006');

select pg_temp.login(pg_temp.id('owner'));
insert into ids values('academy',public.create_academy('Cartel',array['BJJ','Boxe']));
select pg_temp.login(pg_temp.id('out'));
insert into ids values('other',public.create_academy('Outra',array['Judô']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status) values
(pg_temp.id('inst'),pg_temp.id('academy'),'instructor','active'),
(pg_temp.id('ana'),pg_temp.id('academy'),'student','active'),
(pg_temp.id('bia'),pg_temp.id('academy'),'student','active'),
(pg_temp.id('caio'),pg_temp.id('academy'),'student','active');
-- Ana competes in BJJ; Bia trains BJJ (not a competitor); Caio trains Boxe only.
insert into public.student_modality_enrollments(membership_id,modality_id,status,is_competitor,competitor_since)
select m.id,
  case when m.user_id=pg_temp.id('caio') then pg_temp.id('Boxe') else pg_temp.id('BJJ') end,
  'active', m.user_id=pg_temp.id('ana'), case when m.user_id=pg_temp.id('ana') then now() end
from public.memberships m where m.academy_id=pg_temp.id('academy') and m.role='student';

insert into ids values('past',gen_random_uuid()),('future',gen_random_uuid());
insert into public.championships(id,academy_id,modality_id,name,event_date) values
(pg_temp.id('past'),pg_temp.id('academy'),pg_temp.id('BJJ'),'Copa Passada',current_date-30),
(pg_temp.id('future'),pg_temp.id('academy'),pg_temp.id('BJJ'),'Copa Futura',current_date+30);
insert into public.championship_entries(championship_id,academy_id,athlete_id) values
(pg_temp.id('past'),pg_temp.id('academy'),pg_temp.id('ana')),
(pg_temp.id('future'),pg_temp.id('academy'),pg_temp.id('ana'));
insert into ids select 'e_past',id from public.championship_entries where championship_id=pg_temp.id('past');
insert into ids select 'e_future',id from public.championship_entries where championship_id=pg_temp.id('future');

-- ---------------------------------------------------------------- reach ---
select pg_temp.login(pg_temp.id('ana'));
update public.profiles set reach_cm=182.5 where id=pg_temp.id('ana');
select is((select reach_cm from public.get_profile_details(pg_temp.id('ana'))),182.5::numeric,'student saves and reads own reach');
select throws_ok(format('update public.profiles set reach_cm=0 where id=%L',pg_temp.id('ana')),'23514',null,'reach must be positive');
select pg_temp.login(pg_temp.id('inst'));
select is((select reach_cm from public.get_profile_details(pg_temp.id('ana'))),182.5::numeric,'staff read the reach of a competitor');
update public.profiles set reach_cm=100 where id=pg_temp.id('ana');
select pg_temp.login(pg_temp.id('bia'));
select is((select count(*)::int from public.get_profile_details(pg_temp.id('ana'))),0,'a classmate does not read the reach');
select pg_temp.admin();
select is((select reach_cm from public.profiles where id=pg_temp.id('ana')),182.5::numeric,'staff cannot edit the reach');

-- ----------------------------------------------------------- staff write ---
select pg_temp.login(pg_temp.id('inst'));
select lives_ok(format($$insert into public.championship_fights(entry_id,result,method,stage,opponent_name)
  values(%L,'win','submission','quarterfinal','João')$$,pg_temp.id('e_past')),'instructor records a fight after the event');
select is((select recorded_by from public.championship_fights limit 1),pg_temp.id('inst'),'who recorded is the caller');
select pg_temp.login(pg_temp.id('owner'));
select lives_ok(format($$insert into public.championship_fights(entry_id,result,method,stage)
  values(%L,'loss','points','semifinal')$$,pg_temp.id('e_past')),'owner records a fight');
update public.championship_entries set placement='bronze' where id=pg_temp.id('e_past');
select is((select placement from public.championship_entries where id=pg_temp.id('e_past')),'bronze','owner records the placement');
update public.championship_fights set note='Boa luta' where result='loss';
select is((select note from public.championship_fights where result='loss'),'Boa luta','staff edit a fight');

-- Rule: only after the championship date.
select throws_ok(format($$insert into public.championship_fights(entry_id,result,method)
  values(%L,'win','ko')$$,pg_temp.id('e_future')),'42501',null,'no fight before the championship day');
update public.championship_entries set placement='gold' where id=pg_temp.id('e_future');
select is((select placement from public.championship_entries where id=pg_temp.id('e_future')),null,'no placement before the championship day');

-- Rule: only athletes entered in that championship (the fight hangs off an entry).
select throws_ok($$insert into public.championship_fights(entry_id,result,method)
  values(gen_random_uuid(),'win','ko')$$,null,null,'no fight without an entry');
select throws_ok(format($$insert into public.championship_entries(championship_id,academy_id,athlete_id,placement)
  values(%L,%L,%L,'gold')$$,pg_temp.id('past'),pg_temp.id('academy'),pg_temp.id('bia')),'42501',null,
  'entering an athlete cannot set a placement');

-- Rule: only staff of THAT academy.
select pg_temp.login(pg_temp.id('out'));
select throws_ok(format($$insert into public.championship_fights(entry_id,result,method)
  values(%L,'win','ko')$$,pg_temp.id('e_past')),'42501',null,'staff of another academy cannot record');
update public.championship_entries set placement='gold' where id=pg_temp.id('e_past');
delete from public.championship_fights;
select pg_temp.admin();
select is((select placement from public.championship_entries where id=pg_temp.id('e_past')),'bronze','other academy cannot change the placement');
select is((select count(*)::int from public.championship_fights),2,'other academy cannot delete fights');

-- -------------------------------------------------------- students never write ---
select pg_temp.login(pg_temp.id('ana'));
select throws_ok(format($$insert into public.championship_fights(entry_id,result,method)
  values(%L,'win','ko')$$,pg_temp.id('e_past')),'42501',null,'the athlete cannot record a fight');
update public.championship_entries set placement='gold' where id=pg_temp.id('e_past');
update public.championship_fights set result='win';
delete from public.championship_fights;
select pg_temp.admin();
select is((select placement from public.championship_entries where id=pg_temp.id('e_past')),'bronze','the athlete cannot change the placement');
select is((select count(*)::int from public.championship_fights where result='win'),1,'the athlete cannot edit fights');
select is((select count(*)::int from public.championship_fights),2,'the athlete cannot delete fights');

-- ----------------------------------------------------------------- reads ---
select pg_temp.login(pg_temp.id('ana'));
select is((select count(*)::int from public.championship_fights),2,'the athlete reads own fights');
select is((select jsonb_array_length(fights) from public.athlete_fight_history(pg_temp.id('academy'),pg_temp.id('ana'))),2,
  'history lists the held championship with its fights');
select is((select count(*)::int from public.athlete_fight_history(pg_temp.id('academy'),pg_temp.id('ana'))),1,
  'history leaves out upcoming championships');
select is((select wins||'-'||losses||'-'||draws||'/'||bronze from public.fight_record_summary(pg_temp.id('academy'),pg_temp.id('ana'))),
  '1-1-0/1','summary of own record');

select pg_temp.login(pg_temp.id('bia'));
select is((select count(*)::int from public.championship_fights),0,'a classmate does not read fights');
select throws_ok(format('select * from public.athlete_fight_history(%L,%L)',pg_temp.id('academy'),pg_temp.id('ana')),
  '42501','forbidden','a classmate has no detailed history');
select is((select wins from public.fight_record_summary(pg_temp.id('academy'),pg_temp.id('ana'))),1,
  'a classmate of the modality reads the summary');
select is((select wins||'-'||losses from public.championship_competitors(pg_temp.id('past'))),'1-1',
  'students of the modality see the results of a held championship');

select pg_temp.login(pg_temp.id('caio'));
select is((select count(*)::int from public.fight_record_summary(pg_temp.id('academy'),pg_temp.id('ana'))),0,
  'no summary without a modality in common');

select pg_temp.login(pg_temp.id('out'));
select throws_ok(format('select * from public.fight_record_summary(%L,%L)',pg_temp.id('academy'),pg_temp.id('ana')),
  '42501','forbidden','outsiders read nothing');

-- Staff delete; removing the athlete from the championship removes the fights.
select pg_temp.login(pg_temp.id('inst'));
delete from public.championship_fights where result='loss';
select is((select count(*)::int from public.championship_fights),1,'staff delete a fight');
select pg_temp.admin();
delete from public.championship_entries where id=pg_temp.id('e_past');
select is((select count(*)::int from public.championship_fights),0,'fights go with the entry');

select * from finish();
rollback;
