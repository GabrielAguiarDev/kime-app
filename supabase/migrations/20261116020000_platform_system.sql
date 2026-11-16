-- =============================================================================
-- Kimi — Platform system (admin web, 2026-11-16, user's request)
--
--   public.platform_plans              plan catalog (admin edits; app reads the
--                                      active ones in the academy sign-up)
--   private.academy_subscriptions      one per academy; manual today, ready for
--                                      a gateway (provider + external ids)
--   private.platform_invoices          what each academy owes Kimi
--   private.customer_notes             internal CRM notes per academy
--   public.support_tickets / _messages "Ajuda e suporte" (app) ↔ admin
--   public.platform_announcements      Kimi → owners / staff / everyone (app)
--
-- Admin access keeps the rules of 20261116000000/010000: every admin_* RPC is
-- SECURITY DEFINER and starts with private.require_platform_admin(); every
-- write is audited. Money is always integer cents (BRL).
-- =============================================================================

-- Kimi's calendar (due dates, "this month", reports) runs in São Paulo time.
create function private.today_sp()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function private.today_sp() from public, anon, authenticated;

create function private.month_sp(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', p_at at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function private.month_sp(timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Plans
-- -----------------------------------------------------------------------------
create table public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,29}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  monthly_price_cents integer not null check (monthly_price_cents between 0 and 10000000),
  annual_discount_pct smallint not null default 0 check (annual_discount_pct between 0 and 90),
  student_limit integer check (student_limit > 0),
  benefits text[] not null default '{}' check (cardinality(benefits) <= 12),
  trial_days smallint not null default 0 check (trial_days between 0 and 90),
  is_popular boolean not null default false,
  is_active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index platform_plans_one_popular_idx on public.platform_plans (is_popular) where is_popular;
create trigger platform_plans_set_updated_at before update on public.platform_plans
  for each row execute function private.set_updated_at();
alter table public.platform_plans enable row level security;
revoke all on public.platform_plans from anon, authenticated;

-- The plans that were hardcoded in the app (src/domain/Gym/plans.ts).
insert into public.platform_plans
  (code, name, monthly_price_cents, annual_discount_pct, student_limit, benefits, trial_days, is_popular, position)
values
  ('starter', 'Essencial', 9900, 20, 50,
    array['Presença por check-in', 'Horários e modalidades', 'Timer de rounds'], 14, false, 0),
  ('pro', 'Profissional', 17900, 20, 150,
    array['Tudo do Essencial', 'Faixas e graduações', 'Ranking e disciplina', 'Professores ilimitados'], 14, true, 1),
  ('elite', 'Elite', 29900, 20, null,
    array['Tudo do Profissional', 'Alunos ilimitados', 'Área do competidor', 'Suporte prioritário'], 14, false, 2);

-- academies.plan_tier now points at the catalog (codes never change).
alter table public.academies drop constraint academies_plan_tier_check;
alter table public.academies
  add constraint academies_plan_tier_fkey foreign key (plan_tier) references public.platform_plans (code);
create index academies_plan_tier_idx on public.academies (plan_tier);

-- Price of one billing cycle: the monthly price, or 12 months with the annual
-- discount.
create function private.plan_cycle_cents(p_monthly integer, p_discount smallint, p_period text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_period = 'annual' then round(p_monthly * 12 * (100 - p_discount) / 100.0)::integer
    else p_monthly end;
$$;
revoke all on function private.plan_cycle_cents(integer, smallint, text) from public, anon, authenticated;

-- Active plans for the academy sign-up.
create function public.list_public_plans()
returns table (
  code text, name text, monthly_price_cents integer, annual_discount_pct smallint, student_limit integer,
  benefits text[], trial_days smallint, is_popular boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.code, p.name, p.monthly_price_cents, p.annual_discount_pct, p.student_limit,
    p.benefits, p.trial_days, p.is_popular
  from public.platform_plans p
  where p.is_active
  order by p.position, p.monthly_price_cents;
$$;

-- -----------------------------------------------------------------------------
-- 2. Subscriptions (one per academy)
-- -----------------------------------------------------------------------------
create table private.academy_subscriptions (
  academy_id uuid primary key references public.academies (id) on delete cascade,
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'annual')),
  -- Negotiated price per cycle; null = the plan's price.
  custom_price_cents integer check (custom_price_cents between 0 and 1200000000),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  started_at timestamptz,
  canceled_at timestamptz,
  -- Gateway (Mercado Pago / Stripe) later; 'manual' = recorded in the admin.
  provider text not null default 'manual' check (provider in ('manual', 'mercado_pago', 'stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger academy_subscriptions_set_updated_at before update on private.academy_subscriptions
  for each row execute function private.set_updated_at();
revoke all on private.academy_subscriptions from public, anon, authenticated;

-- Every new academy starts a trial of its plan.
create function private.start_academy_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trial smallint;
begin
  select trial_days into v_trial from public.platform_plans where code = new.plan_tier;
  insert into private.academy_subscriptions (academy_id, status, trial_ends_at)
  values (new.id, 'trialing', new.created_at + make_interval(days => coalesce(v_trial, 0)))
  on conflict (academy_id) do nothing;
  return null;
end;
$$;
revoke all on function private.start_academy_subscription() from public, anon, authenticated;
create trigger academies_start_subscription after insert on public.academies
  for each row execute function private.start_academy_subscription();

-- Existing academies: a trial counted from their creation.
insert into private.academy_subscriptions (academy_id, status, trial_ends_at)
select a.id, 'trialing', a.created_at + make_interval(days => coalesce(p.trial_days, 0))
from public.academies a left join public.platform_plans p on p.code = a.plan_tier
on conflict (academy_id) do nothing;

-- Price of the academy's current cycle and its monthly equivalent (MRR).
create function private.subscription_cycle_cents(p_academy_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(s.custom_price_cents, private.plan_cycle_cents(p.monthly_price_cents, p.annual_discount_pct, s.billing_period))
  from private.academy_subscriptions s
  join public.academies a on a.id = s.academy_id
  left join public.platform_plans p on p.code = a.plan_tier
  where s.academy_id = p_academy_id;
$$;
revoke all on function private.subscription_cycle_cents(uuid) from public, anon, authenticated;

create function private.subscription_mrr_cents(p_academy_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.status in ('active', 'past_due') then
      case when s.billing_period = 'annual' then round(coalesce(private.subscription_cycle_cents(s.academy_id), 0) / 12.0)::integer
        else coalesce(private.subscription_cycle_cents(s.academy_id), 0) end
    else 0 end
  from private.academy_subscriptions s
  where s.academy_id = p_academy_id;
$$;
revoke all on function private.subscription_mrr_cents(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Invoices
-- -----------------------------------------------------------------------------
create table private.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  -- Kept (null) when the academy is deleted: the money history stays.
  academy_id uuid references public.academies (id) on delete set null,
  academy_name text not null,
  reference_month date not null check (reference_month = date_trunc('month', reference_month)::date),
  -- monthly / annual come from "Gerar faturas"; one_off = created by hand.
  -- Only annual invoices cover the 12 months from their reference month.
  kind text not null default 'one_off' check (kind in ('monthly', 'annual', 'one_off')),
  description text not null default '' check (char_length(description) <= 200),
  amount_cents integer not null check (amount_cents between 1 and 1200000000),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  paid_on date,
  payment_method text check (payment_method in ('pix', 'boleto', 'card', 'transfer', 'cash', 'other')),
  provider text not null default 'manual' check (provider in ('manual', 'mercado_pago', 'stripe')),
  provider_invoice_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_on is not null))
);
-- One live invoice per academy and month.
create unique index platform_invoices_academy_month_idx on private.platform_invoices (academy_id, reference_month)
  where status <> 'void';
create index platform_invoices_status_due_idx on private.platform_invoices (status, due_date);
create trigger platform_invoices_set_updated_at before update on private.platform_invoices
  for each row execute function private.set_updated_at();
revoke all on private.platform_invoices from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Customer notes (CRM)
-- -----------------------------------------------------------------------------
create table private.customer_notes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'call', 'whatsapp', 'email', 'meeting')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  author_id uuid not null,
  created_at timestamptz not null default now()
);
create index customer_notes_academy_idx on private.customer_notes (academy_id, created_at desc);
revoke all on private.customer_notes from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Support
-- -----------------------------------------------------------------------------
-- open = waiting for Kimi · answered = waiting for the user · closed
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);
create index support_tickets_status_idx on public.support_tickets (status, last_message_at desc);
create index support_tickets_academy_idx on public.support_tickets (academy_id);
create trigger support_tickets_set_updated_at before update on public.support_tickets
  for each row execute function private.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  -- Kimi replies show as "Suporte Kimi": the admin's id stays in private.
  author_id uuid references public.profiles (id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;
-- Users read their own tickets; every write goes through the RPCs below.
-- author_id stays out of the user's reach (Kimi replies are "Suporte Kimi").
grant select on public.support_tickets to authenticated;
grant select (id, ticket_id, is_staff, body, created_at) on public.support_messages to authenticated;
create policy support_tickets_select_own on public.support_tickets
  for select to authenticated using (user_id = (select auth.uid()));
create policy support_messages_select_own on public.support_messages
  for select to authenticated using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))
  );

