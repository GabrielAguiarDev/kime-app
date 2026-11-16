-- Platform admin (2026-11-16): admin_* RPCs only for accounts in
-- private.platform_admins; writes keep the app's invariants and are audited.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select no_plan();
-- Sessions start with a password unless said otherwise.
create function pg_temp.login(u uuid, aal text default 'aal2', method text default 'password') returns void language plpgsql as $$begin
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','aal',aal,
   'amr',json_build_array(json_build_object('method','totp','timestamp',1),json_build_object('method',method,'timestamp',1)))::text,true);
end$$;
create function pg_temp.su() returns void language plpgsql as $$begin perform set_config('role','postgres',true);end$$;
grant execute on function pg_temp.login(uuid,text,text),pg_temp.su() to public;
create function pg_temp.u(n int) returns uuid language sql as $$select ('c1000000-0000-0000-0000-0000000000'||lpad(n::text,2,'0'))::uuid$$;
grant execute on function pg_temp.u(int) to public;

-- 1 platform admin · 2 owner · 3 instructor · 4 active student · 5 pending student · 6 pending instructor · 7 outsider
insert into auth.users(id,email,raw_user_meta_data) values
(pg_temp.u(1),'admin@pa.test','{"full_name":"Admin"}'),
(pg_temp.u(2),'owner@pa.test','{"full_name":"Owner"}'),
(pg_temp.u(3),'prof@pa.test','{"full_name":"Prof"}'),
(pg_temp.u(4),'ana@pa.test','{"full_name":"Ana"}'),
(pg_temp.u(5),'bia@pa.test','{"full_name":"Bia"}'),
(pg_temp.u(6),'caio@pa.test','{"full_name":"Caio"}'),
(pg_temp.u(7),'out@pa.test','{"full_name":"Out_side%"}');
insert into private.platform_admins(user_id) values (pg_temp.u(1));

create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
select pg_temp.login(pg_temp.u(2));
insert into ids values('academy',public.create_academy('Team PA',array['BJJ','Boxe']));
select pg_temp.su();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status) values
(pg_temp.u(3),pg_temp.id('academy'),'instructor','active'),
(pg_temp.u(4),pg_temp.id('academy'),'student','pending'),
(pg_temp.u(5),pg_temp.id('academy'),'student','pending'),
(pg_temp.u(6),pg_temp.id('academy'),'instructor','pending');
insert into ids select 'm'||right(user_id::text,1),id from public.memberships where academy_id=pg_temp.id('academy');
select public.approve_student(pg_temp.id('m4'),array[pg_temp.id('BJJ')]) from (select pg_temp.login(pg_temp.u(2))) x;
select pg_temp.su();

-- ------------------------------------------------------------- gatekeeping ---
select pg_temp.login(pg_temp.u(2));
select is(public.admin_is_admin(),false,'academy owner is not a platform admin');
select throws_ok($$select * from public.admin_overview()$$,'42501','forbidden','non-admin: overview forbidden');
select throws_ok($$select * from public.admin_list_academies()$$,'42501','forbidden','non-admin: list academies forbidden');
select throws_ok($$select * from public.admin_list_members('00000000-0000-0000-0000-000000000000')$$,'42501','forbidden','non-admin: members forbidden');
select throws_ok($$select public.admin_get_user('00000000-0000-0000-0000-000000000000')$$,'42501','forbidden','non-admin: user forbidden');
select throws_ok(format($$select public.admin_update_academy(%L,'X Team',14)$$,pg_temp.id('academy')),'42501','forbidden','non-admin: update academy forbidden');
select throws_ok(format($$select public.admin_remove_membership(%L)$$,pg_temp.id('m3')),'42501','forbidden','non-admin: remove forbidden');
select throws_ok($$select count(*) from private.platform_admins$$,'42501',null,'authenticated cannot read the admin list');
select throws_ok($$select count(*) from private.admin_audit_log$$,'42501',null,'authenticated cannot read the audit log');
select pg_temp.su();
set local role anon;
select throws_ok($$select public.admin_is_admin()$$,'42501',null,'anon cannot call admin RPCs');
reset role;
select pg_temp.su();

