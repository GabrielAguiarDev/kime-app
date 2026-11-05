-- Water streak data: water_goal_days (own only) and my_water_days().
-- Run with: supabase test db
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(7);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
grant execute on function pg_temp.login(uuid) to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('80000000-0000-0000-0000-000000000001', 'a@ws.test', '{"full_name":"A"}'),
  ('80000000-0000-0000-0000-000000000002', 'b@ws.test', '{"full_name":"B"}');

-- Logs in UTC; the profile is in São Paulo (UTC-3): 02:00 UTC on the 10th is the 9th locally.
insert into public.water_logs (id, user_id, amount_ml, logged_at) values
  (gen_random_uuid(), '80000000-0000-0000-0000-000000000001', 1000, '2026-11-10 02:00+00'),
  (gen_random_uuid(), '80000000-0000-0000-0000-000000000001', 2500, '2026-11-10 15:00+00'),
  (gen_random_uuid(), '80000000-0000-0000-0000-000000000001', 3000, '2026-11-12 15:00+00'),
  (gen_random_uuid(), '80000000-0000-0000-0000-000000000002', 900, '2026-11-12 15:00+00');

select pg_temp.login('80000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into public.water_goal_days (user_id, day, goal_ml) values
       ('80000000-0000-0000-0000-000000000001', '2026-11-10', 2500),
       ('80000000-0000-0000-0000-000000000001', '2026-11-12', 3200) $$,
  'the user records their goals');
select throws_ok(
  $$ insert into public.water_goal_days (user_id, day, goal_ml) values ('80000000-0000-0000-0000-000000000002', '2026-11-10', 1) $$,
  '42501', null, 'nobody records goals for someone else');

select is((select array_agg(day::text || ':' || total_ml || ':' || goal_ml order by day) from public.my_water_days()),
  array['2026-11-09:1000:2500', '2026-11-10:2500:2500', '2026-11-12:3000:3200'],
  'days in the profile time zone; goal of the day, else the latest earlier one, else the first one');

update public.water_goal_days set goal_ml = 2000 where day = '2026-11-10';
select is((select goal_ml from public.my_water_days() where day = '2026-11-10'), 2000, 'the goal of a day can be corrected');

select pg_temp.login('80000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.water_goal_days), 0, 'goals of others are not visible');
select is((select array_agg(total_ml) from public.my_water_days()), array[900], 'only own logs');
select is((select goal_ml from public.my_water_days()), null::integer, 'no goal recorded yet: null');

select * from finish();
rollback;
