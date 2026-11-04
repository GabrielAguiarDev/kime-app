-- =============================================================================
-- Kimi — Classes and check-ins
-- belt_goals, class_schedules, checkins.
-- Members (active) read; professors manage. Students create their own
-- check-ins, always pending; only a professor of the academy decides them.
-- =============================================================================

create table public.belt_goals (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  belt text not null check (char_length(btrim(belt)) between 1 and 40),
  position smallint not null check (position >= 0),
  classes_required integer not null check (classes_required > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, position),
  unique (academy_id, belt)
);

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday (same as extract(dow ...)).
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  modality text not null check (char_length(btrim(modality)) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite FK below.
  unique (id, academy_id)
);
create index class_schedules_academy_weekday_idx on public.class_schedules (academy_id, weekday);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  schedule_id uuid not null,
  class_date date not null,
  status public.checkin_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, schedule_id, class_date),
  -- academy_id always matches the class's academy.
  foreign key (schedule_id, academy_id)
    references public.class_schedules (id, academy_id) on delete cascade
);
create index checkins_academy_status_idx on public.checkins (academy_id, status, class_date);
create index checkins_schedule_academy_idx on public.checkins (schedule_id, academy_id);
create index checkins_reviewed_by_idx on public.checkins (reviewed_by);

create trigger belt_goals_set_updated_at before update on public.belt_goals
  for each row execute function private.set_updated_at();
create trigger class_schedules_set_updated_at before update on public.class_schedules
  for each row execute function private.set_updated_at();
create trigger checkins_set_updated_at before update on public.checkins
  for each row execute function private.set_updated_at();

-- Reviewer and timestamp come from the session, never from the client.
create function private.stamp_checkin_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'pending' then
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.reviewed_by := (select auth.uid());
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

grant execute on function private.stamp_checkin_review() to authenticated;

create trigger checkins_stamp_review before update on public.checkins
  for each row execute function private.stamp_checkin_review();

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------
alter table public.belt_goals enable row level security;
alter table public.class_schedules enable row level security;
alter table public.checkins enable row level security;

grant select, insert, update, delete on public.belt_goals, public.class_schedules to authenticated;

grant select, delete on public.checkins to authenticated;
-- No status / reviewer columns: a new check-in is always pending.
grant insert (id, user_id, academy_id, schedule_id, class_date) on public.checkins to authenticated;
-- Only the status is ever changed (by professors, see policy).
grant update (status) on public.checkins to authenticated;

-- belt_goals
create policy "belt_goals: members read"
  on public.belt_goals for select to authenticated
  using (private.is_member(academy_id));
create policy "belt_goals: professor inserts"
  on public.belt_goals for insert to authenticated
  with check (private.is_professor(academy_id));
create policy "belt_goals: professor updates"
  on public.belt_goals for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));
create policy "belt_goals: professor deletes"
  on public.belt_goals for delete to authenticated
  using (private.is_professor(academy_id));

-- class_schedules
create policy "class_schedules: members read"
  on public.class_schedules for select to authenticated
  using (private.is_member(academy_id));
create policy "class_schedules: professor inserts"
  on public.class_schedules for insert to authenticated
  with check (private.is_professor(academy_id));
create policy "class_schedules: professor updates"
  on public.class_schedules for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));
create policy "class_schedules: professor deletes"
  on public.class_schedules for delete to authenticated
  using (private.is_professor(academy_id));

-- checkins
create policy "checkins: read own or as professor"
  on public.checkins for select to authenticated
  using (user_id = (select auth.uid()) or private.is_professor(academy_id));

-- Own, pending, active member, on an active class of that academy whose
-- weekday matches the date.
create policy "checkins: member creates own pending"
  on public.checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.is_member(academy_id)
    and exists (
      select 1 from public.class_schedules s
      where s.id = schedule_id
        and s.academy_id = checkins.academy_id
        and s.active
        and s.weekday = extract(dow from class_date)
    )
  );

create policy "checkins: professor decides"
  on public.checkins for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));

create policy "checkins: delete own while pending"
  on public.checkins for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');
