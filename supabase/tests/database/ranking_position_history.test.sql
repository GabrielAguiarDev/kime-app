begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
('a3000000-0000-0000-0000-000000000001','owner@rankhistory.test','{"full_name":"Owner"}'),
('a3000000-0000-0000-0000-000000000002','student@rankhistory.test','{"full_name":"Student"}');
select set_config('request.jwt.claims','{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temp table ids(k text primary key,v uuid);
insert into ids values('academy',public.create_academy('Rank history',array['BJJ']));
insert into ids select 'modality',id from public.academy_modalities where academy_id=(select v from ids where k='academy');

-- Same flow as rebuild_rankings: insert unpositioned, then set the position.
insert into public.ranking_snapshots(academy_id,modality_id,user_id,period_from,period_to,full_name,score,status)
select (select v from ids where k='academy'),(select v from ids where k='modality'),'a3000000-0000-0000-0000-000000000002',
 date '2026-10-01',date '2026-10-28','Student',50,'ranked';
select is((select count(*)::int from public.ranking_position_history where user_id='a3000000-0000-0000-0000-000000000002'),0,'no history while unpositioned');
update public.ranking_snapshots set position=3 where user_id='a3000000-0000-0000-0000-000000000002';
select is((select position from public.ranking_position_history where user_id='a3000000-0000-0000-0000-000000000002' and period_to='2026-10-28'),3,'position recorded under period_to');
update public.ranking_snapshots set position=2 where user_id='a3000000-0000-0000-0000-000000000002';
select is((select position from public.ranking_position_history where user_id='a3000000-0000-0000-0000-000000000002' and period_to='2026-10-28'),2,'same-day recalculation overwrites');

-- Next day: rebuild replaces the snapshot; the previous day stays.
delete from public.ranking_snapshots where user_id='a3000000-0000-0000-0000-000000000002';
insert into public.ranking_snapshots(academy_id,modality_id,user_id,period_from,period_to,full_name,score,status,position)
select (select v from ids where k='academy'),(select v from ids where k='modality'),'a3000000-0000-0000-0000-000000000002',
 date '2026-10-02',date '2026-10-29','Student',60,'ranked',1;
select is((select position from public.ranking_position_history where user_id='a3000000-0000-0000-0000-000000000002' and period_to='2026-10-28'),2,'previous day kept');
select is((select position from public.ranking_position_history where user_id='a3000000-0000-0000-0000-000000000002' and period_to='2026-10-29'),1,'new day recorded');

-- Old days are pruned.
update public.ranking_snapshots set period_to='2026-11-10',position=4 where user_id='a3000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.ranking_position_history where user_id='a3000000-0000-0000-0000-000000000002' and period_to<'2026-11-03'),0,'days older than a week are pruned');
select * from finish();
rollback;
