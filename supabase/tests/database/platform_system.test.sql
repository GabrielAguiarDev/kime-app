-- Platform system (2026-11-16): plans catalog, subscriptions, invoices,
-- customer notes, support tickets and platform announcements.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config('search_path', concat_ws(',',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgtap'),
  'public', 'extensions'), true);
select no_plan();
create function pg_temp.login(u uuid) returns void language plpgsql as $$begin
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated','aal','aal1',
   'amr',json_build_array(json_build_object('method','password','timestamp',1)))::text,true);
end$$;
create function pg_temp.su() returns void language plpgsql as $$begin perform set_config('role','postgres',true);end$$;
create function pg_temp.u(n int) returns uuid language sql as $$select ('d1000000-0000-0000-0000-0000000000'||lpad(n::text,2,'0'))::uuid$$;
grant execute on function pg_temp.login(uuid),pg_temp.su(),pg_temp.u(int) to public;
create temp table ids(k text primary key,v uuid);grant all on ids to authenticated;
create function pg_temp.id(k text) returns uuid language sql as $$select v from ids where ids.k=$1$$;
grant execute on function pg_temp.id(text) to public;

-- 1 admin · 2 owner A · 3 student A · 4 owner B · 5 outsider (no academy)
insert into auth.users(id,email,raw_user_meta_data) values
(pg_temp.u(1),'admin@ps.test','{"full_name":"Admin"}'),
(pg_temp.u(2),'owner-a@ps.test','{"full_name":"Owner A"}'),
(pg_temp.u(3),'student@ps.test','{"full_name":"Student"}'),
(pg_temp.u(4),'owner-b@ps.test','{"full_name":"Owner B"}'),
(pg_temp.u(5),'out@ps.test','{"full_name":"Out"}');
insert into private.platform_admins(user_id) values (pg_temp.u(1));

-- ------------------------------------------------------------------ plans ---
select pg_temp.login(pg_temp.u(5));
select is((select array_agg(code order by code) from public.list_public_plans()),array['elite','pro','starter'],'seeded plans are public');
select throws_ok($$select count(*) from public.platform_plans$$,'42501',null,'plans table itself is not readable');
select pg_temp.su();
set local role anon;
select is((select array_agg(code order by code) from public.list_public_plans()),array['elite','pro','starter'],'anon reads plans on sale (landing)');
select throws_ok($$select count(*) from public.platform_plans$$,'42501',null,'anon cannot read the plans table');
select pg_temp.su();
select pg_temp.login(pg_temp.u(1));
select lives_ok($$select public.admin_save_plan(null,'basic','Básico',4900,10,20,array['A',' ',' B '],7,true,true,5)$$,'admin creates a plan');
select is((select count(*) from public.admin_list_plans() where is_popular),1::bigint,'only one popular plan');
select is((select benefits from public.admin_list_plans() where code='basic'),array['A','B'],'blank benefits dropped, trimmed');
select pg_temp.login(pg_temp.u(2));
select lives_ok($$select public.create_academy_with_setup('Academia A','basic','[{"name":"BJJ"}]'::jsonb)$$,'sign-up with a new active plan');
select pg_temp.su();
insert into ids select 'A',id from public.academies where name='Academia A';
update public.platform_plans set is_active=false where code='elite';
select pg_temp.login(pg_temp.u(4));
select throws_ok($$select public.create_academy_with_setup('Academia B','elite','[{"name":"BJJ"}]'::jsonb)$$,'22023','invalid_plan_tier','inactive plan refused in the sign-up');
select lives_ok($$select public.create_academy_with_setup('Academia B','pro','[{"name":"BJJ"}]'::jsonb)$$,'sign-up with pro');
select pg_temp.su();
insert into ids select 'B',id from public.academies where name='Academia B';
insert into public.memberships(user_id,academy_id,role,status) values (pg_temp.u(3),pg_temp.id('A'),'student','active');

-- ----------------------------------------------------------- subscriptions ---
select is((select status from private.academy_subscriptions where academy_id=pg_temp.id('A')),'trialing','new academy starts a trial');
select ok((select trial_ends_at::date from private.academy_subscriptions where academy_id=pg_temp.id('A')) = (now()+interval '7 days')::date,'trial length from the plan');
select pg_temp.login(pg_temp.u(1));
select lives_ok(format($$select public.admin_update_subscription(%L,'pro','annual',null,'active',null)$$,pg_temp.id('A')),'admin activates an annual subscription');
select is((select plan_code from public.admin_list_customers('academia a')),'pro','plan change goes to the academy');
select is((select mrr_cents from public.admin_list_customers('academia a')),round(17900*12*0.8/12)::integer,'MRR of an annual plan = discounted year / 12');
select lives_ok(format($$select public.admin_update_subscription(%L,'pro','monthly',15000,'active',null)$$,pg_temp.id('B')),'monthly with a negotiated price');
select is((select mrr_cents from public.admin_list_customers('academia b')),15000,'custom price wins');