-- Every admin_* RPC (but the gate) refuses a non-admin, is SECURITY DEFINER
-- with an empty search_path, and is not callable by anon. New RPCs are
-- covered automatically.
select pg_temp.su();
create temp table admin_fns on commit drop as
select p.oid, p.proname, p.prosecdef, p.proconfig,
  'select public.' || p.proname || '(' ||
    coalesce((select string_agg('null::' || format_type(t, null), ',' order by i)
              from unnest(p.proargtypes) with ordinality a(t, i)), '') || ')' as call
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'admin\_%';
grant select on admin_fns to authenticated;
select ok((select count(*) from admin_fns) >= 15, 'admin RPCs found in the catalog');
select is((select array_agg(proname::text) from admin_fns where not prosecdef or not (proconfig @> array['search_path=""'])),
  null, 'every admin RPC is SECURITY DEFINER with an empty search_path');
select is((select array_agg(proname::text) from admin_fns where has_function_privilege('anon', oid, 'execute')),
  null, 'anon cannot execute any admin RPC');
create function pg_temp.refuses(p_call text) returns text language plpgsql as $$
begin
  execute p_call;
  return 'allowed';
exception when others then
  return sqlstate || ':' || sqlerrm;
end $$;
grant execute on function pg_temp.refuses(text) to public;
select pg_temp.login(pg_temp.u(2));
select is((select array_agg(proname::text) from admin_fns
  where proname <> 'admin_is_admin' and pg_temp.refuses(call) <> '42501:forbidden'),
  null, 'every admin RPC refuses a non-admin (aal2 session)');
select pg_temp.login(pg_temp.u(1), 'aal1');
select lives_ok($$select * from public.admin_overview()$$, 'no second factor required (aal1 admin session works)');
select pg_temp.login(pg_temp.u(1), 'aal2', 'oauth');
select is((select array_agg(proname::text) from admin_fns
  where proname <> 'admin_is_admin' and pg_temp.refuses(call) <> '42501:password_login_required'),
  null, 'every admin RPC refuses a session opened with Google/Apple (oauth)');
select pg_temp.su();

-- -------------------------------------------------------------------- reads ---
select pg_temp.login(pg_temp.u(1));
select is(public.admin_is_admin(),true,'listed account is admin');
select ok((select academies from public.admin_overview())>=1,'overview counts academies');
select is((select students from public.admin_list_academies('team pa')),1::bigint,'one active student');
select is((select staff from public.admin_list_academies('team pa')),2::bigint,'owner + instructor are staff');
select is((select pending from public.admin_list_academies('team pa')),2::bigint,'two pending requests');
select is((select owner_email from public.admin_list_academies('owner@pa.test')),'owner@pa.test','search by owner e-mail');
select is((select count(*) from public.admin_list_users('zz%')),0::bigint,'wildcards in the search are literal');
select is((select count(*) from public.admin_list_users('side%')),1::bigint,'literal % matches the name');
select is((select count(*) from public.admin_list_members(pg_temp.id('academy'))),5::bigint,'every membership is listed');
select is((select jsonb_array_length(modalities) from public.admin_list_members(pg_temp.id('academy')) where user_id=pg_temp.u(4)),1,'student modalities listed');
select is((public.admin_get_user(pg_temp.u(4))->>'email'),'ana@pa.test','user detail has the e-mail');
select is(jsonb_array_length(public.admin_get_user(pg_temp.u(4))->'memberships'),1,'user detail lists memberships');

-- ------------------------------------------------------------------- writes ---
select lives_ok(format($$select public.admin_update_academy(%L,'Team PA 2',30)$$,pg_temp.id('academy')),'admin updates academy');
select pg_temp.su();
select is((select name||'/'||inactive_after_days from public.academies where id=pg_temp.id('academy')),'Team PA 2/30','academy saved');
select pg_temp.login(pg_temp.u(1));
select throws_ok(format($$select public.admin_update_subscription(%L,'gold','monthly',null,'active',null)$$,pg_temp.id('academy')),'22023','plan_not_found','unknown plan rejected');

