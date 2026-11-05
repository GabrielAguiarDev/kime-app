-- =============================================================================
-- Kimi — Round timer presets saved by the academy
-- Read by every active member; written by staff (owner and instructors).
-- Built-in presets (Boxe, Muay Thai, MMA, rola) live in the app.
-- =============================================================================

create table public.timer_presets (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  rounds smallint not null check (rounds between 1 and 30),
  round_seconds integer not null check (round_seconds between 10 and 3600),
  rest_seconds integer not null check (rest_seconds between 0 and 1800),
  warning_seconds smallint not null check (warning_seconds between 0 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timer_presets_warning_shorter check (warning_seconds < round_seconds)
);
create unique index timer_presets_academy_name_idx on public.timer_presets (academy_id, lower(btrim(name)));
create index timer_presets_created_by_idx on public.timer_presets (created_by);

create trigger timer_presets_set_updated_at before update on public.timer_presets
  for each row execute function private.set_updated_at();

alter table public.timer_presets enable row level security;

grant select, delete on public.timer_presets to authenticated;
grant insert (academy_id, name, rounds, round_seconds, rest_seconds, warning_seconds, created_by)
  on public.timer_presets to authenticated;
grant update (name, rounds, round_seconds, rest_seconds, warning_seconds) on public.timer_presets to authenticated;

create policy "timer_presets: members read"
  on public.timer_presets for select to authenticated
  using (private.is_member(academy_id));
create policy "timer_presets: staff insert"
  on public.timer_presets for insert to authenticated
  with check (private.is_staff(academy_id) and created_by = (select auth.uid()));
create policy "timer_presets: staff update"
  on public.timer_presets for update to authenticated
  using (private.is_staff(academy_id))
  with check (private.is_staff(academy_id));
create policy "timer_presets: staff delete"
  on public.timer_presets for delete to authenticated
  using (private.is_staff(academy_id));
