-- Academy finance (2026-11-10): owner only. Professor and other academies read
-- nothing; a student sees only their own overdue months (no amounts) through
-- my_finance_status. Monthly job is idempotent; the 7-days-late block is
-- computed (option on + more than 7 days) and lifts as soon as the owner marks
-- the charge paid. Recurring expenses and the month report.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.login(u uuid) returns void language plpgsql as $$begin
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
end$$;
create function pg_temp.admin() returns void language plpgsql as $$begin perform set_config('role','postgres',true);end$$;
grant execute on function pg_temp.login(uuid),pg_temp.admin() to public;

-- 1 owner · 2 professor · 3 Ana (plan) · 4 Bia (exempt) · 5 Caio (no amount) · 6 Davi (pending)
-- 7 Edu (leaves) · 8 Fabi (custom amount, due day 20) · 9 Gil (no billing row) · 10 owner of another academy
insert into auth.users(id,email,raw_user_meta_data) values
('f1000000-0000-0000-0000-000000000001','owner@fin.test','{"full_name":"Owner"}'),
('f1000000-0000-0000-0000-000000000002','prof@fin.test','{"full_name":"Prof"}'),
('f1000000-0000-0000-0000-000000000003','ana@fin.test','{"full_name":"Ana"}'),
('f1000000-0000-0000-0000-000000000004','bia@fin.test','{"full_name":"Bia"}'),
('f1000000-0000-0000-0000-000000000005','caio@fin.test','{"full_name":"Caio"}'),
('f1000000-0000-0000-0000-000000000006','davi@fin.test','{"full_name":"Davi"}'),
('f1000000-0000-0000-0000-000000000007','edu@fin.test','{"full_name":"Edu"}'),
('f1000000-0000-0000-0000-000000000008','fabi@fin.test','{"full_name":"Fabi"}'),
('f1000000-0000-0000-0000-000000000009','gil@fin.test','{"full_name":"Gil"}'),
('f1000000-0000-0000-0000-000000000010','other@fin.test','{"full_name":"Other"}');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;
insert into ids values('academy',public.create_academy('Team',array['BJJ']));
select pg_temp.login('f1000000-0000-0000-0000-000000000010');
insert into ids values('other',public.create_academy('Outra',array['BJJ']));
select pg_temp.admin();
insert into ids select 'BJJ',id from public.academy_modalities where academy_id=pg_temp.id('academy');
create function pg_temp.today() returns date language sql as $$select private.academy_local_date(pg_temp.id('academy'))$$;
create function pg_temp.mem(n int) returns uuid language sql as $$
 select id from public.memberships where academy_id=pg_temp.id('academy') and user_id=('f1000000-0000-0000-0000-0000000000'||lpad(n::text,2,'0'))::uuid$$;
grant execute on function pg_temp.today(),pg_temp.mem(int) to public;
insert into public.memberships(user_id,academy_id,role,status) values
('f1000000-0000-0000-0000-000000000002',pg_temp.id('academy'),'instructor','active'),
('f1000000-0000-0000-0000-000000000003',pg_temp.id('academy'),'student','active'),
('f1000000-0000-0000-0000-000000000004',pg_temp.id('academy'),'student','active'),
('f1000000-0000-0000-0000-000000000005',pg_temp.id('academy'),'student','active'),
('f1000000-0000-0000-0000-000000000006',pg_temp.id('academy'),'student','pending'),
('f1000000-0000-0000-0000-000000000007',pg_temp.id('academy'),'student','active'),
('f1000000-0000-0000-0000-000000000008',pg_temp.id('academy'),'student','active'),
('f1000000-0000-0000-0000-000000000009',pg_temp.id('academy'),'student','active');
insert into public.student_modality_enrollments(membership_id,modality_id,status)
select m.id,pg_temp.id('BJJ'),'active' from public.memberships m
where m.academy_id=pg_temp.id('academy') and m.role='student' and m.status='active';
insert into public.class_schedules(academy_id,weekday,start_time,modality_id) values(pg_temp.id('academy'),1,'19:00',pg_temp.id('BJJ'));
insert into public.academy_events(academy_id,title,event_date,start_time,all_modalities)
values(pg_temp.id('academy'),'Festa',pg_temp.today()+5,'20:00',true);
insert into public.championships(academy_id,name,event_date,modality_id)
values(pg_temp.id('academy'),'Copa',pg_temp.today()+20,pg_temp.id('BJJ'));
insert into public.checkins(user_id,academy_id,class_date,status,modality_id)
values('f1000000-0000-0000-0000-000000000003',pg_temp.id('academy'),pg_temp.today()-1,'confirmed',pg_temp.id('BJJ'));
insert into public.water_logs(id,user_id,amount_ml,logged_at)
values(gen_random_uuid(),'f1000000-0000-0000-0000-000000000003',250,now());

