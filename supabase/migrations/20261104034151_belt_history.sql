-- =============================================================================
-- Kimi — Belt history
-- Every graduation is a row here; memberships.belt mirrors the latest one.
-- Classes toward the next belt count confirmed check-ins since the last
-- graduation (awarded_at); the overall total is shown separately.
--
-- Single write path: professors INSERT here and a trigger updates
-- memberships.belt. A guard rejects direct updates of memberships.belt, so the
-- history can never drift from the current belt.
-- =============================================================================

create table public.belt_history (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  belt text not null check (char_length(btrim(belt)) between 1 and 40),
  awarded_at timestamptz not null default now(),
  -- Set from the session by trigger, never from the client.
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index belt_history_membership_awarded_idx on public.belt_history (membership_id, awarded_at desc);
create index belt_history_awarded_by_idx on public.belt_history (awarded_by);

create trigger belt_history_set_updated_at before update on public.belt_history
  for each row execute function private.set_updated_at();

-- SECURITY INVOKER: runs as the professor, who already passes the INSERT policy.
create function private.stamp_belt_award()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.awarded_by := (select auth.uid());
  new.awarded_at := now();
  new.belt := btrim(new.belt);
  return new;
end;
$$;

-- SECURITY INVOKER: runs as the professor, who can update memberships of
-- their academy (policy "memberships: professor updates academy").
create function private.apply_belt_award()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.memberships set belt = new.belt where id = new.membership_id;
  return null;
end;
$$;

grant execute on function private.stamp_belt_award(), private.apply_belt_award() to authenticated;

create trigger belt_history_stamp before insert on public.belt_history
  for each row execute function private.stamp_belt_award();
create trigger belt_history_apply after insert on public.belt_history
  for each row execute function private.apply_belt_award();

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------
alter table public.belt_history enable row level security;

grant select on public.belt_history to authenticated;
grant insert (membership_id, belt) on public.belt_history to authenticated;

-- memberships.belt changes only through belt_history. The update(belt) column
-- grant stays (the trigger above runs as the professor), and this guard
-- rejects any belt change that does not come from inside a trigger.
create function private.guard_belt_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.belt is distinct from old.belt and pg_trigger_depth() < 2 then
    raise exception 'belt_via_history' using errcode = '42501';
  end if;
  return new;
end;
$$;

grant execute on function private.guard_belt_update() to authenticated;

create trigger memberships_guard_belt
  before update of belt on public.memberships
  for each row execute function private.guard_belt_update();

create policy "belt_history: own or professor of the academy reads"
  on public.belt_history for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and (m.user_id = (select auth.uid()) or private.is_professor(m.academy_id))
  ));

create policy "belt_history: professor of the academy awards"
  on public.belt_history for insert to authenticated
  with check (exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and m.status = 'active'
      and private.is_professor(m.academy_id)
  ));
