-- =============================================================================
-- Kimi — Academy finance (user request, 2026-11-10). Owner only.
--
-- Management only: the app never processes payments.
--
-- 1. academy_finance_settings: on/off (off = nothing shows up for anyone and
--    nothing is generated), default due day (1–28) and "block students more
--    than 7 days late" (off by default).
-- 2. finance_plans: monthly plans (name + amount); archived, never deleted.
-- 3. finance_student_billing: per student membership — plan or custom amount,
--    due day (null = academy default) and "exempt". Goes away with the
--    membership; the charges stay.
-- 4. finance_charges: one per student per month (unique), created by the
--    monthly job. Status is computed (paid / pending until the due date /
--    overdue after it), never stored. The owner marks it paid (date, method,
--    amount received) or undoes it. A student who leaves keeps the history
--    (user_id + name snapshot) and gets no new charges.
-- 5. finance_expenses: one-off or "repeat every month" (series_id); the
--    monthly job copies the latest entry of each repeating series into the
--    new month, editable afterwards.
-- 6. Monthly job (pg_cron, 00:05 in Brasília on day 1): private.generate_finance_month.
-- 7. RLS: only the owner reads and writes. Professors get nothing. A student
--    reads only the status of their own charges, through my_finance_status().
-- 8. private.is_finance_blocked(academy): computed block used by the RLS of
--    the academy features (next migration).
-- =============================================================================

create type public.finance_payment_method as enum ('pix', 'cash', 'card', 'transfer', 'other');
create type public.finance_expense_category as enum (
  'rent', 'water', 'energy', 'internet', 'equipment', 'salaries', 'maintenance', 'taxes', 'other'
);

-- -----------------------------------------------------------------------------
-- 1. Settings
-- -----------------------------------------------------------------------------
create table public.academy_finance_settings (
  academy_id uuid primary key references public.academies (id) on delete cascade,
  enabled boolean not null default false,
  default_due_day smallint not null default 10 check (default_due_day between 1 and 28),
  block_overdue boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger academy_finance_settings_set_updated_at
  before update on public.academy_finance_settings
  for each row execute function private.set_updated_at();

alter table public.academy_finance_settings enable row level security;

create policy "finance settings: owner reads"
  on public.academy_finance_settings for select to authenticated
  using (private.is_owner(academy_id));
create policy "finance settings: owner creates"
  on public.academy_finance_settings for insert to authenticated
  with check (private.is_owner(academy_id));
create policy "finance settings: owner updates"
  on public.academy_finance_settings for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

grant select on public.academy_finance_settings to authenticated;
grant insert (academy_id, enabled, default_due_day, block_overdue) on public.academy_finance_settings to authenticated;
grant update (enabled, default_due_day, block_overdue) on public.academy_finance_settings to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Plans
-- -----------------------------------------------------------------------------
create table public.finance_plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, academy_id)
);
create index finance_plans_academy_idx on public.finance_plans (academy_id);

alter table public.finance_plans enable row level security;

create policy "finance plans: owner reads"
  on public.finance_plans for select to authenticated
  using (private.is_owner(academy_id));
create policy "finance plans: owner creates"
  on public.finance_plans for insert to authenticated
  with check (private.is_owner(academy_id));
create policy "finance plans: owner updates"
  on public.finance_plans for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

