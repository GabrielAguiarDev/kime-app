-- =============================================================================
-- Kimi — Staff restructure (professor / owner screens)
--
-- 1. "Marcar presença": owner and instructors register an attendance that is
--    already confirmed, for a student who forgot the check-in. RLS policy (no
--    SECURITY DEFINER): only staff, only active students of their own academy,
--    a class of the academy on the right weekday, today or a past day.
--    `marked_by` records who marked it; the existing unique key
--    (user_id, schedule_id, class_date) keeps it from duplicating.
-- 2. Timer presets: a preset may belong to a modality (Início / presence
--    "Timer" opens it), and only the owner saves presets (instructors use them
--    and adjust a session without saving).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Attendance marked by staff
-- -----------------------------------------------------------------------------
alter table public.checkins
  add column marked_by uuid references public.profiles (id) on delete set null;
create index checkins_marked_by_idx on public.checkins (marked_by);

-- status: staff insert it as confirmed; the student policy still requires pending.
grant insert (marked_by, status) on public.checkins to authenticated;

-- A confirmed insert is stamped like a decision; marked_by only by staff, as themselves.
create function private.stamp_checkin_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.marked_by is not null
     and (new.marked_by <> (select auth.uid()) or not private.is_staff(new.academy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new.status <> 'pending' then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_checkin_insert() from public, anon;
grant execute on function private.stamp_checkin_insert() to authenticated;

create trigger checkins_stamp_insert before insert on public.checkins
  for each row execute function private.stamp_checkin_insert();

create policy "checkins: staff marks attendance"
  on public.checkins for insert to authenticated
  with check (
    private.is_staff(academy_id)
    and marked_by = (select auth.uid())
    and status = 'confirmed'
    and user_id <> (select auth.uid())
    and class_date <= private.academy_local_date(academy_id)
    and exists (
      select 1 from public.memberships m
      where m.academy_id = checkins.academy_id
        and m.user_id = checkins.user_id
        and m.role = 'student'
        and m.status = 'active'
    )
    and exists (
      select 1 from public.class_schedules s
      where s.id = checkins.schedule_id
        and s.academy_id = checkins.academy_id
        and s.weekday::numeric = extract(dow from checkins.class_date)
    )
  );

-- Students never set marked_by themselves (the trigger also refuses it).
drop policy "checkins: student creates own pending for today" on public.checkins;
create policy "checkins: student creates own pending for today"
  on public.checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and marked_by is null
    and private.is_student(academy_id)
    and class_date = private.academy_local_date(academy_id)
    and exists (
      select 1 from public.class_schedules s
      where s.id = checkins.schedule_id
        and s.academy_id = checkins.academy_id
        and s.active
        and s.weekday::numeric = extract(dow from checkins.class_date)
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Timer presets: modality, owner writes
-- -----------------------------------------------------------------------------
alter table public.timer_presets
  add column modality_id uuid references public.academy_modalities (id) on delete set null;
create index timer_presets_modality_idx on public.timer_presets (modality_id);
-- One preset per modality.
create unique index timer_presets_one_per_modality_idx on public.timer_presets (modality_id) where modality_id is not null;

grant insert (modality_id), update (modality_id) on public.timer_presets to authenticated;

drop policy "timer_presets: staff insert" on public.timer_presets;
drop policy "timer_presets: staff update" on public.timer_presets;
drop policy "timer_presets: staff delete" on public.timer_presets;
create policy "timer_presets: owner inserts"
  on public.timer_presets for insert to authenticated
  with check (
    private.is_owner(academy_id)
    and created_by = (select auth.uid())
    and (modality_id is null or exists (
      select 1 from public.academy_modalities m where m.id = modality_id and m.academy_id = timer_presets.academy_id
    ))
  );
create policy "timer_presets: owner updates"
  on public.timer_presets for update to authenticated
  using (private.is_owner(academy_id))
  with check (
    private.is_owner(academy_id)
    and (modality_id is null or exists (
      select 1 from public.academy_modalities m where m.id = modality_id and m.academy_id = timer_presets.academy_id
    ))
  );
create policy "timer_presets: owner deletes"
  on public.timer_presets for delete to authenticated
  using (private.is_owner(academy_id));
