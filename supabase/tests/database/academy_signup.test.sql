-- Academy sign-up: create_academy_with_setup creates everything in one call
-- (academy + owner + modalities + suggested belts + plan), or nothing.
-- Run with: supabase test db
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(19);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
grant execute on function pg_temp.login(uuid) to public;

create temp table t_ids (key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$
  select val from t_ids where key = p_key
$$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-000000000001', 'dono@su.test', '{"full_name":"Dona"}'),
  ('b0000000-0000-0000-0000-000000000002', 'outro@su.test', '{"full_name":"Outro"}');
insert into t_ids values
  ('o', 'b0000000-0000-0000-0000-000000000001'), ('x', 'b0000000-0000-0000-0000-000000000002');

-- ------------------------------------------------------------ happy path ---
select pg_temp.login(pg_temp.id('o'));
insert into t_ids values ('a', public.create_academy_with_setup(
  '  Kimi Signup  ', 'pro',
  '[{"name": "Jiu-Jitsu", "uses_belts": true, "belts": [
      {"primary_color": "white"}, {"primary_color": "blue"}, {"primary_color": "purple"},
      {"primary_color": "brown"}, {"primary_color": "black"}]},
    {"name": "Muay Thai", "uses_belts": false},
    {"name": "Judô", "uses_belts": true, "belts": []}]'::jsonb));

set local role postgres;
select is((select name from public.academies where id = pg_temp.id('a')), 'Kimi Signup', 'the academy is created with the trimmed name');
select is((select plan_tier from public.academies where id = pg_temp.id('a')), 'pro', 'the chosen plan is saved');
select is(
  (select role || ':' || status from public.memberships where academy_id = pg_temp.id('a') and user_id = pg_temp.id('o')),
  'owner:active', 'the creator is the active owner');
select results_eq(
  $$ select name, uses_belts, position::int from public.academy_modalities where academy_id = pg_temp.id('a') order by position $$,
  $$ values ('Jiu-Jitsu'::text, true, 0), ('Muay Thai'::text, false, 1), ('Judô'::text, true, 2) $$,
  'modalities keep the order and their "uses belts" choice');
select results_eq(
  $$ select b.primary_color, b.position::int, b.classes_required from public.modality_belts b
     join public.academy_modalities m on m.id = b.modality_id
     where m.academy_id = pg_temp.id('a') and m.name = 'Jiu-Jitsu' order by b.position $$,
  $$ values ('white'::text, 0, null::int), ('blue', 1, null), ('purple', 2, null), ('brown', 3, null), ('black', 4, null) $$,
  'Jiu-Jitsu gets the suggested adult belts, without class counts');
select is(
  (select count(*)::int from public.modality_belts b join public.academy_modalities m on m.id = b.modality_id
   where m.academy_id = pg_temp.id('a') and m.name <> 'Jiu-Jitsu'),
  0, 'the other modalities start without belts');
select is((select count(*)::int from public.academy_invite_codes where academy_id = pg_temp.id('a') and status = 'active'), 2,
  'the academy has an active student code and an active professor code');

select pg_temp.login(pg_temp.id('o'));
select is(
  (select count(*)::int from public.academies where id = pg_temp.id('a')),
  1, 'the owner reads the new academy (RLS)');

-- Plan is optional.
insert into t_ids values ('b', public.create_academy_with_setup('Sem Plano', null, '[{"name": "Boxe", "uses_belts": false}]'::jsonb));
set local role postgres;
select is((select plan_tier from public.academies where id = pg_temp.id('b')), null, 'the plan may be left empty');

-- -------------------------------------------------------- all or nothing ---
select pg_temp.login(pg_temp.id('x'));
select throws_ok(
  $$ select public.create_academy_with_setup('Metade', 'starter',
       '[{"name": "Karatê", "uses_belts": true, "belts": [{"primary_color": "white"}, {"primary_color": "not-a-color"}]}]'::jsonb) $$,
  '23514', null, 'an invalid belt color fails the call');
select throws_ok(
  $$ select public.create_academy_with_setup('Metade', 'starter',
       '[{"name": "Karatê", "uses_belts": true, "belts": [{"primary_color": "white"}, {"primary_color": "white"}]}]'::jsonb) $$,
  '23505', null, 'a repeated belt in a modality fails the call');
set local role postgres;
select is(
  (select count(*)::int from public.memberships where user_id = pg_temp.id('x')),
  0, 'a failed call leaves no academy, membership or modality behind');

-- ------------------------------------------------------------ validation ---
select pg_temp.login(pg_temp.id('x'));
select throws_ok($$ select public.create_academy_with_setup('K', null, '[{"name": "Boxe"}]'::jsonb) $$,
  '22023', 'invalid_academy_name', 'the name needs 2 to 80 characters');
select throws_ok($$ select public.create_academy_with_setup('Kimi', 'gold', '[{"name": "Boxe"}]'::jsonb) $$,
  '22023', 'invalid_plan_tier', 'unknown plans are rejected');
select throws_ok($$ select public.create_academy_with_setup('Kimi', null, '[]'::jsonb) $$,
  '22023', 'invalid_modalities', 'at least one modality');
select throws_ok(
  $$ select public.create_academy_with_setup('Kimi', null, '[{"name": "Boxe"}, {"name": " boxe "}]'::jsonb) $$,
  '22023', 'invalid_modalities', 'modality names are unique ignoring case and spaces');
select throws_ok(
  $$ select public.create_academy_with_setup('Kimi', null,
       '[{"name": "Boxe", "uses_belts": false, "belts": [{"primary_color": "white"}]}]'::jsonb) $$,
  '22023', 'invalid_belts', 'belts only for modalities that use belts');

-- --------------------------------------------------------------- access ---
set local role anon;
select throws_ok($$ select public.create_academy_with_setup('Kimi', null, '[{"name": "Boxe"}]'::jsonb) $$,
  '42501', null, 'signed out cannot create an academy');

set local role postgres;
select pg_temp.login(pg_temp.id('o'));
select throws_ok($$ update public.academies set plan_tier = 'elite' where id = pg_temp.id('a') $$,
  '42501', null, 'the client cannot change the plan directly (no column grant)');

select * from finish();
rollback;