-- User opens a ticket (optionally about one of their academies).
create function public.create_support_ticket(p_subject text, p_body text, p_academy_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_academy_id is not null and not exists (
    select 1 from public.memberships where academy_id = p_academy_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Spam guard: at most 5 tickets waiting for Kimi at a time.
  if (select count(*) from public.support_tickets where user_id = v_uid and status = 'open') >= 5 then
    raise exception 'too_many_open_tickets' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_subject, ''))) not between 3 and 120 then
    raise exception 'invalid_subject' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  insert into public.support_tickets (user_id, academy_id, subject)
  values (v_uid, p_academy_id, btrim(p_subject))
  returning id into v_id;
  insert into public.support_messages (ticket_id, author_id, is_staff, body)
  values (v_id, v_uid, false, btrim(p_body));
  return v_id;
end;
$$;

-- User replies to their own ticket (re-opens a closed one).
create function public.reply_support_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform 1 from public.support_tickets where id = p_ticket_id and user_id = v_uid for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  -- Flood guard: at most 20 user messages per ticket per hour.
  if (select count(*) from public.support_messages
      where ticket_id = p_ticket_id and not is_staff and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;
  insert into public.support_messages (ticket_id, author_id, is_staff, body)
  values (p_ticket_id, v_uid, false, btrim(p_body));
  update public.support_tickets
  set status = 'open', closed_at = null, last_message_at = now()
  where id = p_ticket_id;
end;
$$;

-- User closes their own ticket.
create function public.close_support_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_tickets set status = 'closed', closed_at = now()
  where id = p_ticket_id and user_id = (select auth.uid()) and status <> 'closed';
  if not found and not exists (
    select 1 from public.support_tickets where id = p_ticket_id and user_id = (select auth.uid())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Platform announcements
-- -----------------------------------------------------------------------------
create table public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- owners · staff (owners + professors) · everyone (any member)
  audience text not null check (audience in ('owners', 'staff', 'everyone')),
  ends_on date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger platform_announcements_set_updated_at before update on public.platform_announcements
  for each row execute function private.set_updated_at();
alter table public.platform_announcements enable row level security;
revoke all on public.platform_announcements from anon, authenticated;

create table public.platform_announcement_dismissals (
  announcement_id uuid not null references public.platform_announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
create index platform_announcement_dismissals_announcement_idx on public.platform_announcement_dismissals (announcement_id);
alter table public.platform_announcement_dismissals enable row level security;
revoke all on public.platform_announcement_dismissals from anon, authenticated;

-- Announcements for the caller (by their active roles), not dismissed, not
-- past their last day (UTC date: an announcement ends at the end of that day).
create function public.platform_announcements_feed()
returns table (id uuid, title text, body text, audience text, ends_on date, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.title, a.body, a.audience, a.ends_on, a.created_at
  from public.platform_announcements a
  where (a.ends_on is null or a.ends_on >= private.today_sp())
    and not exists (
      select 1 from public.platform_announcement_dismissals d
      where d.announcement_id = a.id and d.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.memberships m
      where m.user_id = (select auth.uid()) and m.status = 'active'
        and (a.audience = 'everyone'
          or (a.audience = 'staff' and m.role in ('owner', 'instructor'))
          or (a.audience = 'owners' and m.role = 'owner'))
    )
  order by a.created_at desc;
$$;

create function public.dismiss_platform_announcement(p_announcement_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.platform_announcement_dismissals (announcement_id, user_id)
  select p_announcement_id, (select auth.uid())
  where (select auth.uid()) is not null
    and exists (select 1 from public.platform_announcements where id = p_announcement_id)
  on conflict do nothing;
$$;

-- -----------------------------------------------------------------------------
-- 7. Sign-up: the plan must be an ACTIVE plan of the catalog (same function,
--    only the plan check changed). The admin may keep an academy on a plan
--    that is no longer offered.
-- -----------------------------------------------------------------------------
create or replace function public.create_academy_with_setup(
  p_name text,
  p_plan_tier text,
  p_modalities jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_academy_id uuid;
  v_item jsonb;
  v_ord int;
  v_modality_name text;
  v_uses_belts boolean;
  v_modality_id uuid;
  v_belt jsonb;
  v_belt_ord int;
  v_primary text;
  v_tip text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_academy_name' using errcode = '22023';
  end if;
  if p_plan_tier is not null
     and not exists (select 1 from public.platform_plans where code = p_plan_tier and is_active) then
    raise exception 'invalid_plan_tier' using errcode = '22023';
  end if;
  if p_modalities is null or jsonb_typeof(p_modalities) <> 'array'
     or jsonb_array_length(p_modalities) not between 1 and 20 then
    raise exception 'invalid_modalities' using errcode = '22023';
  end if;

  -- Names: trimmed, 1..60 chars, unique ignoring case.
  if exists (
    select 1 from jsonb_array_elements(p_modalities) e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 'name') <> 'string'
       or char_length(btrim(e ->> 'name')) not between 1 and 60
  ) or (
    select count(distinct lower(btrim(e ->> 'name'))) from jsonb_array_elements(p_modalities) e
  ) <> jsonb_array_length(p_modalities) then
    raise exception 'invalid_modalities' using errcode = '22023';
  end if;

  insert into public.academies (name, created_by, plan_tier)
  values (v_name, v_uid, p_plan_tier)
  returning id into v_academy_id;

  insert into public.memberships (academy_id, user_id, role, status, decided_by, decided_at)
  values (v_academy_id, v_uid, 'owner', 'active', v_uid, now());

  for v_item, v_ord in
    select e, (o - 1)::int from jsonb_array_elements(p_modalities) with ordinality as t (e, o)
  loop
    v_modality_name := btrim(v_item ->> 'name');
    v_uses_belts := coalesce((v_item ->> 'uses_belts')::boolean, false);

    insert into public.academy_modalities (academy_id, name, position, uses_belts)
    values (v_academy_id, v_modality_name, v_ord::smallint, v_uses_belts)
    returning id into v_modality_id;

    if v_item ? 'belts' and jsonb_typeof(v_item -> 'belts') <> 'null' then
      if jsonb_typeof(v_item -> 'belts') <> 'array' or jsonb_array_length(v_item -> 'belts') > 30
         or (not v_uses_belts and jsonb_array_length(v_item -> 'belts') > 0) then
        raise exception 'invalid_belts' using errcode = '22023';
      end if;

      for v_belt, v_belt_ord in
        select b, (o - 1)::int from jsonb_array_elements(v_item -> 'belts') with ordinality as t (b, o)
      loop
        v_primary := v_belt ->> 'primary_color';
        v_tip := nullif(v_belt ->> 'tip_color', '');
        -- Colors are checked by the table (palette keys, one look per modality).
        insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
        values (v_academy_id, v_modality_id, v_primary, v_tip, v_belt_ord::smallint, null);
      end loop;
    end if;
  end loop;

  return v_academy_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Admin RPCs
-- -----------------------------------------------------------------------------

-- ---------- plans ----------
create function public.admin_list_plans()
returns table (
  id uuid, code text, name text, monthly_price_cents integer, annual_discount_pct smallint, student_limit integer,
  benefits text[], trial_days smallint, is_popular boolean, is_active boolean, sort_position smallint, academies bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select p.id, p.code, p.name, p.monthly_price_cents, p.annual_discount_pct, p.student_limit, p.benefits,
    p.trial_days, p.is_popular, p.is_active, p.position,
    (select count(*) from public.academies a where a.plan_tier = p.code)
  from public.platform_plans p
  order by p.position, p.monthly_price_cents;
end;
$$;

-- Creates (p_id null) or updates a plan. The code is set on creation only.
create function public.admin_save_plan(
  p_id uuid, p_code text, p_name text, p_monthly_price_cents integer, p_annual_discount_pct integer,
  p_student_limit integer, p_benefits text[], p_trial_days integer, p_is_popular boolean, p_is_active boolean,
  p_position integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_id uuid := p_id;
  v_benefits text[] := coalesce((
    select array_agg(btrim(b) order by o) from unnest(p_benefits) with ordinality x(b, o) where btrim(b) <> ''
  ), '{}');
begin
  if coalesce(p_is_popular, false) then
    update public.platform_plans set is_popular = false where is_popular and id is distinct from p_id;
  end if;
  if v_id is null then
    insert into public.platform_plans (code, name, monthly_price_cents, annual_discount_pct, student_limit, benefits,
      trial_days, is_popular, is_active, position)
    values (lower(btrim(p_code)), btrim(p_name), p_monthly_price_cents, p_annual_discount_pct, p_student_limit,
      v_benefits, p_trial_days, coalesce(p_is_popular, false), coalesce(p_is_active, true), coalesce(p_position, 0))
    returning id into v_id;
  else
    update public.platform_plans
    set name = btrim(p_name), monthly_price_cents = p_monthly_price_cents, annual_discount_pct = p_annual_discount_pct,
      student_limit = p_student_limit, benefits = v_benefits, trial_days = p_trial_days,
      is_popular = coalesce(p_is_popular, false), is_active = coalesce(p_is_active, true),
      position = coalesce(p_position, 0)
    where id = v_id;
    if not found then
      raise exception 'plan_not_found' using errcode = '22023';
    end if;
  end if;
  perform private.admin_log(v_admin, case when p_id is null then 'create_plan' else 'update_plan' end, v_id,
    (select to_jsonb(p) from public.platform_plans p where p.id = v_id));
  return v_id;
end;
$$;

-- ---------- customers ----------
create function public.admin_list_customers(p_search text default null)
returns table (
  academy_id uuid, name text, logo_path text, created_at timestamptz,
  owner_id uuid, owner_name text, owner_email text, owner_whatsapp text,
  plan_code text, plan_name text, billing_period text, status text, trial_ends_at timestamptz,
  mrr_cents integer, students bigint, overdue_cents bigint, open_tickets bigint, last_note_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := private.admin_like(p_search);
begin
  perform private.require_platform_admin();
  return query
  select a.id, a.name, a.logo_path, a.created_at,
    o.user_id, op.full_name, ou.email::text, ip.whatsapp,
    a.plan_tier, pl.name, s.billing_period, s.status, s.trial_ends_at,
    coalesce(private.subscription_mrr_cents(a.id), 0),
    (select count(*) from public.memberships m where m.academy_id = a.id and m.status = 'active' and m.role = 'student'),
    (select coalesce(sum(i.amount_cents), 0) from private.platform_invoices i
      where i.academy_id = a.id and i.status = 'open' and i.due_date < private.today_sp())::bigint,
    (select count(*) from public.support_tickets t where t.academy_id = a.id and t.status = 'open'),
    (select max(n.created_at) from private.customer_notes n where n.academy_id = a.id)
  from public.academies a
  left join private.academy_subscriptions s on s.academy_id = a.id
  left join public.platform_plans pl on pl.code = a.plan_tier
  left join public.memberships o on o.academy_id = a.id and o.role = 'owner'
  left join public.profiles op on op.id = o.user_id
  left join auth.users ou on ou.id = o.user_id
  left join public.instructor_profiles ip on ip.user_id = o.user_id
  where v_like is null or a.name ilike v_like or op.full_name ilike v_like or ou.email ilike v_like
  order by a.name;
end;
$$;

-- One customer: subscription, invoices, notes and support tickets.
create function public.admin_get_customer(p_academy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return (
    select jsonb_build_object(
      'academy_id', a.id, 'name', a.name, 'logo_path', a.logo_path, 'created_at', a.created_at,
      'owner_id', o.user_id, 'owner_name', op.full_name, 'owner_email', ou.email, 'owner_whatsapp', ip.whatsapp,
      'students', (select count(*) from public.memberships m where m.academy_id = a.id and m.status = 'active' and m.role = 'student'),
      'plan_code', a.plan_tier,
      'subscription', jsonb_build_object(
        'billing_period', s.billing_period, 'custom_price_cents', s.custom_price_cents, 'status', s.status,
        'trial_ends_at', s.trial_ends_at, 'started_at', s.started_at, 'canceled_at', s.canceled_at,
        'provider', s.provider, 'cycle_cents', private.subscription_cycle_cents(a.id),
        'mrr_cents', coalesce(private.subscription_mrr_cents(a.id), 0)),
      'invoices', coalesce((
        select jsonb_agg(to_jsonb(i) - 'created_by' - 'academy_id' order by i.reference_month desc, i.number desc)
        from private.platform_invoices i where i.academy_id = a.id), '[]'::jsonb),
      'notes', coalesce((
        select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'body', n.body, 'created_at', n.created_at,
          'author_name', coalesce(np.full_name, '')) order by n.created_at desc)
        from private.customer_notes n left join public.profiles np on np.id = n.author_id
        where n.academy_id = a.id), '[]'::jsonb),
      'tickets', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'subject', t.subject, 'status', t.status,
          'last_message_at', t.last_message_at) order by t.last_message_at desc)
        from public.support_tickets t where t.academy_id = a.id), '[]'::jsonb))
    from public.academies a
    left join private.academy_subscriptions s on s.academy_id = a.id
    left join public.memberships o on o.academy_id = a.id and o.role = 'owner'
    left join public.profiles op on op.id = o.user_id
    left join auth.users ou on ou.id = o.user_id
    left join public.instructor_profiles ip on ip.user_id = o.user_id
    where a.id = p_academy_id
  );
end;
$$;

create function public.admin_update_subscription(
  p_academy_id uuid, p_plan_code text, p_billing_period text, p_custom_price_cents integer, p_status text,
  p_trial_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_old private.academy_subscriptions;
  v_old_plan text;
begin
  select * into v_old from private.academy_subscriptions where academy_id = p_academy_id for update;
  if v_old.academy_id is null then
    raise exception 'academy_not_found' using errcode = '22023';
  end if;
  select plan_tier into v_old_plan from public.academies where id = p_academy_id for update;
  if p_plan_code is not null and not exists (select 1 from public.platform_plans where code = p_plan_code) then
    raise exception 'plan_not_found' using errcode = '22023';
  end if;
  update public.academies set plan_tier = p_plan_code where id = p_academy_id and plan_tier is distinct from p_plan_code;
  update private.academy_subscriptions
  set billing_period = p_billing_period,
      custom_price_cents = p_custom_price_cents,
      status = p_status,
      trial_ends_at = p_trial_ends_at,
      started_at = case when p_status in ('active', 'past_due') then coalesce(started_at, now()) else started_at end,
      canceled_at = case when p_status = 'canceled' then coalesce(canceled_at, now()) else null end
  where academy_id = p_academy_id;
  perform private.admin_log(v_admin, 'update_subscription', p_academy_id, jsonb_build_object(
    'before', to_jsonb(v_old) || jsonb_build_object('plan_code', v_old_plan),
    'after', jsonb_build_object('plan_code', p_plan_code, 'billing_period', p_billing_period,
      'custom_price_cents', p_custom_price_cents, 'status', p_status, 'trial_ends_at', p_trial_ends_at)));
end;
$$;

create function public.admin_add_customer_note(p_academy_id uuid, p_kind text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_id uuid;
begin
  insert into private.customer_notes (academy_id, kind, body, author_id)
  values (p_academy_id, coalesce(p_kind, 'note'), btrim(p_body), v_admin)
  returning id into v_id;
  perform private.admin_log(v_admin, 'add_customer_note', p_academy_id, jsonb_build_object('note_id', v_id, 'kind', p_kind));
  return v_id;
end;
$$;

create function public.admin_delete_customer_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_note private.customer_notes;
begin
  delete from private.customer_notes where id = p_note_id returning * into v_note;
  if v_note.id is not null then
    perform private.admin_log(v_admin, 'delete_customer_note', v_note.academy_id, to_jsonb(v_note));
  end if;
end;
$$;

-- ---------- invoices ----------
create function public.admin_list_invoices(p_status text default null, p_from date default null, p_to date default null)
returns table (
  id uuid, number bigint, academy_id uuid, academy_name text, reference_month date, description text,
  amount_cents integer, due_date date, status text, is_overdue boolean, paid_on date, payment_method text,
  provider text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select i.id, i.number, i.academy_id, i.academy_name, i.reference_month, i.description, i.amount_cents, i.due_date,
    i.status, i.status = 'open' and i.due_date < private.today_sp(), i.paid_on, i.payment_method, i.provider, i.created_at
  from private.platform_invoices i
  where (p_status is null
      or (p_status = 'overdue' and i.status = 'open' and i.due_date < private.today_sp())
      or i.status = p_status)
    and (p_from is null or i.reference_month >= date_trunc('month', p_from)::date)
    and (p_to is null or i.reference_month <= p_to)
  order by i.reference_month desc, i.academy_name, i.number desc;
end;
$$;

-- Invoices of one month for every paying subscription (active or past due)
-- with none yet. A monthly plan is billed every month; an annual plan once,
-- covering 12 months from that invoice. Months covered by an annual invoice
-- are skipped either way (switching plans never bills twice). The due day is
-- never before today, so new invoices are not born overdue.
create function public.admin_generate_invoices(p_month date, p_due_day integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_month date := date_trunc('month', p_month)::date;
  v_count integer;
begin
  if p_due_day is null or p_due_day not between 1 and 28 then
    raise exception 'invalid_due_day' using errcode = '22023';
  end if;
  insert into private.platform_invoices (academy_id, academy_name, reference_month, kind, description, amount_cents,
    due_date, created_by)
  select a.id, a.name, v_month, s.billing_period,
    coalesce(pl.name, 'Plano') || case when s.billing_period = 'annual' then ' (anual)' else ' (mensal)' end,
    private.subscription_cycle_cents(a.id),
    greatest(make_date(extract(year from v_month)::int, extract(month from v_month)::int, p_due_day), private.today_sp()),
    v_admin
  from private.academy_subscriptions s
  join public.academies a on a.id = s.academy_id
  left join public.platform_plans pl on pl.code = a.plan_tier
  where s.status in ('active', 'past_due')
    and coalesce(private.subscription_cycle_cents(a.id), 0) > 0
    -- Nothing live for this month yet (monthly, annual or one-off) ...
    and not exists (
      select 1 from private.platform_invoices i
      where i.academy_id = a.id and i.status <> 'void' and i.reference_month = v_month)
    -- ... and the month is not covered by an annual invoice (before or after it).
    and not exists (
      select 1 from private.platform_invoices i
      where i.academy_id = a.id and i.status <> 'void' and i.kind = 'annual'
        and v_month >= i.reference_month and v_month < (i.reference_month + interval '12 months')::date)
    and not (s.billing_period = 'annual' and exists (
      select 1 from private.platform_invoices i
      where i.academy_id = a.id and i.status <> 'void' and i.kind = 'annual'
        and i.reference_month > v_month and i.reference_month < (v_month + interval '12 months')::date))
  on conflict (academy_id, reference_month) where status <> 'void' do nothing;
  get diagnostics v_count = row_count;
  perform private.admin_log(v_admin, 'generate_invoices', v_admin,
    jsonb_build_object('month', v_month, 'due_day', p_due_day, 'created', v_count));
  return v_count;
end;
$$;

create function public.admin_create_invoice(
  p_academy_id uuid, p_reference_month date, p_amount_cents integer, p_due_date date, p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_name text;
  v_id uuid;
begin
  select name into v_name from public.academies where id = p_academy_id;
  if v_name is null then
    raise exception 'academy_not_found' using errcode = '22023';
  end if;
  if p_due_date is null then
    raise exception 'invalid_due_date' using errcode = '22023';
  end if;
  insert into private.platform_invoices (academy_id, academy_name, reference_month, description, amount_cents,
    due_date, created_by)
  values (p_academy_id, v_name, date_trunc('month', p_reference_month)::date, btrim(coalesce(p_description, '')),
    p_amount_cents, p_due_date, v_admin)
  returning id into v_id;
  perform private.admin_log(v_admin, 'create_invoice', v_id, jsonb_build_object('academy_id', p_academy_id,
    'amount_cents', p_amount_cents, 'reference_month', p_reference_month));
  return v_id;
end;
$$;

-- open → paid (with date and method), paid → open (undo), open → void.
create function public.admin_set_invoice_status(p_invoice_id uuid, p_status text, p_paid_on date default null,
  p_payment_method text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_old private.platform_invoices;
begin
  select * into v_old from private.platform_invoices where id = p_invoice_id for update;
  if v_old.id is null then
    raise exception 'invoice_not_found' using errcode = '22023';
  end if;
  if v_old.status = 'void' or p_status not in ('open', 'paid', 'void')
     or (p_status = 'void' and v_old.status <> 'open') then
    raise exception 'invoice_status_invalid' using errcode = '22023';
  end if;
  if p_status = 'paid' and (p_paid_on is null or p_payment_method is null) then
    raise exception 'invoice_payment_required' using errcode = '22023';
  end if;
  update private.platform_invoices
  set status = p_status,
      paid_on = case when p_status = 'paid' then p_paid_on end,
      payment_method = case when p_status = 'paid' then p_payment_method end
  where id = p_invoice_id;
  perform private.admin_log(v_admin, 'set_invoice_status', p_invoice_id, jsonb_build_object(
    'from', v_old.status, 'to', p_status, 'paid_on', p_paid_on, 'payment_method', p_payment_method));
end;
$$;

-- ---------- support ----------
create function public.admin_list_tickets(p_status text default null, p_search text default null)
returns table (
  id uuid, number bigint, subject text, status text, priority text,
  user_id uuid, user_name text, user_email text, academy_id uuid, academy_name text,
  messages bigint, last_message_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := private.admin_like(p_search);
begin
  perform private.require_platform_admin();
  return query
  select t.id, t.number, t.subject, t.status, t.priority, t.user_id, p.full_name, u.email::text,
    t.academy_id, a.name, (select count(*) from public.support_messages m where m.ticket_id = t.id),
    t.last_message_at, t.created_at
  from public.support_tickets t
  join public.profiles p on p.id = t.user_id
  left join auth.users u on u.id = t.user_id
  left join public.academies a on a.id = t.academy_id
  where (p_status is null or t.status = p_status)
    and (v_like is null or t.subject ilike v_like or p.full_name ilike v_like or u.email ilike v_like
      or a.name ilike v_like or t.number::text = btrim(p_search))
  order by case t.status when 'open' then 0 when 'answered' then 1 else 2 end,
    case t.priority when 'high' then 0 when 'normal' then 1 else 2 end,
    t.last_message_at desc;
end;
$$;

create function public.admin_get_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return (
    select to_jsonb(t) || jsonb_build_object(
      'user_name', p.full_name, 'user_email', u.email, 'academy_name', a.name,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'is_staff', m.is_staff, 'body', m.body,
          'created_at', m.created_at, 'author_name', coalesce(mp.full_name, '')) order by m.created_at)
        from public.support_messages m left join public.profiles mp on mp.id = m.author_id
        where m.ticket_id = t.id), '[]'::jsonb))
    from public.support_tickets t
    join public.profiles p on p.id = t.user_id
    left join auth.users u on u.id = t.user_id
    left join public.academies a on a.id = t.academy_id
    where t.id = p_ticket_id
  );
end;
$$;

create function public.admin_reply_ticket(p_ticket_id uuid, p_body text, p_close boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
begin
  perform 1 from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = '22023';
  end if;
  insert into public.support_messages (ticket_id, author_id, is_staff, body)
  values (p_ticket_id, v_admin, true, btrim(p_body));
  update public.support_tickets
  set status = case when coalesce(p_close, false) then 'closed' else 'answered' end,
      closed_at = case when coalesce(p_close, false) then now() end,
      last_message_at = now()
  where id = p_ticket_id;
  perform private.admin_log(v_admin, 'reply_ticket', p_ticket_id, jsonb_build_object('close', coalesce(p_close, false)));
end;
$$;

create function public.admin_set_ticket(p_ticket_id uuid, p_status text, p_priority text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
begin
  update public.support_tickets
  set status = p_status, priority = p_priority,
      closed_at = case when p_status = 'closed' then coalesce(closed_at, now()) end
  where id = p_ticket_id;
  if not found then
    raise exception 'ticket_not_found' using errcode = '22023';
  end if;
  perform private.admin_log(v_admin, 'set_ticket', p_ticket_id, jsonb_build_object('status', p_status, 'priority', p_priority));
end;
$$;

-- ---------- platform announcements ----------
create function public.admin_list_platform_announcements()
returns table (
  id uuid, title text, body text, audience text, ends_on date, created_at timestamptz, updated_at timestamptz,
  is_live boolean, dismissals bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select a.id, a.title, a.body, a.audience, a.ends_on, a.created_at, a.updated_at,
    a.ends_on is null or a.ends_on >= private.today_sp(),
    (select count(*) from public.platform_announcement_dismissals d where d.announcement_id = a.id)
  from public.platform_announcements a
  order by a.created_at desc;
end;
$$;

create function public.admin_save_platform_announcement(p_id uuid, p_title text, p_body text, p_audience text, p_ends_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.platform_announcements (title, body, audience, ends_on, created_by)
    values (btrim(p_title), btrim(p_body), p_audience, p_ends_on, v_admin)
    returning id into v_id;
  else
    update public.platform_announcements
    set title = btrim(p_title), body = btrim(p_body), audience = p_audience, ends_on = p_ends_on
    where id = v_id;
    if not found then
      raise exception 'announcement_not_found' using errcode = '22023';
    end if;
  end if;
  perform private.admin_log(v_admin, case when p_id is null then 'create_announcement' else 'update_announcement' end,
    v_id, jsonb_build_object('title', btrim(p_title), 'audience', p_audience, 'ends_on', p_ends_on));
  return v_id;
end;
$$;

create function public.admin_delete_platform_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_row public.platform_announcements;
begin
  delete from public.platform_announcements where id = p_id returning * into v_row;
  if v_row.id is not null then
    perform private.admin_log(v_admin, 'delete_announcement', p_id, to_jsonb(v_row));
  end if;
end;
$$;

-- ---------- dashboard & reports ----------
create function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', private.today_sp())::date;
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'mrr_cents', (select coalesce(sum(private.subscription_mrr_cents(s.academy_id)), 0) from private.academy_subscriptions s),
    'paying', (select count(*) from private.academy_subscriptions where status in ('active', 'past_due')),
    'trialing', (select count(*) from private.academy_subscriptions where status = 'trialing'),
    'trial_expired', (select count(*) from private.academy_subscriptions where status = 'trialing' and trial_ends_at < now()),
    'trial_ending_7d', (select count(*) from private.academy_subscriptions
      where status = 'trialing' and trial_ends_at between now() and now() + interval '7 days'),
    'canceled', (select count(*) from private.academy_subscriptions where status = 'canceled'),
    'overdue_cents', (select coalesce(sum(amount_cents), 0) from private.platform_invoices where status = 'open' and due_date < private.today_sp()),
    'overdue_count', (select count(*) from private.platform_invoices where status = 'open' and due_date < private.today_sp()),
    'received_month_cents', (select coalesce(sum(amount_cents), 0) from private.platform_invoices where status = 'paid' and paid_on >= v_month),
    'open_month_cents', (select coalesce(sum(amount_cents), 0) from private.platform_invoices where status = 'open' and reference_month = v_month),
    'academies', (select count(*) from public.academies),
    'users', (select count(*) from public.profiles p join auth.users u on u.id = p.id where not coalesce(u.is_anonymous, false)),
    'active_students', (select count(*) from public.memberships where status = 'active' and role = 'student'),
    'active_staff', (select count(*) from public.memberships where status = 'active' and role <> 'student'),
    'pending_requests', (select count(*) from public.memberships where status = 'pending'),
    'open_tickets', (select count(*) from public.support_tickets where status = 'open'),
    'new_academies_30d', (select count(*) from public.academies where created_at >= now() - interval '30 days'),
    'new_users_30d', (select count(*) from public.profiles p join auth.users u on u.id = p.id
      where not coalesce(u.is_anonymous, false) and p.created_at >= now() - interval '30 days'),
    'checkins_30d', (select count(*) from public.checkins where status = 'confirmed' and class_date >= private.today_sp() - 30),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name,
        'academies', (select count(*) from public.academies a where a.plan_tier = p.code)) order by p.position)
      from public.platform_plans p), '[]'::jsonb),
    'recent_academies', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select a.id, a.name, a.logo_path, a.created_at, a.plan_tier from public.academies a
        order by a.created_at desc limit 5) x), '[]'::jsonb),
    'recent_tickets', coalesce((
      select jsonb_agg(x order by x.last_message_at desc) from (
        select t.id, t.number, t.subject, t.status, t.priority, t.last_message_at
        from public.support_tickets t where t.status = 'open' order by t.last_message_at desc limit 5) x), '[]'::jsonb)
  );
end;
$$;

-- Month by month for the last p_months months (current month included).
create function public.admin_report(p_months integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_months integer := least(greatest(coalesce(p_months, 12), 1), 36);
  v_from date := (date_trunc('month', private.today_sp()) - make_interval(months => v_months - 1))::date;
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'from', v_from,
    'months', (
      select jsonb_agg(jsonb_build_object(
        'month', m.month,
        'new_academies', (select count(*) from public.academies a where private.month_sp(a.created_at) = m.month),
        'new_users', (select count(*) from public.profiles p join auth.users u on u.id = p.id
          where not coalesce(u.is_anonymous, false) and private.month_sp(p.created_at) = m.month),
        'canceled', (select count(*) from private.academy_subscriptions s where private.month_sp(s.canceled_at) = m.month),
        'invoiced_cents', (select coalesce(sum(i.amount_cents), 0) from private.platform_invoices i
          where i.status <> 'void' and i.reference_month = m.month),
        'received_cents', (select coalesce(sum(i.amount_cents), 0) from private.platform_invoices i
          where i.status = 'paid' and date_trunc('month', i.paid_on)::date = m.month),
        'checkins', (select count(*) from public.checkins c
          where c.status = 'confirmed' and date_trunc('month', c.class_date)::date = m.month),
        'training_students', (select count(distinct c.user_id) from public.checkins c
          where c.status = 'confirmed' and date_trunc('month', c.class_date)::date = m.month)
      ) order by m.month)
      from (select generate_series(v_from, date_trunc('month', private.today_sp())::date, interval '1 month')::date as month) m
    ),
    'top_academies', coalesce((
      select jsonb_agg(x order by x.checkins desc, x.name) from (
        select a.id, a.name,
          (select count(*) from public.memberships m where m.academy_id = a.id and m.status = 'active' and m.role = 'student') as students,
          (select count(*) from public.checkins c where c.academy_id = a.id and c.status = 'confirmed' and c.class_date >= v_from) as checkins
        from public.academies a
        order by checkins desc, a.name
        limit 10) x), '[]'::jsonb)
  );
end;
$$;

-- The academy form no longer carries the plan: it changes only in the
-- customer's subscription (admin_update_subscription), so two screens never
-- overwrite each other.
drop function public.admin_update_academy(uuid, text, text, integer);
create function public.admin_update_academy(p_academy_id uuid, p_name text, p_inactive_after_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_old public.academies;
begin
  select * into v_old from public.academies where id = p_academy_id for update;
  if v_old.id is null then
    raise exception 'academy_not_found' using errcode = '22023';
  end if;
  update public.academies
  set name = btrim(p_name), inactive_after_days = p_inactive_after_days
  where id = p_academy_id;
  perform private.admin_log(v_admin, 'update_academy', p_academy_id, jsonb_build_object(
    'before', jsonb_build_object('name', v_old.name, 'inactive_after_days', v_old.inactive_after_days),
    'after', jsonb_build_object('name', btrim(p_name), 'inactive_after_days', p_inactive_after_days)));
end;
$$;

-- Users list: up to 5000 rows per call (CSV export).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, full_name text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  academies bigint, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := private.admin_like(p_search);
begin
  perform private.require_platform_admin();
  return query
  select p.id, p.full_name, u.email::text, p.created_at, u.last_sign_in_at,
    (select count(*) from public.memberships m where m.user_id = p.id and m.status = 'active'),
    count(*) over ()
  from public.profiles p
  left join auth.users u on u.id = p.id
  where not coalesce(u.is_anonymous, false)
    and (v_like is null or p.full_name ilike v_like or u.email ilike v_like)
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 50), 1), 5000)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Grants
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'list_public_plans', 'create_support_ticket', 'reply_support_ticket', 'close_support_ticket',
      'platform_announcements_feed', 'dismiss_platform_announcement',
      'admin_list_plans', 'admin_save_plan', 'admin_list_customers', 'admin_get_customer',
      'admin_update_subscription', 'admin_add_customer_note', 'admin_delete_customer_note',
      'admin_list_invoices', 'admin_generate_invoices', 'admin_create_invoice', 'admin_set_invoice_status',
      'admin_list_tickets', 'admin_get_ticket', 'admin_reply_ticket', 'admin_set_ticket',
      'admin_list_platform_announcements', 'admin_save_platform_announcement', 'admin_delete_platform_announcement',
      'admin_dashboard', 'admin_report', 'admin_update_academy')
  loop
    execute format('revoke all on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end;
$$;