select lives_ok(format($$select public.admin_update_profile(%L,' Ana Maria ','2000-01-02','female',165,60.5,170)$$,pg_temp.u(4)),'admin updates profile');
select pg_temp.su();
select is((select full_name from public.profiles where id=pg_temp.u(4)),'Ana Maria','name trimmed');
select pg_temp.login(pg_temp.u(1));
select throws_ok(format($$select public.admin_update_profile(%L,' ',null,null,null,null,null)$$,pg_temp.u(4)),'22023','invalid_name','blank name rejected');

-- approve / reject
select throws_ok(format($$select public.admin_decide_membership(%L,true,null)$$,pg_temp.id('m5')),'22023','student_modality_required','student approval needs modalities');
select throws_ok(format($$select public.admin_decide_membership(%L,true,array[%L]::uuid[])$$,pg_temp.id('m5'),pg_temp.id('m3')),'22023','student_modality_required','modality of the academy only');
select lives_ok(format($$select public.admin_decide_membership(%L,true,array[%L,%L]::uuid[])$$,pg_temp.id('m5'),pg_temp.id('BJJ'),pg_temp.id('Boxe')),'admin approves student');
select pg_temp.su();
select is((select count(*) from public.student_modality_enrollments where membership_id=pg_temp.id('m5') and status='active'),2::bigint,'student linked to both modalities');
select pg_temp.login(pg_temp.u(1));
select pg_temp.su();
select is((select decided_by from public.memberships where id=pg_temp.id('m5')),pg_temp.u(1),'decided_by = admin');
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_decide_membership(%L,false)$$,pg_temp.id('m6')),'admin rejects instructor request');
select pg_temp.su();
select is((select status::text from public.memberships where id=pg_temp.id('m6')),'rejected','request rejected');
select pg_temp.login(pg_temp.u(1));
select throws_ok(format($$select public.admin_decide_membership(%L,true,null)$$,pg_temp.id('m6')),'22023','membership_not_pending','only pending requests');

-- modalities and competitor
select lives_ok(format($$select public.admin_set_student_modalities(%L,array[%L]::uuid[])$$,pg_temp.id('m5'),pg_temp.id('Boxe')),'admin sets modalities');
select pg_temp.su();
select is((select array_agg(modality_id) from public.student_modality_enrollments where membership_id=pg_temp.id('m5') and status='active'),array[pg_temp.id('Boxe')],'only Boxe left active');
select pg_temp.login(pg_temp.u(1));
select throws_ok(format($$select public.admin_set_student_modalities(%L,array[]::uuid[])$$,pg_temp.id('m5')),'22023','student_modality_required','at least one modality');
select pg_temp.su();
insert into ids select 'e5',id from public.student_modality_enrollments where membership_id=pg_temp.id('m5') and status='active';
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_set_competitor(%L,true)$$,pg_temp.id('e5')),'admin makes competitor');
select pg_temp.su();
select is((select is_competitor from public.memberships where id=pg_temp.id('m5')),true,'membership competitor cache follows');
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_set_competitor(%L,false)$$,pg_temp.id('e5')),'admin removes competitor');
select pg_temp.su();
select is((select is_competitor from public.memberships where id=pg_temp.id('m5')),false,'cache cleared');
select pg_temp.login(pg_temp.u(1));


-- taking a competitor off the team drops FUTURE entries of that modality only
select pg_temp.su();
select public.admin_set_competitor(pg_temp.id('e5'),true) from (select pg_temp.login(pg_temp.u(1))) x;
select pg_temp.su();
insert into public.championships(academy_id,modality_id,name,event_date) values
(pg_temp.id('academy'),pg_temp.id('Boxe'),'Futuro',private.academy_local_date(pg_temp.id('academy'))+7),
(pg_temp.id('academy'),pg_temp.id('Boxe'),'Passado',private.academy_local_date(pg_temp.id('academy'))-7);
insert into public.championship_entries(championship_id,academy_id,athlete_id)
select id,academy_id,pg_temp.u(5) from public.championships where academy_id=pg_temp.id('academy');
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_set_competitor(%L,false)$$,pg_temp.id('e5')),'admin takes competitor off the team');
select pg_temp.su();
select is((select array_agg(c.name) from public.championship_entries e join public.championships c on c.id=e.championship_id
  where e.athlete_id=pg_temp.u(5)),array['Passado'],'future entry removed, past entry kept');

