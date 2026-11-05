-- Independent participants, attendance and eligibility; water remains individual.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temp table ids(k text primary key,v uuid); grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
create function pg_temp.login(u uuid) returns void language plpgsql as $$begin
 perform set_config('role','authenticated',true); perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
end$$;
create function pg_temp.admin() returns void language plpgsql as $$begin
 perform set_config('role','postgres',true);perform set_config('request.jwt.claims','{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
end$$;
grant execute on function pg_temp.id(text),pg_temp.login(uuid),pg_temp.admin() to public;
insert into auth.users(id,email,raw_user_meta_data) values
('97000000-0000-0000-0000-000000000001','owner@modranking.test','{"full_name":"Owner"}'),
('97000000-0000-0000-0000-000000000002','multi@modranking.test','{"full_name":"Multi"}'),
('97000000-0000-0000-0000-000000000003','single@modranking.test','{"full_name":"Single"}'),
('97000000-0000-0000-0000-000000000004','none@modranking.test','{"full_name":"None"}');
insert into ids values('owner','97000000-0000-0000-0000-000000000001'),('multi','97000000-0000-0000-0000-000000000002'),('single','97000000-0000-0000-0000-000000000003'),('none','97000000-0000-0000-0000-000000000004');
select pg_temp.login(pg_temp.id('owner'));
insert into ids values('academy',public.create_academy('Modal ranking',array['Muay Thai','BJJ','Boxe']));
select pg_temp.admin();
insert into ids select name,id from public.academy_modalities where academy_id=pg_temp.id('academy');
insert into public.memberships(user_id,academy_id,role,status,created_at,decided_at)
select v,pg_temp.id('academy'),'student','active',now()-interval '40 days',now()-interval '40 days' from ids where k in ('multi','single','none');
insert into ids select 'm-'||i.k,m.id from public.memberships m join ids i on i.v=m.user_id where m.academy_id=pg_temp.id('academy') and m.role='student';
update private.membership_active_periods ap set starts_at=now()-interval '40 days' from public.memberships m where m.id=ap.membership_id and m.academy_id=pg_temp.id('academy');
create function pg_temp.today() returns date language sql as $$select private.academy_local_date(pg_temp.id('academy'))$$;
grant execute on function pg_temp.today() to public;
insert into public.student_modality_enrollments(membership_id,modality_id,status) values
(pg_temp.id('m-multi'),pg_temp.id('Muay Thai'),'active'),(pg_temp.id('m-multi'),pg_temp.id('BJJ'),'active'),(pg_temp.id('m-single'),pg_temp.id('Muay Thai'),'active');
insert into private.modality_active_periods(enrollment_id,starts_at)
select e.id,((pg_temp.today()-case when e.modality_id=pg_temp.id('BJJ') then 10 else 30 end)::timestamp at time zone 'America/Sao_Paulo')
from public.student_modality_enrollments e where e.membership_id in(pg_temp.id('m-multi'),pg_temp.id('m-single'));
insert into public.class_schedules(academy_id,modality_id,weekday,start_time)
select pg_temp.id('academy'),v,extract(dow from pg_temp.today()-1),'18:00' from ids where k in ('Muay Thai','BJJ');
insert into ids select 's-'||mo.name,s.id from public.class_schedules s join public.academy_modalities mo on mo.id=s.modality_id where s.academy_id=pg_temp.id('academy');
insert into public.student_class_enrollments(membership_id,schedule_id,modality_id,weekday,start_time,starts_on)
select pg_temp.id('m-multi'),s.id,s.modality_id,s.weekday,s.start_time,pg_temp.today()-21 from public.class_schedules s where s.academy_id=pg_temp.id('academy');
insert into public.checkins(user_id,academy_id,schedule_id,class_date,status) values(pg_temp.id('multi'),pg_temp.id('academy'),pg_temp.id('s-Muay Thai'),pg_temp.today()-1,'confirmed');
insert into private.water_auto_goal_history(user_id,effective_on,goal_ml) values(pg_temp.id('multi'),pg_temp.today()-30,2000);
insert into public.water_logs(id,user_id,amount_ml,logged_at)
select gen_random_uuid(),pg_temp.id('multi'),2000,(d+interval '12 hours') at time zone 'America/Sao_Paulo' from generate_series((pg_temp.today()-21)::timestamp,(pg_temp.today()-2)::timestamp,interval '1 day')d;
create function pg_temp.facts(modality text) returns jsonb language sql as $$
select to_jsonb(r) from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id(modality),pg_temp.today()-21,pg_temp.today()-1)r where r.user_id=pg_temp.id('multi')$$;
grant execute on function pg_temp.facts(text) to public;
select pg_temp.login(pg_temp.id('owner'));
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('Muay Thai'),pg_temp.today()-21,pg_temp.today()-1)),2,'MT includes only its two enrolled students');
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.today()-21,pg_temp.today()-1)),1,'multi student participates in BJJ too; MT-only student is excluded');
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('Boxe'),pg_temp.today()-21,pg_temp.today()-1)),0,'no fabricated membership in another modality');
select is(jsonb_array_length(pg_temp.facts('Muay Thai')->'attendance'),3,'MT denominator uses its own eligible schedule');
select is(jsonb_array_length(pg_temp.facts('BJJ')->'attendance'),2,'later BJJ enrolment has fewer eligible classes');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('Muay Thai')->'attendance')c where c->>'done'='true'),1,'confirmed MT check-in counts in MT');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('BJJ')->'attendance')c where c->>'done'='true'),0,'MT check-in cannot complete a BJJ obligation');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('Muay Thai')->'hydration')d where d->>'eligible'='true'),21,'MT hydration uses its own full membership dates');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('BJJ')->'hydration')d where d->>'eligible'='true'),9,'BJJ hydration starts only after BJJ activation');
select is((select jsonb_agg(d-'eligible' order by d->>'day') from jsonb_array_elements(pg_temp.facts('Muay Thai')->'hydration')d),(select jsonb_agg(d-'eligible' order by d->>'day') from jsonb_array_elements(pg_temp.facts('BJJ')->'hydration')d),'hydration/freeze history is the same individual history in both rankings');
select pg_temp.login(pg_temp.id('multi'));
select is((select count(*)::int from public.water_logs where user_id=pg_temp.id('multi')),20,'consulting two modalities never duplicates water logs');
select pg_temp.login(pg_temp.id('owner'));
select is(pg_temp.facts('Muay Thai'),pg_temp.facts('Muay Thai'),'repeated calculations have no side effects');
select throws_ok($$select * from public.academy_ranking_facts(pg_temp.id('academy'),null,pg_temp.today()-21,pg_temp.today()-1)$$,'22023','invalid_ranking_modality','modality is mandatory');
select throws_ok($$select * from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),null,pg_temp.today()-1)$$,'22023','invalid_ranking_period','start date is mandatory');
select throws_ok($$select * from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.today()-21,null)$$,'22023','invalid_ranking_period','end date is mandatory');
select ok(to_regprocedure('public.academy_ranking_facts(uuid,date,date)') is null,'no callable global ranking overload remains');
select pg_temp.login(pg_temp.id('multi'));
select is((select array_agg(name order by name) from public.ranking_modalities(pg_temp.id('academy'),pg_temp.today()-21,pg_temp.today()-1)),array['BJJ','Muay Thai'],'student can select both their active modalities');
select throws_ok($$select public.set_student_modality_enrollment(pg_temp.id('m-multi'),pg_temp.id('Boxe'),'active')$$,'42501','forbidden','student cannot self-enrol to manufacture ranking eligibility');
select throws_ok($$update public.student_modality_enrollments set status='active'$$,'42501',null,'client cannot overwrite membership status/history');
select pg_temp.login(pg_temp.id('single'));
select is((select array_agg(name) from public.ranking_modalities(pg_temp.id('academy'),pg_temp.today()-21,pg_temp.today()-1)),array['Muay Thai'],'single-modality student sees only their modality');
select throws_ok($$select * from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.today()-21,pg_temp.today()-1)$$,'42501','forbidden','cannot request classmates data in an unregistered modality');
select pg_temp.login(pg_temp.id('owner'));
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.today()-21,pg_temp.today()-12)),0,'historical interval before BJJ entry has no BJJ participants');
-- Explicit historical pause/resume intervals; no production timestamps are backdated.
select pg_temp.admin();
update private.modality_active_periods ap set ends_at=((pg_temp.today()-8)::timestamp at time zone 'America/Sao_Paulo') from public.student_modality_enrollments e where e.id=ap.enrollment_id and e.membership_id=pg_temp.id('m-multi') and e.modality_id=pg_temp.id('BJJ');
insert into private.modality_active_periods(enrollment_id,starts_at)
select id,((pg_temp.today()-4)::timestamp at time zone 'America/Sao_Paulo') from public.student_modality_enrollments where membership_id=pg_temp.id('m-multi') and modality_id=pg_temp.id('BJJ');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('BJJ')->'hydration')d where d->>'eligible'='true'),4,'BJJ suspension excludes its own inactive days');
select is(jsonb_array_length(pg_temp.facts('BJJ')->'attendance'),1,'class during BJJ suspension creates no failure');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('Muay Thai')->'hydration')d where d->>'eligible'='true'),21,'BJJ suspension does not affect MT');
select pg_temp.login(pg_temp.id('owner'));
select lives_ok($$select public.set_student_modality_enrollment(pg_temp.id('m-multi'),pg_temp.id('BJJ'),'suspended')$$,'staff can suspend one modality');
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.today()-21,pg_temp.today()-1)),0,'suspended student leaves the current BJJ competition');
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('Muay Thai'),pg_temp.today()-21,pg_temp.today()-1)),2,'MT participants remain unchanged');
select is((select count(*)::int from public.academy_ranking_facts(pg_temp.id('academy'),pg_temp.id('BJJ'),pg_temp.today()-21,pg_temp.today()-2)),1,'historical BJJ query still respects past active enrolment');
select lives_ok($$select public.set_student_modality_enrollment(pg_temp.id('m-multi'),pg_temp.id('BJJ'),'active')$$,'staff can resume enrolment without replacing history');
select lives_ok($$select public.set_student_modality_enrollment(pg_temp.id('m-multi'),pg_temp.id('BJJ'),'active')$$,'repeated activation is idempotent');
select pg_temp.admin();
select is((select count(*)::int from private.modality_active_periods ap join public.student_modality_enrollments e on e.id=ap.enrollment_id where e.membership_id=pg_temp.id('m-multi') and e.modality_id=pg_temp.id('BJJ') and ap.ends_at is null),1,'only one active interval after retries');
select is((select count(*)::int from jsonb_array_elements(pg_temp.facts('BJJ')->'hydration')d where d->>'eligible'='true'),4,'resuming today does not retroactively include suspended days');
select pg_temp.login(pg_temp.id('owner'));
select lives_ok($$select public.set_student_modality_enrollment(pg_temp.id('m-multi'),pg_temp.id('BJJ'),'ended')$$,'exit closes the modality membership');
select pg_temp.login(pg_temp.id('multi'));
select is((select array_agg(name) from public.ranking_modalities(pg_temp.id('academy'),pg_temp.today()-21,pg_temp.today()-1)),array['Muay Thai'],'exited modality disappears from current selector');
select pg_temp.login(pg_temp.id('owner'));
select throws_ok($$select public.set_student_class_enrollment(pg_temp.id('m-single'),pg_temp.id('s-BJJ'),true)$$,'22023','modality_enrollment_required','cannot assign required BJJ classes without a BJJ membership');
select * from finish();
rollback;