-- ------------------------------------------------------------ owner setup ---
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
insert into public.academy_finance_settings(academy_id,enabled,default_due_day,block_overdue) values(pg_temp.id('academy'),true,10,false);
select is((select count(*)::int from public.academy_finance_settings),1,'owner creates and reads the settings');
select throws_ok(format($q$update public.academy_finance_settings set default_due_day=29 where academy_id=%L$q$,pg_temp.id('academy')),'23514',null,'due day above 28 is rejected');
insert into public.finance_plans(academy_id,name,amount_cents) values(pg_temp.id('academy'),'Mensal',15000);
insert into ids select 'plan',id from public.finance_plans;
select throws_ok(format($q$insert into public.finance_plans(academy_id,name,amount_cents) values(%L,'Zero',0)$q$,pg_temp.id('academy')),'23514',null,'plan amount must be positive');
insert into public.finance_student_billing(membership_id,academy_id,plan_id) values
(pg_temp.mem(3),pg_temp.id('academy'),pg_temp.id('plan')),
(pg_temp.mem(7),pg_temp.id('academy'),pg_temp.id('plan')),
(pg_temp.mem(6),pg_temp.id('academy'),pg_temp.id('plan'));
insert into public.finance_student_billing(membership_id,academy_id,plan_id,is_exempt) values(pg_temp.mem(4),pg_temp.id('academy'),pg_temp.id('plan'),true);
insert into public.finance_student_billing(membership_id,academy_id) values(pg_temp.mem(5),pg_temp.id('academy'));
insert into public.finance_student_billing(membership_id,academy_id,custom_amount_cents,due_day) values(pg_temp.mem(8),pg_temp.id('academy'),20000,20);
select is((select count(*)::int from public.finance_student_billing),6,'owner creates billing rows');
select throws_ok(format($q$update public.finance_student_billing set custom_amount_cents=9000 where membership_id=%L$q$,pg_temp.mem(3)),'23514',null,'plan and custom amount are mutually exclusive');
select throws_ok(format($q$insert into public.finance_student_billing(membership_id,academy_id,custom_amount_cents) values(%L,%L,100)$q$,
  (select id from public.memberships where user_id='f1000000-0000-0000-0000-000000000002'),pg_temp.id('academy')),'P0001','not_a_student','only students have a monthly fee');

-- ---------------------------------------------------- monthly generation ---
select pg_temp.admin();
select private.generate_finance_month(pg_temp.today());
select private.generate_finance_month(pg_temp.today());
select is((select count(*)::int from public.finance_charges where academy_id=pg_temp.id('academy')),3,'running the job twice creates one charge per eligible student');
select is((select count(*)::int from public.finance_charges where academy_id=pg_temp.id('academy') and user_id in
  ('f1000000-0000-0000-0000-000000000004','f1000000-0000-0000-0000-000000000005','f1000000-0000-0000-0000-000000000006','f1000000-0000-0000-0000-000000000009')),0,
  'no charge for exempt, no-amount, pending or no-billing students');
