-- =============================================================================
-- Kimi — Who taught each class
--
-- class_sessions: one row per class actually given (schedule + date). It is
-- created by the database when the FIRST check-in of that class is confirmed,
-- with the academy's owner as the instructor (default). Staff can then switch
-- the instructor to another active owner/instructor of the academy (the field
-- shows in Confirmações once the class's check-ins are all decided).
--
-- instructor_class_stats (security_invoker, staff only): classes taught per
-- owner/instructor membership = sessions where they are the instructor.
-- A session keeps counting after its schedule is deleted (schedule_id → null).
-- =============================================================================

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  schedule_id uuid,
  class_date date not null,
  modality_id uuid references public.academy_modalities (id) on delete set null,
  instructor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deleting the schedule keeps the session (and the count), like check-ins.
  foreign key (schedule_id, academy_id)
    references public.class_schedules (id, academy_id) on delete set null (schedule_id),
  unique (schedule_id, class_date)
);
create index class_sessions_academy_date_idx on public.class_sessions (academy_id, class_date);
create index class_sessions_academy_instructor_idx on public.class_sessions (academy_id, instructor_id);
create index class_sessions_instructor_idx on public.class_sessions (instructor_id);
create index class_sessions_modality_idx on public.class_sessions (modality_id);

create trigger class_sessions_set_updated_at before update on public.class_sessions
  for each row execute function private.set_updated_at();

-- The instructor must be an active owner/instructor of the same academy.
-- SECURITY INVOKER: staff read their academy's memberships.
create function private.guard_session_instructor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.instructor_id is distinct from old.instructor_id and not exists (
    select 1 from public.memberships m
    where m.academy_id = new.academy_id
      and m.user_id = new.instructor_id
      and m.status = 'active'
      and m.role in ('owner', 'instructor')
  ) then
    raise exception 'instructor_invalid' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_session_instructor() from public, anon;
grant execute on function private.guard_session_instructor() to authenticated;

create trigger class_sessions_guard_instructor before update of instructor_id on public.class_sessions
  for each row execute function private.guard_session_instructor();

-- Creates the session when a check-in becomes confirmed (no-op if it exists).
-- SECURITY DEFINER: clients have no INSERT on class_sessions; the row is
-- derived from the confirmed check-in (academy, schedule, date, modality) and
-- the academy's current owner. Runs only from the checkins trigger.
create function private.ensure_class_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and new.schedule_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.class_sessions (academy_id, schedule_id, class_date, modality_id, instructor_id)
    values (
      new.academy_id,
      new.schedule_id,
      new.class_date,
      new.modality_id,
      (select m.user_id from public.memberships m where m.academy_id = new.academy_id and m.role = 'owner')
    )
    on conflict (schedule_id, class_date) do nothing;
  end if;
  return null;
end;
$$;

revoke all on function private.ensure_class_session() from public, anon, authenticated;

create trigger checkins_ensure_session after insert or update of status on public.checkins
  for each row execute function private.ensure_class_session();

-- Existing confirmed classes: sessions with the current owner.
insert into public.class_sessions (academy_id, schedule_id, class_date, modality_id, instructor_id)
select distinct on (c.schedule_id, c.class_date)
  c.academy_id, c.schedule_id, c.class_date, c.modality_id,
  (select m.user_id from public.memberships m where m.academy_id = c.academy_id and m.role = 'owner')
from public.checkins c
where c.status = 'confirmed' and c.schedule_id is not null
order by c.schedule_id, c.class_date
on conflict (schedule_id, class_date) do nothing;

-- -----------------------------------------------------------------------------
-- Access: staff read and switch the instructor; nobody else.
-- -----------------------------------------------------------------------------
alter table public.class_sessions enable row level security;

grant select on public.class_sessions to authenticated;
grant update (instructor_id) on public.class_sessions to authenticated;

create policy "class_sessions: staff reads"
  on public.class_sessions for select to authenticated
  using (private.is_staff(academy_id));

create policy "class_sessions: staff sets the instructor"
  on public.class_sessions for update to authenticated
  using (private.is_staff(academy_id))
  with check (private.is_staff(academy_id));

create view public.instructor_class_stats
with (security_invoker = true)
as
select
  m.id as membership_id,
  m.academy_id,
  m.user_id,
  count(s.id)::int as classes_taught
from public.memberships m
left join public.class_sessions s on s.academy_id = m.academy_id and s.instructor_id = m.user_id
where m.role in ('owner', 'instructor') and m.status = 'active'
group by m.id, m.academy_id, m.user_id;

revoke all on public.instructor_class_stats from anon, authenticated;
grant select on public.instructor_class_stats to authenticated;
