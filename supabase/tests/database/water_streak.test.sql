-- Goal history is now server-owned; unknown dates are never backfilled.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('80000000-0000-0000-0000-000000000001','a@ws.test','{"full_name":"A"}'),
 ('80000000-0000-0000-0000-000000000002','b@ws.test','{"full_name":"B"}');
insert into public.water_logs(id,user_id,amount_ml,logged_at) values
 (gen_random_uuid(),'80000000-0000-0000-0000-000000000001',1000,'2020-11-10 02:00+00'),
 (gen_random_uuid(),'80000000-0000-0000-0000-000000000001',2500,'2020-11-10 15:00+00'),
 (gen_random_uuid(),'80000000-0000-0000-0000-000000000001',3000,'2020-11-12 15:00+00'),
 (gen_random_uuid(),'80000000-0000-0000-0000-000000000002',900,'2020-11-12 15:00+00');
insert into public.water_goal_days(user_id,day,goal_ml) values
 ('80000000-0000-0000-0000-000000000001','2020-11-10',2500),
 ('80000000-0000-0000-0000-000000000001','2020-11-12',3200);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$insert into public.water_goal_days(user_id,day,goal_ml) values('80000000-0000-0000-0000-000000000001','2020-11-09',1)$$,'42501',null,'cannot forge a past goal');
select is((select array_agg(day::text||':'||total_ml||':'||coalesce(goal_ml::text,'unknown') order by day) from public.my_water_days()),array['2020-11-09:1000:unknown','2020-11-10:2500:2500','2020-11-12:3000:3200'],'timezone, exact historical goals and unknown prior date');
select throws_ok($$update public.water_goal_days set goal_ml=1$$,'42501',null,'past goals cannot be lowered by client');
select lives_ok($$select public.record_my_water_goal()$$,'recording is server-derived');
select set_config('request.jwt.claims','{"sub":"80000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.water_goal_days),0,'goal history remains private');
select is((select array_agg(total_ml) from public.my_water_days()),array[900],'personal outcomes only');
select is((select goal_ml from public.my_water_days()),null::integer,'no fabricated historical goal');
select * from finish();
rollback;
