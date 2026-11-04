-- =============================================================================
-- Kimi — Weight logs
-- Personal weigh-ins of competitors. Professors read them for competitors of
-- their academy.
-- =============================================================================

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weight_logs_athlete_logged_on_idx on public.weight_logs (athlete_id, logged_on desc);

create trigger weight_logs_set_updated_at before update on public.weight_logs
  for each row execute function private.set_updated_at();

alter table public.weight_logs enable row level security;

grant select on public.weight_logs to authenticated;
grant insert (athlete_id, logged_on, weight_kg) on public.weight_logs to authenticated;

create policy "weight_logs: read own or as professor of the competitor"
  on public.weight_logs for select to authenticated
  using (athlete_id = (select auth.uid()) or private.is_professor_of_competitor(athlete_id));
create policy "weight_logs: competitor inserts own"
  on public.weight_logs for insert to authenticated
  with check (athlete_id = (select auth.uid()) and private.is_competitor());
