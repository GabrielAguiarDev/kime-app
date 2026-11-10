-- Timer preset order: each user writes the order of their own list.
-- Run with: supabase test db
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select plan(4);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
grant execute on function pg_temp.login(uuid) to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000021', 'a@tpo.test', '{"full_name":"Aluno"}'),
  ('a0000000-0000-0000-0000-000000000022', 'b@tpo.test', '{"full_name":"Outro"}');

select pg_temp.login('a0000000-0000-0000-0000-000000000021');
select is((select timer_preset_order from public.profiles where id = 'a0000000-0000-0000-0000-000000000021'),
  '{}'::text[], 'starts empty');
select lives_ok(
  $$ update public.profiles set timer_preset_order = '{builtin:mma,builtin:boxe}'
     where id = 'a0000000-0000-0000-0000-000000000021' $$,
  'the user saves their order');
select throws_ok(
  $$ update public.profiles set timer_preset_order = array(select 'builtin:x' || g from generate_series(1, 201) g)
     where id = 'a0000000-0000-0000-0000-000000000021' $$,
  '23514', null, 'at most 200 ids');

select pg_temp.login('a0000000-0000-0000-0000-000000000022');
update public.profiles set timer_preset_order = '{builtin:boxe}' where id = 'a0000000-0000-0000-0000-000000000021';
reset role;
select is((select timer_preset_order from public.profiles where id = 'a0000000-0000-0000-0000-000000000021'),
  '{builtin:mma,builtin:boxe}'::text[], 'others cannot change it');

select * from finish();
rollback;
