-- =============================================================================
-- Kimi — Diet
-- diet_plans (one per competitor, academy and day) + diet_plan_meals.
-- Same access model as water plans.
-- =============================================================================

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  plan_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, academy_id, plan_date)
);
create index diet_plans_academy_id_idx on public.diet_plans (academy_id);

create table public.diet_plan_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  position smallint not null check (position >= 0),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  meal_time time,
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, position)
);

create trigger diet_plans_set_updated_at before update on public.diet_plans
  for each row execute function private.set_updated_at();
create trigger diet_plan_meals_set_updated_at before update on public.diet_plan_meals
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------
alter table public.diet_plans enable row level security;
alter table public.diet_plan_meals enable row level security;

grant select, insert, update, delete on public.diet_plans, public.diet_plan_meals to authenticated;

create policy "diet_plans: competitor reads own, professor reads competitors"
  on public.diet_plans for select to authenticated
  using (
    (athlete_id = (select auth.uid()) or private.is_professor(academy_id))
    and private.is_competitor_of(athlete_id, academy_id)
  );
create policy "diet_plans: professor inserts"
  on public.diet_plans for insert to authenticated
  with check (private.is_professor(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "diet_plans: professor updates"
  on public.diet_plans for update to authenticated
  using (private.is_professor(academy_id) and private.is_competitor_of(athlete_id, academy_id))
  with check (private.is_professor(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "diet_plans: professor deletes"
  on public.diet_plans for delete to authenticated
  using (private.is_professor(academy_id) and private.is_competitor_of(athlete_id, academy_id));

create policy "diet_plan_meals: read with plan"
  on public.diet_plan_meals for select to authenticated
  using (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and (p.athlete_id = (select auth.uid()) or private.is_professor(p.academy_id))
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "diet_plan_meals: professor inserts"
  on public.diet_plan_meals for insert to authenticated
  with check (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_professor(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "diet_plan_meals: professor updates"
  on public.diet_plan_meals for update to authenticated
  using (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_professor(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ))
  with check (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_professor(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "diet_plan_meals: professor deletes"
  on public.diet_plan_meals for delete to authenticated
  using (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_professor(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