grant select on public.finance_plans to authenticated;
grant insert (academy_id, name, amount_cents) on public.finance_plans to authenticated;
grant update (name, amount_cents, archived_at) on public.finance_plans to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Billing of each student
-- -----------------------------------------------------------------------------
create table public.finance_student_billing (
  membership_id uuid primary key references public.memberships (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  plan_id uuid,
  custom_amount_cents integer check (custom_amount_cents is null or custom_amount_cents between 1 and 10000000),
  -- Null = the academy default.
  due_day smallint check (due_day is null or due_day between 1 and 28),
  is_exempt boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key (plan_id, academy_id) references public.finance_plans (id, academy_id),
  constraint finance_student_billing_plan_or_custom check (plan_id is null or custom_amount_cents is null)
);
create index finance_student_billing_academy_idx on public.finance_student_billing (academy_id);
create index finance_student_billing_plan_idx on public.finance_student_billing (plan_id, academy_id);

-- The academy comes from the membership (whatever the client sends), and only
-- students have a monthly fee. The client saves with update-then-insert (an
-- upsert would need UPDATE on the key columns).
create function private.guard_finance_student_billing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_academy uuid;
begin
  if tg_op = 'UPDATE' then
    new.membership_id := old.membership_id;
  end if;
  -- Invoker: memberships of other academies are invisible, so a foreign id
  -- answers like a missing one.
  select m.academy_id into v_academy
  from public.memberships m
  where m.id = new.membership_id and m.role = 'student';
  if v_academy is null then
    raise exception 'not_a_student' using errcode = 'P0001';
  end if;
  new.academy_id := v_academy;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_finance_student_billing() from public, anon;

create trigger finance_student_billing_guard
  before insert or update on public.finance_student_billing
  for each row execute function private.guard_finance_student_billing();

alter table public.finance_student_billing enable row level security;

create policy "finance billing: owner reads"
  on public.finance_student_billing for select to authenticated
  using (private.is_owner(academy_id));
create policy "finance billing: owner creates"
  on public.finance_student_billing for insert to authenticated
  with check (private.is_owner(academy_id));
create policy "finance billing: owner updates"
  on public.finance_student_billing for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

grant select on public.finance_student_billing to authenticated;
grant insert (membership_id, academy_id, plan_id, custom_amount_cents, due_day, is_exempt)
  on public.finance_student_billing to authenticated;
grant update (plan_id, custom_amount_cents, due_day, is_exempt) on public.finance_student_billing to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Charges
-- -----------------------------------------------------------------------------
create table public.finance_charges (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- Null once the account is deleted; the name snapshot keeps the history readable.
  user_id uuid references public.profiles (id) on delete set null,
  student_name text not null,
  -- First day of the month the charge refers to.
  reference_month date not null check (extract(day from reference_month) = 1),
  due_date date not null,
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  paid_on date,
  payment_method public.finance_payment_method,
  paid_amount_cents integer check (paid_amount_cents is null or paid_amount_cents between 0 and 10000000),
  paid_marked_by uuid references public.profiles (id) on delete set null,
  paid_marked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint finance_charges_one_per_month unique (academy_id, user_id, reference_month),
  constraint finance_charges_paid_fields check ((paid_on is null) = (paid_amount_cents is null)),
  constraint finance_charges_method_needs_payment check (paid_on is not null or payment_method is null)
);
create index finance_charges_academy_month_idx on public.finance_charges (academy_id, reference_month);
create index finance_charges_user_open_idx on public.finance_charges (user_id, academy_id) where paid_on is null;
create index finance_charges_paid_marked_by_idx on public.finance_charges (paid_marked_by);

-- Payment fields only: who and when come from here; a payment date cannot be
-- in the future (academy calendar); undoing clears everything.
create function private.guard_finance_charge_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paid_on is null then
    new.payment_method := null;
    new.paid_amount_cents := null;
    new.paid_marked_by := null;
    new.paid_marked_at := null;
    return new;
  end if;
  if new.paid_on > private.academy_local_date(new.academy_id) then
    raise exception 'payment_in_future' using errcode = 'P0001';
  end if;
  if new.paid_amount_cents is null then
    new.paid_amount_cents := new.amount_cents;
  end if;
  new.paid_marked_by := (select auth.uid());
  new.paid_marked_at := now();
  return new;
end;
$$;

create trigger finance_charges_guard_payment
  before update on public.finance_charges
  for each row execute function private.guard_finance_charge_payment();

alter table public.finance_charges enable row level security;

create policy "finance charges: owner reads"
  on public.finance_charges for select to authenticated
  using (private.is_owner(academy_id));
create policy "finance charges: owner records payment"
  on public.finance_charges for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

-- No insert / delete for clients: charges come from the monthly job.
grant select on public.finance_charges to authenticated;
grant update (paid_on, payment_method, paid_amount_cents) on public.finance_charges to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Expenses
-- -----------------------------------------------------------------------------
create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  category public.finance_expense_category not null,
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  expense_date date not null,
  -- The latest entry of a series decides whether next month gets a copy.
  repeats_monthly boolean not null default false,
  series_id uuid not null default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finance_expenses_academy_date_idx on public.finance_expenses (academy_id, expense_date);
create index finance_expenses_series_idx on public.finance_expenses (series_id, expense_date desc);
create index finance_expenses_created_by_idx on public.finance_expenses (created_by);

create function private.guard_finance_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.academy_id := old.academy_id;
    new.series_id := old.series_id;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger finance_expenses_guard
  before insert or update on public.finance_expenses
  for each row execute function private.guard_finance_expense();

alter table public.finance_expenses enable row level security;

create policy "finance expenses: owner reads"
  on public.finance_expenses for select to authenticated
  using (private.is_owner(academy_id));
create policy "finance expenses: owner creates"
  on public.finance_expenses for insert to authenticated
  with check (private.is_owner(academy_id));
create policy "finance expenses: owner updates"
  on public.finance_expenses for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));
