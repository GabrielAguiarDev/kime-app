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
create function pg_temp.login_tv(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
end $$;
grant execute on function pg_temp.login_tv(uuid) to public;
create temp table t_ids(key text primary key, val uuid) on commit drop;
grant all on t_ids to authenticated;
create temp table t_codes(key text primary key, val text) on commit drop;
grant all on t_codes to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select val from t_ids where key = p_key $$;
grant execute on function pg_temp.id(text) to public;
insert into auth.users(id,email) values
 ('b0000000-0000-0000-0000-000000000001','owner1@tv.test'),
 ('b0000000-0000-0000-0000-000000000002','student@tv.test'),
 ('b0000000-0000-0000-0000-000000000003','owner2@tv.test'),
 ('b0000000-0000-0000-0000-000000000004','tv1@tv.test'),
 ('b0000000-0000-0000-0000-000000000005','tv2@tv.test');
insert into t_ids values
 ('o1','b0000000-0000-0000-0000-000000000001'),
 ('s','b0000000-0000-0000-0000-000000000002'),
 ('o2','b0000000-0000-0000-0000-000000000003'),
 ('tv1','b0000000-0000-0000-0000-000000000004'),
 ('tv2','b0000000-0000-0000-0000-000000000005');
select pg_temp.login(pg_temp.id('o1'));
insert into t_ids values ('a1', public.create_academy('TV A1', array['Boxe']));
select pg_temp.login(pg_temp.id('o2'));
insert into t_ids values ('a2', public.create_academy('TV A2', array['Boxe']));
set local role postgres;
insert into public.memberships(academy_id,user_id,role,status)
 values(pg_temp.id('a1'),pg_temp.id('s'),'student','active');
select pg_temp.login(pg_temp.id('tv1'));
insert into t_ids values ('d1',(public.create_tv_pairing()).id);
insert into t_codes select 'd1', pairing_code from public.tv_displays where id=pg_temp.id('d1');
select pg_temp.login(pg_temp.id('tv2'));
insert into t_ids values ('d2',(public.create_tv_pairing()).id);
insert into t_codes select 'd2', pairing_code from public.tv_displays where id=pg_temp.id('d2');
select is((select count(*)::int from public.tv_displays),1,'TV reads only own row');
select is((select count(*)::int from public.tv_displays where id=pg_temp.id('d1')),0,'TV cannot read another TV');
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ select public.pair_tv((select val from t_codes where key='d1'),pg_temp.id('a1'),'Tatame') $$,
 '42501',null,'student cannot pair');
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.tv_displays),0,'other academy staff cannot read unpaired TV');
select throws_ok($$ select public.update_tv_timer(pg_temp.id('d1'),' {"status":"idle"}'::jsonb,0) $$,
 '42501',null,'other academy staff cannot control');
select pg_temp.login(pg_temp.id('o1'));
select lives_ok($$ select public.pair_tv((select val from t_codes where key='d1'),pg_temp.id('a1'),'Tatame') $$,
 'staff pairs valid code');
select is((select count(*)::int from public.tv_displays),1,'staff sees own academy TV');
select throws_ok($$ select public.pair_tv((select val from t_codes where key='d1'),pg_temp.id('a1'),'Reuso') $$,
 '22023',null,'used code fails');
select pg_temp.login(pg_temp.id('o2'));
select is((select count(*)::int from public.tv_displays),0,'other academy cannot read paired TV');
select throws_ok($$ select public.update_tv_timer(pg_temp.id('d1'),' {"status":"idle"}'::jsonb,1) $$,
 '42501',null,'other academy cannot control paired TV');
set local role postgres;
update public.tv_displays set pairing_expires_at=now()-interval '1 minute' where id=pg_temp.id('d2');
select pg_temp.login(pg_temp.id('o1'));
select throws_ok($$ select public.pair_tv((select val from t_codes where key='d2'),pg_temp.id('a1'),'Expirada') $$,
 '22023',null,'expired code fails');
select pg_temp.login(pg_temp.id('s'));
select throws_ok($$ select public.update_tv_timer(pg_temp.id('d1'),' {"status":"idle"}'::jsonb,1) $$,
 '42501',null,'student cannot control');
select throws_ok($$ select public.tv_disconnect_self() $$,
 '42501',null,'student cannot disconnect a TV');
select pg_temp.login(pg_temp.id('o1'));
select throws_ok($$ select public.tv_disconnect_self() $$,
 '42501',null,'staff cannot use the TV-only disconnect');
select pg_temp.login_tv(pg_temp.id('tv2'));
select lives_ok($$ select public.tv_disconnect_self() $$,
 'TV can disconnect its own display');
set local role postgres;
select is((select academy_id from public.tv_displays where id=pg_temp.id('d1')),
 pg_temp.id('a1'),'disconnecting another TV leaves the paired TV untouched');
select pg_temp.login_tv(pg_temp.id('tv1'));
select lives_ok($$ select public.tv_disconnect_self() $$,
 'paired TV can disconnect itself');
select ok((select academy_id is null and pairing_code is null and timer_state is null and state_version=2
 from public.tv_displays where id=pg_temp.id('d1')),
 'disconnect clears academy, pairing and timer state');
select ok((public.create_tv_pairing()).pairing_code is not null,
 'the disconnected TV receives a new pairing code');
select * from finish();
rollback;
