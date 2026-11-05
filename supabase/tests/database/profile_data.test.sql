-- Personal data on the profile (sex, birth_date). Run with: supabase test db
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(9);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.login(uuid), pg_temp.logout() to public;
create temp table t_acad (id uuid) on commit drop;
grant all on t_acad to authenticated;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'a@pd.test'),
  ('40000000-0000-0000-0000-000000000002', 'b@pd.test');

select pg_temp.login('40000000-0000-0000-0000-000000000001');
update public.profiles set sex = 'female', birth_date = '1990-03-15', weight_kg = 70, height_cm = 170
where id = '40000000-0000-0000-0000-000000000001';
select is((select sex || '/' || birth_date::text from public.get_profile_details('40000000-0000-0000-0000-000000000001')),
  'female/1990-03-15', 'user saves own sex and birth date');
select throws_ok($$ update public.profiles set sex = 'robot' where id = '40000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'sex accepts only the known values');
select throws_ok($$ update public.profiles set birth_date = '1850-01-01' where id = '40000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'birth date before 1900 is rejected');
update public.profiles set sex = 'male' where id = '40000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is((select sex from public.profiles where id = '40000000-0000-0000-0000-000000000002'), null,
  'nobody edits another user''s data');

select pg_temp.login('40000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.profiles where id = '40000000-0000-0000-0000-000000000001'), 0,
  'a stranger does not read the profile');
update public.profiles set sex = 'unspecified', birth_date = null where id = '40000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select is((select sex from public.profiles where id = '40000000-0000-0000-0000-000000000002'), 'unspecified',
  'prefer-not-to-say is a valid answer');

-- Academy logo: can be replaced, never removed once set.
select pg_temp.login('40000000-0000-0000-0000-000000000001');
insert into t_acad select public.create_academy('Logo Teste', array['Judô']);
update public.academies set logo_path = (select id from t_acad)::text || '/logo-1.jpg' where id = (select id from t_acad);
select is((select logo_path from public.academies where id = (select id from t_acad)), (select id from t_acad)::text || '/logo-1.jpg',
  'owner sets the logo');
update public.academies set logo_path = (select id from t_acad)::text || '/logo-2.jpg' where id = (select id from t_acad);
select is((select logo_path from public.academies where id = (select id from t_acad)), (select id from t_acad)::text || '/logo-2.jpg',
  'owner replaces the logo');
select throws_ok($$ update public.academies set logo_path = null where id = (select id from t_acad) $$,
  '23514', 'logo_required', 'the logo cannot be removed');
select pg_temp.logout();

select * from finish();
rollback;
