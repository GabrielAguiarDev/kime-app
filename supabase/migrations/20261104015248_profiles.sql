-- =============================================================================
-- Kimi — Profiles
-- One profile per auth user, created by a trigger on sign-up.
-- Read policies for professors live in the academies migration (they need the
-- membership helpers).
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  weight_kg numeric(5, 2) check (weight_kg > 0 and weight_kg < 400),
  height_cm numeric(5, 1) check (height_cm > 0 and height_cm < 300),
  -- Null until the user sets up their bottle.
  bottle_ml integer check (bottle_ml between 50 and 5000),
  timezone text not null default 'America/Sao_Paulo'
    check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sign-up bootstrap.
-- SECURITY DEFINER: runs inside GoTrue's insert on auth.users, where the
-- caller has no privilege on public.profiles. It only ever inserts the row of
-- the user being created (new.id). The name comes from the user's own sign-up
-- metadata and is used only as display text, never for authorization.
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(btrim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), 120)
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
grant update (full_name, weight_kg, height_cm, bottle_ml, timezone)
  on public.profiles to authenticated;

-- SELECT policy ("own or professor of the member") is created in the
-- academies migration, which defines the membership helpers.

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