create policy "finance expenses: owner deletes"
  on public.finance_expenses for delete to authenticated
  using (private.is_owner(academy_id));

grant select, delete on public.finance_expenses to authenticated;
grant insert (academy_id, description, category, amount_cents, expense_date, repeats_monthly)
  on public.finance_expenses to authenticated;
grant update (description, category, amount_cents, expense_date, repeats_monthly) on public.finance_expenses to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Monthly job
-- -----------------------------------------------------------------------------
-- Idempotent: running it twice for the same month creates nothing new.
create function private.generate_finance_month(p_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_day)::date;
  v_last_day date := (date_trunc('month', p_day) + interval '1 month - 1 day')::date;
begin
  -- One charge per active, non-exempt student with an amount (plan or custom).
  insert into public.finance_charges (academy_id, user_id, student_name, reference_month, due_date, amount_cents)
  select
    m.academy_id,
    m.user_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Aluno'),
    v_month,
    v_month + (coalesce(b.due_day, s.default_due_day) - 1),
    coalesce(b.custom_amount_cents, fp.amount_cents)
  from public.academy_finance_settings s
  join public.memberships m on m.academy_id = s.academy_id and m.role = 'student' and m.status = 'active'
  join public.finance_student_billing b on b.membership_id = m.id and not b.is_exempt
  left join public.finance_plans fp on fp.id = b.plan_id
  join public.profiles p on p.id = m.user_id
  where s.enabled
    and coalesce(b.custom_amount_cents, fp.amount_cents) is not null
  on conflict on constraint finance_charges_one_per_month do nothing;

  -- Repeating expenses: copy the latest entry of each series into the month,
  -- on the day of the series' first entry (or the month's last day: a rent
  -- due on the 31st stays on the 31st after February).
  insert into public.finance_expenses (academy_id, description, category, amount_cents, expense_date, repeats_monthly, series_id)
  select
    l.academy_id,
    l.description,
    l.category,
    l.amount_cents,
    least(
      v_month + (extract(day from (
        select min(f.expense_date) from public.finance_expenses f where f.series_id = l.series_id
      ))::int - 1),
      v_last_day
    ),
    true,
    l.series_id
  from (
    select distinct on (e.series_id) e.*
    from public.finance_expenses e
    order by e.series_id, e.expense_date desc, e.created_at desc
  ) l
  join public.academy_finance_settings s on s.academy_id = l.academy_id and s.enabled
  where l.repeats_monthly
    and l.expense_date < v_month;
end;
$$;
revoke all on function private.generate_finance_month(date) from public, anon, authenticated;

-- 03:05 UTC on day 1 is 00:05 in Brasília (UTC-3, no daylight saving time).
select cron.schedule(
  'kimi-monthly-finance',
  '5 3 1 * *',
  $$select private.generate_finance_month((now() at time zone 'America/Sao_Paulo')::date)$$
);

-- -----------------------------------------------------------------------------
-- 7. Computed block and the student's own status
-- -----------------------------------------------------------------------------
-- True only for the calling STUDENT of the academy, when finance and the
-- block are on and one of their charges is unpaid more than 7 days after the
-- due date (academy calendar). Paying it unblocks right away.
create function private.is_finance_blocked(p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_finance_settings s
    join public.finance_charges c
      on c.academy_id = s.academy_id
     and c.user_id = (select auth.uid())
     and c.paid_on is null
    where s.academy_id = p_academy_id
      and s.enabled
      and s.block_overdue
      and c.due_date < private.academy_local_date(p_academy_id) - 7
  )
  and private.is_student(p_academy_id);
$$;
revoke all on function private.is_finance_blocked(uuid) from public, anon;
grant execute on function private.is_finance_blocked(uuid) to authenticated;

-- The student's own status: the months overdue (no amounts) and the block.
-- Empty when finance is off or the caller is not a student of the academy.
create function public.my_finance_status(p_academy_id uuid)
returns table (overdue_months date[], blocked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      array_agg(c.reference_month order by c.reference_month)
        filter (where c.id is not null),
      '{}'::date[]
    ),
    private.is_finance_blocked(p_academy_id)
  from public.academy_finance_settings s
  left join public.finance_charges c
    on c.academy_id = s.academy_id
   and c.user_id = (select auth.uid())
   and c.paid_on is null
   and c.due_date < private.academy_local_date(p_academy_id)
  where s.academy_id = p_academy_id
    and s.enabled
    and private.is_student(p_academy_id)
  group by s.academy_id;