select is((select due_date from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),(date_trunc('month',pg_temp.today())::date+9),'due date uses the academy default day');
select is((select due_date from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000008'),(date_trunc('month',pg_temp.today())::date+19),'due date uses the student due day');
select is((select amount_cents from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000008'),20000,'custom amount is charged');
select is((select amount_cents from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),15000,'plan amount is charged');
select is((select student_name from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),'Ana','student name snapshot');
delete from public.memberships where id=pg_temp.mem(7);
select is((select count(*)::int from public.finance_student_billing where membership_id=pg_temp.mem(7)),0,'billing goes away with the membership');
select private.generate_finance_month((date_trunc('month',pg_temp.today())+interval '1 month')::date);
select is((select count(*)::int from public.finance_charges where reference_month=(date_trunc('month',pg_temp.today())+interval '1 month')::date and academy_id=pg_temp.id('academy')),2,'next month: only students still enrolled');
select is((select count(*)::int from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000007'),1,'a student who left keeps the history and gets no new charge');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.academy_finance_settings set enabled=false where academy_id=pg_temp.id('academy');
select pg_temp.admin();
select private.generate_finance_month((date_trunc('month',pg_temp.today())+interval '2 month')::date);
select is((select count(*)::int from public.finance_charges where academy_id=pg_temp.id('academy')),5,'finance disabled: nothing generated');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.academy_finance_settings set enabled=true where academy_id=pg_temp.id('academy');

-- ------------------------------------------------------------- privacy ---
insert into public.finance_expenses(academy_id,description,category,amount_cents,expense_date) values(pg_temp.id('academy'),'Aluguel',  'rent',100000,pg_temp.today());
select is((select created_by from public.finance_expenses),'f1000000-0000-0000-0000-000000000001'::uuid,'expense creator stamped');
select is((select count(*)::int from public.finance_charges),5,'owner reads the charges');

select pg_temp.login('f1000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.finance_charges),0,'professor reads no charges');
select is((select count(*)::int from public.finance_expenses),0,'professor reads no expenses');
select is((select count(*)::int from public.finance_plans),0,'professor reads no plans');
select is((select count(*)::int from public.finance_student_billing),0,'professor reads no billing');
select is((select count(*)::int from public.academy_finance_settings),0,'professor reads no settings');
select throws_ok(format($q$insert into public.finance_plans(academy_id,name,amount_cents) values(%L,'X',100)$q$,pg_temp.id('academy')),'42501',null,'professor cannot create a plan');
select throws_ok(format($q$insert into public.finance_expenses(academy_id,description,category,amount_cents,expense_date) values(%L,'X','other',100,current_date)$q$,pg_temp.id('academy')),'42501',null,'professor cannot create an expense');
select throws_ok(format($q$insert into public.finance_student_billing(membership_id,academy_id,is_exempt) values(%L,%L,true)$q$,pg_temp.mem(9),pg_temp.id('academy')),'42501',null,'professor cannot create billing');
select throws_ok(format($q$insert into public.academy_finance_settings(academy_id) values(%L)$q$,pg_temp.id('academy')),'42501',null,'professor cannot create settings');
select throws_ok(format($q$insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents) values(%L,'f1000000-0000-0000-0000-000000000009','Gil','2030-01-01','2030-01-10',100)$q$,pg_temp.id('academy')),'42501',null,'professor cannot create a charge');
update public.finance_charges set paid_on=current_date,payment_method='pix';
update public.finance_plans set name='Hack';
update public.finance_expenses set amount_cents=1;
update public.academy_finance_settings set enabled=false,block_overdue=true;
update public.finance_student_billing set is_exempt=true;
delete from public.finance_expenses;
select throws_ok(format('select * from public.finance_open_charges(%L)',pg_temp.id('academy')),'42501','forbidden','professor: open charges forbidden');
select throws_ok(format('select public.finance_report(%L,current_date)',pg_temp.id('academy')),'42501','forbidden','professor: report forbidden');
select is((select count(*)::int from public.my_finance_status(pg_temp.id('academy'))),0,'professor has no student status');
select pg_temp.admin();
select is((select count(*)::int from public.finance_charges where paid_on is not null),0,'professor update did not touch charges');
select is((select name from public.finance_plans),'Mensal','professor update did not touch plans');
select is((select amount_cents from public.finance_expenses),100000,'professor update/delete did not touch expenses');
select ok((select enabled and not block_overdue from public.academy_finance_settings where academy_id=pg_temp.id('academy')),'professor update did not touch settings');
select is((select count(*)::int from public.finance_student_billing where is_exempt),1,'professor update did not touch billing');

-- Ana: a student reads nothing directly and only her own overdue months.
update public.finance_charges set due_date=pg_temp.today()-40,reference_month=(date_trunc('month',pg_temp.today())-interval '2 month')::date where user_id='f1000000-0000-0000-0000-000000000003' and reference_month=date_trunc('month',pg_temp.today())::date;
insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents) values
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000003','Ana',(date_trunc('month',pg_temp.today())-interval '1 month')::date,pg_temp.today()-5,15000),
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000008','Fabi',(date_trunc('month',pg_temp.today())-interval '1 month')::date,pg_temp.today()-5,20000);
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.finance_charges),0,'student reads no charges, not even their own');
select is((select count(*)::int from public.finance_expenses)+(select count(*)::int from public.finance_plans)+(select count(*)::int from public.finance_student_billing)+(select count(*)::int from public.academy_finance_settings),0,'student reads no other finance table');
select is((select cardinality(overdue_months) from public.my_finance_status(pg_temp.id('academy'))),2,'my_finance_status: only the caller''s overdue months');
select is((select overdue_months from public.my_finance_status(pg_temp.id('academy'))),
  array[(date_trunc('month',pg_temp.today())-interval '2 month')::date,(date_trunc('month',pg_temp.today())-interval '1 month')::date],'overdue months are sorted dates');
select is((select blocked from public.my_finance_status(pg_temp.id('academy'))),false,'not blocked while the option is off');
update public.finance_charges set paid_on=current_date,payment_method='pix';
select throws_ok(format('select * from public.finance_open_charges(%L)',pg_temp.id('academy')),'42501','forbidden','student: open charges forbidden');
select throws_ok(format('select public.finance_report(%L,current_date)',pg_temp.id('academy')),'42501','forbidden','student: report forbidden');
select pg_temp.admin();
select is((select count(*)::int from public.finance_charges where paid_on is not null),0,'student cannot mark a charge paid');
select pg_temp.login('f1000000-0000-0000-0000-000000000010');
select is((select count(*)::int from public.finance_charges)+(select count(*)::int from public.finance_expenses)+(select count(*)::int from public.finance_plans),0,'owner of another academy reads nothing');
select throws_ok(format('select public.finance_report(%L,current_date)',pg_temp.id('academy')),'42501','forbidden','other owner: report forbidden');
select throws_ok(format('select * from public.finance_open_charges(%L)',pg_temp.id('academy')),'42501','forbidden','other owner: open charges forbidden');
select is((select count(*)::int from public.my_finance_status(pg_temp.id('academy'))),0,'other owner has no status of this academy');
select pg_temp.login('f1000000-0000-0000-0000-000000000009');
select is((select count(*)::int from public.my_finance_status(pg_temp.id('academy'))),1,'student with no charge: status row with no overdue months');
select is((select cardinality(overdue_months) from public.my_finance_status(pg_temp.id('academy'))),0,'no overdue months');

-- -------------------------------------------------- recurring expenses ---
select pg_temp.admin();
delete from public.finance_expenses;
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
insert into public.finance_expenses(academy_id,description,category,amount_cents,expense_date,repeats_monthly) values
(pg_temp.id('academy'),'Aluguel','rent',80000,'2027-01-31',true),
(pg_temp.id('academy'),'Professor','salaries',50000,'2027-01-10',true),
(pg_temp.id('academy'),'Tatame','equipment',30000,'2027-01-15',false);
select pg_temp.admin();
select private.generate_finance_month('2027-02-10');
select private.generate_finance_month('2027-02-20');
select is((select count(*)::int from public.finance_expenses where expense_date>='2027-02-01' and expense_date<'2027-03-01'),2,'repeating expenses copied once, not twice');
select is((select expense_date from public.finance_expenses where description='Aluguel' and expense_date>='2027-02-01' and expense_date<'2027-03-01'),'2027-02-28'::date,'day 31 clamps to the last day of the month');
select is((select expense_date from public.finance_expenses where description='Professor' and expense_date>='2027-02-01' and expense_date<'2027-03-01'),'2027-02-10'::date,'same day of month otherwise');
select is((select count(*)::int from public.finance_expenses where description='Tatame'),1,'non-repeating expense is not copied');
select is((select count(distinct series_id)::int from public.finance_expenses where description='Aluguel'),1,'copy keeps the series');
select is((select repeats_monthly from public.finance_expenses where description='Aluguel' and expense_date='2027-02-28'),true,'copy keeps repeating');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.finance_expenses set repeats_monthly=false where description='Professor' and expense_date='2027-02-10';
select pg_temp.admin();
select private.generate_finance_month('2027-03-05');
select is((select count(*)::int from public.finance_expenses where expense_date>='2027-03-01' and expense_date<'2027-04-01'),1,'series whose latest entry stopped repeating is not copied');
select is((select description from public.finance_expenses where expense_date>='2027-03-01' and expense_date<'2027-04-01'),'Aluguel','the repeating series continues');
select is((select expense_date from public.finance_expenses where description='Aluguel' and expense_date>='2027-03-01' and expense_date<'2027-04-01'),'2027-03-31'::date,'after February the series goes back to day 31');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.academy_finance_settings set enabled=false where academy_id=pg_temp.id('academy');
select pg_temp.admin();
select private.generate_finance_month('2027-04-05');
select is((select count(*)::int from public.finance_expenses where expense_date>='2027-04-01' and expense_date<'2027-05-01'),0,'finance disabled: expenses not copied');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.academy_finance_settings set enabled=true where academy_id=pg_temp.id('academy');

-- ------------------------------------------------------------------ block ---
select pg_temp.admin();
delete from public.finance_charges;
delete from public.finance_expenses;
insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents) values
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000003','Ana',(date_trunc('month',pg_temp.today())-interval '1 month')::date,pg_temp.today()-8,15000);
-- the owner has an old unpaid charge too: staff is never blocked
insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents) values
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000002','Prof',(date_trunc('month',pg_temp.today())-interval '1 month')::date,pg_temp.today()-30,100);
update public.academy_finance_settings set block_overdue=false where academy_id=pg_temp.id('academy');

select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is(private.is_finance_blocked(pg_temp.id('academy')),false,'8 days late with the option off: not blocked');
select is((select count(*)::int from public.class_schedules),1,'option off: student sees the schedule');
select is((select blocked from public.my_finance_status(pg_temp.id('academy'))),false,'option off: status not blocked');

select pg_temp.admin();
update public.academy_finance_settings set block_overdue=true where academy_id=pg_temp.id('academy');
update public.finance_charges set due_date=pg_temp.today()-7 where user_id='f1000000-0000-0000-0000-000000000003';
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is(private.is_finance_blocked(pg_temp.id('academy')),false,'exactly 7 days late: not blocked');
select is((select count(*)::int from public.class_schedules),1,'7 days late: still sees the schedule');

select is((select count(*)::int from public.academy_events)+(select count(*)::int from public.championships)+(select count(*)::int from public.checkins),3,'7 days late: still sees events, championships, check-ins');
select pg_temp.admin();
update public.finance_charges set due_date=pg_temp.today()-8 where user_id='f1000000-0000-0000-0000-000000000003';
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is(private.is_finance_blocked(pg_temp.id('academy')),true,'8 days late with the option on: blocked');
select is((select blocked from public.my_finance_status(pg_temp.id('academy'))),true,'status reports blocked');
select is((select count(*)::int from public.class_schedules),0,'blocked: no schedules');
select is((select count(*)::int from public.academy_events),0,'blocked: no events');
select is((select count(*)::int from public.championships),0,'blocked: no championships');
select is((select count(*)::int from public.checkins),0,'blocked: no own check-ins');
select throws_ok(format('select * from public.ranking_modalities(%L,current_date-10,current_date-1)',pg_temp.id('academy')),'42501','finance_blocked','blocked: ranking raises finance_blocked');
select is((select count(*)::int from public.academies),1,'blocked: still reads the academy');
select is((select count(*)::int from public.academy_modalities),1,'blocked: still reads modalities');
select is((select count(*)::int from public.water_logs),1,'blocked: still reads own water');
select is((select count(*)::int from public.profiles where id='f1000000-0000-0000-0000-000000000003'),1,'blocked: still reads own profile');

select pg_temp.login('f1000000-0000-0000-0000-000000000002');
select is(private.is_finance_blocked(pg_temp.id('academy')),false,'professor with an old charge is never blocked');
select is((select count(*)::int from public.class_schedules),1,'professor still sees schedules');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
select is(private.is_finance_blocked(pg_temp.id('academy')),false,'owner is never blocked');
select is((select count(*)::int from public.checkins),1,'staff still sees the student''s check-ins');
select pg_temp.login('f1000000-0000-0000-0000-000000000004');
select is(private.is_finance_blocked(pg_temp.id('academy')),false,'another student without a charge is not blocked');

-- Finance off: nobody is blocked.
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.academy_finance_settings set enabled=false where academy_id=pg_temp.id('academy');
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is(private.is_finance_blocked(pg_temp.id('academy')),false,'finance disabled: not blocked');
select is((select count(*)::int from public.class_schedules),1,'finance disabled: schedules back');
select is((select count(*)::int from public.my_finance_status(pg_temp.id('academy'))),0,'finance disabled: no status');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.academy_finance_settings set enabled=true where academy_id=pg_temp.id('academy');

-- ---------------------------------------------------------- mark as paid ---
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.class_schedules),0,'blocked again before payment');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
select throws_ok(format($q$update public.finance_charges set paid_on=%L where user_id='f1000000-0000-0000-0000-000000000003'$q$,pg_temp.today()+1),'P0001','payment_in_future','payment date cannot be in the future');
select throws_ok($q$update public.finance_charges set amount_cents=1 where user_id='f1000000-0000-0000-0000-000000000003'$q$,'42501',null,'owner cannot change the amount');
select throws_ok(format($q$insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents) values(%L,'f1000000-0000-0000-0000-000000000009','Gil','2030-01-01','2030-01-10',100)$q$,pg_temp.id('academy')),'42501',null,'owner cannot insert charges');
select throws_ok($q$delete from public.finance_charges$q$,'42501',null,'owner cannot delete charges');
update public.finance_charges set paid_on=pg_temp.today(),payment_method='pix' where user_id='f1000000-0000-0000-0000-000000000003';
select is((select paid_amount_cents from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),15000,'paid amount defaults to the charge amount');
select is((select paid_marked_by from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),'f1000000-0000-0000-0000-000000000001'::uuid,'paid_marked_by stamped');
select ok((select paid_marked_at is not null from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),'paid_marked_at stamped');
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.class_schedules),1,'paying unblocks immediately: schedules');
select is((select count(*)::int from public.academy_events),1,'paying unblocks immediately: events');
select is((select blocked from public.my_finance_status(pg_temp.id('academy'))),false,'paying unblocks immediately: status');
select is((select cardinality(overdue_months) from public.my_finance_status(pg_temp.id('academy'))),0,'paid month is no longer overdue');