-- ---------------------------------------------------------------- invoices ---
-- A: annual (pro, 20% off) · B: monthly, negotiated 150,00
select is(public.admin_generate_invoices('2026-11-15',10),2,'one invoice per paying academy');
select is(public.admin_generate_invoices('2026-11-01',10),0,'no duplicates for the month');
select is(public.admin_generate_invoices('2026-12-01',10),1,'annual plan not billed again next month (only B)');
select is((select amount_cents from public.admin_list_invoices() where academy_id=pg_temp.id('A')),round(17900*12*0.8)::integer,'annual invoice = discounted year');
select is((select due_date from public.admin_list_invoices() where academy_id=pg_temp.id('B') and reference_month='2026-12-01'),
  greatest(date '2026-12-10', (now() at time zone 'America/Sao_Paulo')::date),'due day applied, never before today');
select ok((select bool_and(due_date >= (now() at time zone 'America/Sao_Paulo')::date) from public.admin_list_invoices()),'generated invoices are not born overdue');
-- B switches to annual in January: billed once, even with monthly invoices in the window.
select lives_ok(format($$select public.admin_update_subscription(%L,'pro','annual',null,'active',null)$$,pg_temp.id('B')),'B becomes annual');
select is(public.admin_generate_invoices('2027-01-01',10),1,'monthly → annual: the annual invoice is issued');
select is(public.admin_generate_invoices('2027-02-01',10),0,'months covered by the annual invoices are skipped');
-- A switches to monthly: the months its annual invoice covers are not billed again.
select lives_ok(format($$select public.admin_update_subscription(%L,'pro','monthly',null,'active',null)$$,pg_temp.id('A')),'A becomes monthly');
select is((select count(*) from public.admin_list_invoices() where academy_id=pg_temp.id('A')),1::bigint,'annual → monthly: no double charge');
select is(public.admin_generate_invoices('2027-11-01',10),1,'A is billed monthly again after the 12 covered months (B still covered)');
-- A one-off invoice does not block the cycle.
select lives_ok(format($$select public.admin_create_invoice(%L,'2027-12-01',5000,'2027-12-20','Taxa de implantação')$$,pg_temp.id('A')),'one-off invoice');
select pg_temp.su();
select is((select kind from private.platform_invoices where description='Taxa de implantação'),'one_off','manual invoices are one-off');
select pg_temp.login(pg_temp.u(1));
insert into ids select 'inv',id from public.admin_list_invoices() where academy_id=pg_temp.id('B') and reference_month='2026-11-01';
select throws_ok(format($$select public.admin_set_invoice_status(%L,'paid')$$,pg_temp.id('inv')),'22023','invoice_payment_required','paid needs date and method');
select lives_ok(format($$select public.admin_set_invoice_status(%L,'paid','2026-11-12','pix')$$,pg_temp.id('inv')),'mark paid');
select throws_ok(format($$select public.admin_set_invoice_status(%L,'void')$$,pg_temp.id('inv')),'22023','invoice_status_invalid','a paid invoice cannot be voided');
select lives_ok(format($$select public.admin_set_invoice_status(%L,'open')$$,pg_temp.id('inv')),'undo payment');
select lives_ok(format($$select public.admin_set_invoice_status(%L,'void')$$,pg_temp.id('inv')),'void an open invoice');
select lives_ok($$select public.admin_update_subscription(id,'pro','monthly',15000,'active',null) from public.academies where name='Academia B'$$,'B back to monthly');
select pg_temp.su();
update private.platform_invoices set kind='monthly' where academy_id=pg_temp.id('B') and kind='annual';
update private.platform_invoices set due_date=(now() at time zone 'America/Sao_Paulo')::date-1 where academy_id=pg_temp.id('B') and reference_month='2026-12-01';
select pg_temp.login(pg_temp.u(1));
select is(public.admin_generate_invoices('2026-11-01',10),1,'a voided month can be billed again');
select ok((select count(*) from public.admin_list_invoices('overdue')) >= 1,'past due open invoices are overdue');
select ok((public.admin_dashboard()->>'overdue_cents')::int > 0,'dashboard sums overdue');
select ok(jsonb_array_length(public.admin_report(3)->'months') = 3,'report has one row per month');