$$;
revoke all on function public.my_finance_status(uuid) from public, anon;
grant execute on function public.my_finance_status(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Owner reads: open charges (Início card + list) and the month report
-- -----------------------------------------------------------------------------
-- Unpaid charges of the current month or earlier, most overdue first, with
-- name and photo (also of students who left).
create function public.finance_open_charges(p_academy_id uuid)
returns table (
  id uuid,
  user_id uuid,
  membership_id uuid,
  full_name text,
  avatar_path text,
  reference_month date,
  due_date date,
  amount_cents integer,
  overdue boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  if not private.is_owner(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_today := private.academy_local_date(p_academy_id);
  return query
  select
    c.id,
    c.user_id,
    m.id,
    -- Current name and photo only while still a member; the snapshot otherwise.
    coalesce(case when m.id is not null then nullif(btrim(p.full_name), '') end, c.student_name),
    case when m.id is not null then p.avatar_path end,
    c.reference_month,
    c.due_date,
    c.amount_cents,
    c.due_date < v_today
  from public.finance_charges c
  left join public.profiles p on p.id = c.user_id
  left join public.memberships m on m.academy_id = c.academy_id and m.user_id = c.user_id
  where c.academy_id = p_academy_id
    and c.paid_on is null
    and c.reference_month <= date_trunc('month', v_today)::date
  order by c.due_date, c.reference_month, 4;
end;
$$;
revoke all on function public.finance_open_charges(uuid) from public, anon;
grant execute on function public.finance_open_charges(uuid) to authenticated;

-- Report of one month (by reference month): received, receivable, overdue,
-- expenses and result; the last 6 months (received × expenses); expenses by
-- category; overdue rate of the month; and the students with more than one
-- month overdue today.
create function public.finance_report(p_academy_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_result jsonb;
begin
  if not private.is_owner(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_today := private.academy_local_date(p_academy_id);

  with month_charges as (
    select * from public.finance_charges
    where academy_id = p_academy_id and reference_month = v_month
  ),
  month_expenses as (
    select * from public.finance_expenses
    where academy_id = p_academy_id and expense_date >= v_month and expense_date < v_next
  ),
  months as (
    select (v_month - make_interval(months => g))::date as month
    from generate_series(5, 0, -1) g
  ),
  history as (
    select
      mo.month,
      coalesce((
        select sum(c.paid_amount_cents) from public.finance_charges c
        where c.academy_id = p_academy_id and c.reference_month = mo.month and c.paid_on is not null
      ), 0) as received,
      coalesce((
        select sum(e.amount_cents) from public.finance_expenses e
        where e.academy_id = p_academy_id
          and e.expense_date >= mo.month
          and e.expense_date < (mo.month + interval '1 month')::date
      ), 0) as expenses
    from months mo
  ),
  late as (
    select c.user_id, max(c.student_name) as student_name, count(*) as months, sum(c.amount_cents) as amount
    from public.finance_charges c
    where c.academy_id = p_academy_id
      and c.paid_on is null
      and c.due_date < v_today
      and c.user_id is not null
    group by c.user_id
    having count(*) > 1
  )
  select jsonb_build_object(
    'received', coalesce((select sum(paid_amount_cents) from month_charges where paid_on is not null), 0),
    'receivable', coalesce((select sum(amount_cents) from month_charges where paid_on is null and due_date >= v_today), 0),
    'overdue', coalesce((select sum(amount_cents) from month_charges where paid_on is null and due_date < v_today), 0),
    'expenses', coalesce((select sum(amount_cents) from month_expenses), 0),
    'charges_count', (select count(*) from month_charges),
    'overdue_count', (select count(*) from month_charges where paid_on is null and due_date < v_today),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('month', h.month, 'received', h.received, 'expenses', h.expenses) order by h.month)
      from history h
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category, 'amount', x.amount) order by x.amount desc)
      from (select category, sum(amount_cents) as amount from month_expenses group by category) x
    ), '[]'::jsonb),
    'late_students', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', l.user_id,
          'membership_id', m.id,
          'full_name', coalesce(case when m.id is not null then nullif(btrim(p.full_name), '') end, l.student_name),
          'avatar_path', case when m.id is not null then p.avatar_path end,
          'months', l.months,
          'amount', l.amount
        )
        order by l.months desc, l.amount desc
      )
      from late l
      left join public.profiles p on p.id = l.user_id
      left join public.memberships m on m.academy_id = p_academy_id and m.user_id = l.user_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.finance_report(uuid, date) from public, anon;
grant execute on function public.finance_report(uuid, date) to authenticated;
