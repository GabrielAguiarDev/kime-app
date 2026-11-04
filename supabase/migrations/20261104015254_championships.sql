-- =============================================================================
-- Kimi — Championships
-- championships of an academy and the competitors entered in each one.
--
-- championship_entries carries academy_id (kept consistent by a composite FK)
-- so its policies never read championships: championships' policy reads
-- entries, and a policy cycle between the two would recurse.
-- =============================================================================

create table public.championships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  event_date date not null,
  location text not null default '' check (char_length(location) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, academy_id)
);
create index championships_academy_date_idx on public.championships (academy_id, event_date);

create table public.championship_entries (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null,
  academy_id uuid not null,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (championship_id, athlete_id),
  foreign key (championship_id, academy_id)
    references public.championships (id, academy_id) on delete cascade
);
create index championship_entries_championship_academy_idx
  on public.championship_entries (championship_id, academy_id);
create index championship_entries_athlete_id_idx on public.championship_entries (athlete_id);
create index championship_entries_academy_id_idx on public.championship_entries (academy_id);

create trigger championships_set_updated_at before update on public.championships
  for each row execute function private.set_updated_at();
create trigger championship_entries_set_updated_at before update on public.championship_entries
  for each row execute function private.set_updated_at();

alter table public.championships enable row level security;
alter table public.championship_entries enable row level security;

grant select, insert, update, delete on public.championships to authenticated;
grant select, insert, delete on public.championship_entries to authenticated;

-- championships
create policy "championships: professor or entered competitor reads"
  on public.championships for select to authenticated
  using (
    private.is_professor(academy_id)
    or (
      private.is_competitor_of((select auth.uid()), academy_id)
      and exists (
        select 1 from public.championship_entries e
        where e.championship_id = championships.id and e.athlete_id = (select auth.uid())
      )
    )
  );
create policy "championships: professor inserts"
  on public.championships for insert to authenticated
  with check (private.is_professor(academy_id));
create policy "championships: professor updates"
  on public.championships for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));
create policy "championships: professor deletes"
  on public.championships for delete to authenticated
  using (private.is_professor(academy_id));

-- championship_entries
create policy "championship_entries: professor or own competitor reads"
  on public.championship_entries for select to authenticated
  using (
    private.is_professor(academy_id)
    or (athlete_id = (select auth.uid()) and private.is_competitor_of(athlete_id, academy_id))
  );
-- Only competitors of the same academy can be entered.
create policy "championship_entries: professor inserts"
  on public.championship_entries for insert to authenticated
  with check (private.is_professor(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "championship_entries: professor deletes"
  on public.championship_entries for delete to authenticated
  using (private.is_professor(academy_id));