-- fixtures for the role changes: Prof teaches BJJ and gives a class; Ana competes in BJJ with a future entry
insert into public.instructor_modalities(membership_id,academy_id,modality_id) values (pg_temp.id('m3'),pg_temp.id('academy'),pg_temp.id('BJJ'));
insert into public.class_schedules(academy_id,modality_id,weekday,start_time,instructor_id)
values (pg_temp.id('academy'),pg_temp.id('BJJ'),1,'19:00',pg_temp.u(3));
update public.student_modality_enrollments set is_competitor=true where membership_id=pg_temp.id('m4');
insert into public.championships(academy_id,modality_id,name,event_date)
values (pg_temp.id('academy'),pg_temp.id('BJJ'),'Copa BJJ',private.academy_local_date(pg_temp.id('academy'))+3);
insert into public.championship_entries(championship_id,academy_id,athlete_id)
select id,academy_id,pg_temp.u(4) from public.championships where name='Copa BJJ';
insert into ids select 'e4',id from public.student_modality_enrollments where membership_id=pg_temp.id('m4');
select pg_temp.login(pg_temp.u(1));

-- roles
select throws_ok(format($$select public.admin_set_member_role(%L,'student',array[%L]::uuid[])$$,pg_temp.id('m2'),pg_temp.id('BJJ')),'22023','role_change_invalid','owner role never changes');
select throws_ok(format($$select public.admin_set_member_role(%L,'owner')$$,pg_temp.id('m3')),'22023','role_change_invalid','nobody becomes owner here');
select throws_ok(format($$select public.admin_set_member_role(%L,'student')$$,pg_temp.id('m3')),'22023','student_modality_required','becoming student needs modalities');
select lives_ok(format($$select public.admin_set_member_role(%L,'student',array[%L]::uuid[])$$,pg_temp.id('m3'),pg_temp.id('BJJ')),'instructor → student');
select pg_temp.su();
select is((select role::text from public.memberships where id=pg_temp.id('m3')),'student','role saved');
select is((select count(*) from public.instructor_modalities where membership_id=pg_temp.id('m3')),0::bigint,'no longer teaches modalities');
select is((select count(*) from public.class_schedules where instructor_id=pg_temp.u(3)),0::bigint,'left the schedules they gave');
select pg_temp.login(pg_temp.u(1));
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_set_member_role(%L,'instructor')$$,pg_temp.id('m4')),'student → instructor');
select pg_temp.su();
select is((select count(*) from public.student_modality_enrollments where membership_id=pg_temp.id('m4') and status='active'),0::bigint,'links ended');
select is((select count(*) from public.championship_entries where athlete_id=pg_temp.u(4)),0::bigint,'future championship entry removed with the link');
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_set_member_role(%L,'student',array[%L]::uuid[])$$,pg_temp.id('m4'),pg_temp.id('BJJ')),'instructor → student again');
select pg_temp.su();
select is((select array_agg(id::text||status) from public.student_modality_enrollments where membership_id=pg_temp.id('m4')),
  array[pg_temp.id('e4')::text||'active'],'the old link is re-activated (no duplicate)');
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_set_member_role(%L,'instructor')$$,pg_temp.id('m4')),'back to instructor');
select pg_temp.login(pg_temp.u(1));
set constraints all immediate;
select pass('deferred invariants hold (active students have a modality)');
set constraints all deferred;

-- remove
select throws_ok(format($$select public.admin_remove_membership(%L)$$,pg_temp.id('m2')),'22023','cannot_remove_owner','owner is never removed');
select lives_ok(format($$select public.admin_remove_membership(%L)$$,pg_temp.id('m6')),'admin removes a membership');
select pg_temp.su();
select is((select count(*) from public.memberships where id=pg_temp.id('m6')),0::bigint,'membership gone');
select pg_temp.login(pg_temp.u(1));

-- audit
select pg_temp.su();
select ok((select count(*) from private.admin_audit_log where admin_id=pg_temp.u(1))>=9,'writes are audited');
select is((select action from private.admin_audit_log where target_id=pg_temp.id('m6') order by id desc limit 1),'remove_membership','removal audited');

select * from finish();
rollback;