-- ------------------------------------------------------------------- notes ---
select lives_ok(format($$select public.admin_add_customer_note(%L,'call','Ligou pedindo desconto')$$,pg_temp.id('A')),'admin adds a note');
select is(jsonb_array_length(public.admin_get_customer(pg_temp.id('A'))->'notes'),1,'note listed on the customer');

-- ----------------------------------------------------------------- support ---
select pg_temp.login(pg_temp.u(3));
select throws_ok(format($$select public.create_support_ticket('Ajuda','Oi',%L)$$,pg_temp.id('B')),'42501','forbidden','ticket only about an academy of the user');
select lives_ok(format($$select public.create_support_ticket('Não consigo fazer check-in','O botão não aparece',%L)$$,pg_temp.id('A')),'student opens a ticket');
select pg_temp.su();
insert into ids select 't',id from public.support_tickets where user_id=pg_temp.u(3);
select pg_temp.login(pg_temp.u(3));
select is((select count(*) from public.support_messages),1::bigint,'user reads their own messages');
select throws_ok($$insert into public.support_messages(ticket_id,body) values (gen_random_uuid(),'x')$$,'42501',null,'no direct writes');
select throws_ok($$select author_id from public.support_messages$$,'42501',null,'author_id is not readable by users');
select pg_temp.login(pg_temp.u(2));
select is((select count(*) from public.support_tickets),0::bigint,'others cannot read the ticket');
select throws_ok(format($$select public.reply_support_ticket(%L,'oi')$$,pg_temp.id('t')),'42501','forbidden','others cannot reply');
select pg_temp.login(pg_temp.u(1));
select is((select status from public.admin_list_tickets('open')),'open','admin sees the open ticket');
select lives_ok(format($$select public.admin_reply_ticket(%L,'Atualize o app, por favor.')$$,pg_temp.id('t')),'admin replies');
select pg_temp.login(pg_temp.u(3));
select is((select status from public.support_tickets),'answered','status answered after Kimi replies');
select is((select count(*) from public.support_messages where is_staff),1::bigint,'reply marked as staff');
select lives_ok(format($$select public.reply_support_ticket(%L,'Funcionou, obrigado')$$,pg_temp.id('t')),'user replies');
select is((select status from public.support_tickets),'open','back to open');
select lives_ok(format($$select public.close_support_ticket(%L)$$,pg_temp.id('t')),'user closes');
select is((select status from public.support_tickets),'closed','closed');
select lives_ok($$select public.create_support_ticket('Pedido um','x'),public.create_support_ticket('Pedido dois','x'),public.create_support_ticket('Pedido três','x'),
  public.create_support_ticket('Pedido quatro','x'),public.create_support_ticket('Pedido cinco','x')$$,'five open tickets');
select throws_ok($$select public.create_support_ticket('Pedido seis','x')$$,'22023','too_many_open_tickets','sixth open ticket refused');

-- ----------------------------------------------------------- announcements ---
select pg_temp.login(pg_temp.u(1));
select lives_ok($$select public.admin_save_platform_announcement(null,'Manutenção','Domingo às 2h','owners',null)$$,'admin publishes for owners');
select lives_ok($$select public.admin_save_platform_announcement(null,'Novidade','Ranking novo','everyone',null)$$,'admin publishes for everyone');
select lives_ok($$select public.admin_save_platform_announcement(null,'Antigo','Já passou','everyone','2020-01-01')$$,'expired announcement');
select pg_temp.login(pg_temp.u(2));
select is((select array_agg(title order by title) from public.platform_announcements_feed()),array['Manutenção','Novidade'],'owner sees owners + everyone, not expired');
select pg_temp.login(pg_temp.u(3));
select is((select array_agg(title) from public.platform_announcements_feed()),array['Novidade'],'student sees only everyone');
select lives_ok($$select public.dismiss_platform_announcement((select id from public.platform_announcements_feed() limit 1))$$,'student dismisses');
select is((select count(*) from public.platform_announcements_feed()),0::bigint,'dismissed announcement hidden for this account');
select pg_temp.login(pg_temp.u(5));
select is((select count(*) from public.platform_announcements_feed()),0::bigint,'no academy, no announcements');

-- -------------------------------------------------------------------- audit ---
select pg_temp.su();
select ok((select count(*) from private.admin_audit_log where admin_id=pg_temp.u(1) and action in
  ('create_plan','update_subscription','generate_invoices','set_invoice_status','reply_ticket','create_announcement'))>=6,'admin writes are audited');

select * from finish();
rollback;