select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.finance_charges set paid_on=null where user_id='f1000000-0000-0000-0000-000000000003';
select is((select payment_method is null and paid_amount_cents is null and paid_marked_by is null and paid_marked_at is null from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),true,'undo clears method, amount and stamps');
select pg_temp.login('f1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.class_schedules),0,'undo blocks again');
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
update public.finance_charges set paid_on=pg_temp.today(),paid_amount_cents=12000 where user_id='f1000000-0000-0000-0000-000000000003';
select is((select paid_amount_cents from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000003'),12000,'partial amount received is kept');
select pg_temp.admin();
delete from public.finance_charges where user_id='f1000000-0000-0000-0000-000000000002';

-- ----------------------------------------------------------------- report ---
delete from public.finance_charges;
delete from public.finance_expenses;
create temp table rm as select (date_trunc('month',pg_temp.today())-interval '1 month')::date as r,(date_trunc('month',pg_temp.today())-interval '2 month')::date as r1;
grant select on rm to authenticated;
insert into public.finance_charges(academy_id,user_id,student_name,reference_month,due_date,amount_cents,paid_on,paid_amount_cents) values
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000003','Ana',(select r from rm),pg_temp.today()-5,10000,null,null),
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000008','Fabi',(select r from rm),pg_temp.today()-3,20000,pg_temp.today()-1,20000),
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000005','Caio',(select r from rm),pg_temp.today()+1,5000,null,null),
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000003','Ana',(select r1 from rm),pg_temp.today()-40,10000,null,null),
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000008','Fabi',(select r1 from rm),pg_temp.today()-40,20000,null,null),
(pg_temp.id('academy'),'f1000000-0000-0000-0000-000000000005','Caio',(date_trunc('month',pg_temp.today())+interval '1 month')::date,pg_temp.today()+30,5000,null,null);
insert into public.finance_expenses(academy_id,description,category,amount_cents,expense_date) values
(pg_temp.id('academy'),'Aluguel','rent',100000,(select r from rm)+3),
(pg_temp.id('academy'),'Agua','water',30000,(select r from rm)+8),
(pg_temp.id('academy'),'Outro mes','water',999,(select r1 from rm)+8);
select pg_temp.login('f1000000-0000-0000-0000-000000000001');
create temp table rep as select public.finance_report(pg_temp.id('academy'),(select r from rm)+14) as j;
grant select on rep to authenticated;
select is((select (j->>'received')::int from rep),20000,'report: received');
select is((select (j->>'receivable')::int from rep),5000,'report: receivable (not due yet)');
select is((select (j->>'overdue')::int from rep),10000,'report: overdue');
select is((select (j->>'expenses')::int from rep),130000,'report: expenses of the month only');
select is((select (j->>'charges_count')::int from rep),3,'report: charges count');
select is((select (j->>'overdue_count')::int from rep),1,'report: overdue count');
select is((select jsonb_array_length(j->'history') from rep),6,'report: six months of history');
select is((select (j->'history'->5->>'received')::int from rep),20000,'report: history last month received');
select is((select (j->'history'->5->>'expenses')::int from rep),130000,'report: history last month expenses');
select is((select j->'categories'->0->>'category' from rep),'rent','report: categories ordered by amount');
select is((select jsonb_array_length(j->'late_students') from rep),1,'report: only students with more than one overdue month');
select is((select j->'late_students'->0->>'full_name' from rep),'Ana','report: late student is Ana');
select is((select (j->'late_students'->0->>'months')::int from rep),2,'report: Ana has 2 overdue months');
select is((select (j->'late_students'->0->>'amount')::int from rep),20000,'report: Ana overdue amount');

select is((select count(*)::int from public.finance_open_charges(pg_temp.id('academy'))),4,'open charges: unpaid up to the current month (future month excluded)');
select is((select count(*)::int from public.finance_open_charges(pg_temp.id('academy')) where overdue),3,'open charges: overdue flag');
select is((select due_date from public.finance_open_charges(pg_temp.id('academy')) limit 1),pg_temp.today()-40,'open charges: most overdue first');

select * from finish();
rollback;
