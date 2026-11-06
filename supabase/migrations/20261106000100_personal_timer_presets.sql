-- =============================================================================
-- Kimi — Personal round timer presets (user decision, 2026-11-06)
-- Anyone (student, instructor, owner) saves their own presets, with any name:
-- they are not tied to a modality nor to an academy, and only the author sees
-- them. The academy's presets (timer_presets, written by the owner) stay.
-- =============================================================================

create table public.personal_timer_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  rounds smallint not null check (rounds between 1 and 30),
  round_seconds integer not null check (round_seconds between 10 and 3600),
  rest_seconds integer not null check (rest_seconds between 0 and 1800),
  warning_seconds smallint not null check (warning_seconds between 0 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_timer_presets_warning_shorter check (warning_seconds < round_seconds)
);
create unique index personal_timer_presets_user_name_idx
  on public.personal_timer_presets (user_id, lower(btrim(name)));

create trigger personal_timer_presets_set_updated_at before update on public.personal_timer_presets
  for each row execute function private.set_updated_at();

alter table public.personal_timer_presets enable row level security;

grant select, delete on public.personal_timer_presets to authenticated;
grant insert (name, rounds, round_seconds, rest_seconds, warning_seconds)
  on public.personal_timer_presets to authenticated;
grant update (name, rounds, round_seconds, rest_seconds, warning_seconds)
  on public.personal_timer_presets to authenticated;

create policy "personal_timer_presets: own read"
  on public.personal_timer_presets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "personal_timer_presets: own insert"
  on public.personal_timer_presets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "personal_timer_presets: own update"
  on public.personal_timer_presets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "personal_timer_presets: own delete"
  on public.personal_timer_presets for delete to authenticated
  using (user_id = (select auth.uid()));
