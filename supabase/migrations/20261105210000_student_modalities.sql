-- =============================================================================
-- Kimi — Students ↔ modalities
--
-- 1. student_modality_enrollments (created by the modality ranking) is THE link
--    between a student's membership and a modality: `active` or `ended`
--    (`suspended` is gone), with the start date of the current link.
--    An active student always has at least one active link (deferred check).
--    Ending a link keeps every check-in and belt of that modality.
-- 2. Competitor per modality: the invite / acceptance live on the link.
--    memberships.is_competitor becomes a cache = competes in ANY modality, so
--    water plans, diet and weight logs (one per athlete and academy) keep
--    their policies.
-- 3. Championships belong to a modality; only competitors of that modality
--    are entered.
-- 4. RLS: a student reads only the schedules of their modalities and checks in
--    only to their classes; staff mark attendance only for linked students.
-- 5. Weekly class goal per modality (owner) with a per-student override
--    (staff); the ranking facts now carry confirmed classes per day.
-- 6. Water plan days are a goal (reach it) or a limit (90–100 %).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The link
-- -----------------------------------------------------------------------------

-- `suspended` → `ended` (its active period is closed).
update private.modality_active_periods ap
set ends_at = greatest(now(), ap.starts_at)
from public.student_modality_enrollments e
where e.id = ap.enrollment_id and e.status = 'suspended' and ap.ends_at is null;
update public.student_modality_enrollments set status = 'ended', updated_at = now() where status = 'suspended';

alter table public.student_modality_enrollments
  drop constraint student_modality_enrollments_status_check,
  add constraint student_modality_enrollments_status_check check (status in ('active', 'ended'));

alter table public.student_modality_enrollments
  add column started_at timestamptz,
  add column weekly_class_goal smallint check (weekly_class_goal between 1 and 14),
  add column is_competitor boolean not null default false,
  add column competitor_since timestamptz,
  add column competitor_invited_at timestamptz,
  add column competitor_invited_by uuid references public.profiles (id) on delete set null;

update public.student_modality_enrollments e
set started_at = coalesce(
  (select max(ap.starts_at) from private.modality_active_periods ap where ap.enrollment_id = e.id),
  e.created_at);
alter table public.student_modality_enrollments
  alter column started_at set not null,
  alter column started_at set default now();

create index student_modality_enrollments_invited_by_idx on public.student_modality_enrollments (competitor_invited_by);

-- Weekly class goal of a modality (ranking presence).
alter table public.academy_modalities
  add column weekly_class_goal smallint not null default 2 check (weekly_class_goal between 1 and 14);
grant insert (weekly_class_goal), update (weekly_class_goal) on public.academy_modalities to authenticated;

-- An academy with active students or championships and no modality gets
-- "Geral" first, so every student can be linked and every championship has one.
insert into public.academy_modalities (academy_id, name, position)
select a.id, 'Geral', 0
from public.academies a
where not exists (select 1 from public.academy_modalities mo where mo.academy_id = a.id)
  and (exists (select 1 from public.memberships m where m.academy_id = a.id and m.role = 'student' and m.status = 'active')
    or exists (select 1 from public.championships c where c.academy_id = a.id));

-- Existing approved students: linked to every current modality of the academy,
-- since they joined the academy (their open membership period). Re-opens an
-- ended link with a new active period.
-- A re-opened link starts where its last period ended (no overlap, no gap
-- invented before it).
with reopened as (
  update public.student_modality_enrollments e
  set status = 'active', updated_at = now(),
      started_at = coalesce(
        (select max(ap.ends_at) from private.modality_active_periods ap where ap.enrollment_id = e.id),
        now())
  from public.memberships m
  where m.id = e.membership_id and m.role = 'student' and m.status = 'active' and e.status = 'ended'
  returning e.id, e.started_at
)
insert into private.modality_active_periods (enrollment_id, starts_at)
select id, started_at from reopened;

with since as (
  select m.id as membership_id, m.academy_id,
    coalesce(
      (select ap.starts_at from private.membership_active_periods ap
       where ap.membership_id = m.id and ap.ends_at is null order by ap.starts_at desc limit 1),
      m.decided_at, now()) as started_at
  from public.memberships m
  where m.role = 'student' and m.status = 'active'
), created as (
  insert into public.student_modality_enrollments (membership_id, modality_id, status, started_at, created_at)
  select s.membership_id, mo.id, 'active', s.started_at, s.started_at
  from since s
  join public.academy_modalities mo on mo.academy_id = s.academy_id
  on conflict (membership_id, modality_id) do nothing
  returning id, started_at
)
insert into private.modality_active_periods (enrollment_id, starts_at)
select id, started_at from created;

-- Current competitors compete in every linked modality; a pending invite is
-- copied to every link.
update public.student_modality_enrollments e
set is_competitor = true, competitor_since = coalesce(m.competitor_since, now())
from public.memberships m
where m.id = e.membership_id and m.is_competitor and e.status = 'active';
update public.student_modality_enrollments e
set competitor_invited_at = m.competitor_invited_at, competitor_invited_by = m.competitor_invited_by
from public.memberships m
where m.id = e.membership_id and m.competitor_invited_at is not null and e.status = 'active' and not e.is_competitor;

-- Every active student is linked now; fail loudly otherwise.
do $$
begin
  if exists (
    select 1 from public.memberships m
    where m.role = 'student' and m.status = 'active'
      and not exists (select 1 from public.student_modality_enrollments e where e.membership_id = m.id and e.status = 'active')
  ) then
    raise exception 'backfill left an active student without a modality';
  end if;
end $$;

alter table public.student_modality_enrollments
  add constraint student_modality_enrollments_competitor_since check ((competitor_since is not null) = is_competitor),
  add constraint student_modality_enrollments_competitor_active check (not is_competitor or status = 'active'),
  add constraint student_modality_enrollments_invite check (
    competitor_invited_at is null or (not is_competitor and status = 'active')
  );

-- Keeps competitor columns coherent whatever the write path.
create function private.normalize_enrollment_competitor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    new.is_competitor := false;
  end if;
  if not new.is_competitor then
    new.competitor_since := null;
  elsif new.competitor_since is null then
    new.competitor_since := now();
  end if;
  if new.is_competitor or new.status <> 'active' then
    new.competitor_invited_at := null;
    new.competitor_invited_by := null;
  end if;
  return new;
end;
$$;
revoke all on function private.normalize_enrollment_competitor() from public, anon;

create trigger student_modality_enrollments_normalize before insert or update on public.student_modality_enrollments
  for each row execute function private.normalize_enrollment_competitor();

-- memberships.is_competitor / competitor_since = competes in any modality.
create function private.sync_membership_competitor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid uuid := coalesce(new.membership_id, old.membership_id);
  v_since timestamptz;
begin
  select min(e.competitor_since) into v_since
  from public.student_modality_enrollments e
  where e.membership_id = v_mid and e.is_competitor;
  update public.memberships
  set is_competitor = v_since is not null,
      competitor_since = v_since,
      competitor_invited_at = null,
      competitor_invited_by = null
  where id = v_mid
    and (is_competitor is distinct from (v_since is not null)
      or competitor_since is distinct from v_since
      or competitor_invited_at is not null);
  return null;
end;
$$;
revoke all on function private.sync_membership_competitor() from public, anon;

create trigger student_modality_enrollments_sync_competitor
  after insert or delete or update of is_competitor, competitor_since, status on public.student_modality_enrollments
  for each row execute function private.sync_membership_competitor();

-- The cache starts in sync (invites now live on the links).
update public.memberships m
set is_competitor = x.since is not null, competitor_since = x.since,
    competitor_invited_at = null, competitor_invited_by = null
from (
  select m2.id, (select min(e.competitor_since) from public.student_modality_enrollments e
                 where e.membership_id = m2.id and e.is_competitor) as since
  from public.memberships m2
) x
where x.id = m.id
  and (m.is_competitor is distinct from (x.since is not null)
    or m.competitor_since is distinct from x.since
    or m.competitor_invited_at is not null);

-- A membership that stops being an active student ends its links.
create function private.end_enrollments_on_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'student' and old.status = 'active' and (new.status <> 'active' or new.role <> 'student') then
    update private.modality_active_periods ap
    set ends_at = greatest(now(), ap.starts_at)
    from public.student_modality_enrollments e
    where e.id = ap.enrollment_id and e.membership_id = new.id and e.status = 'active' and ap.ends_at is null;
    update public.student_modality_enrollments
    set status = 'ended', updated_at = now()
    where membership_id = new.id and status = 'active';
  end if;
  return null;
end;
$$;
revoke all on function private.end_enrollments_on_leave() from public, anon;

create trigger memberships_end_enrollments after update of status, role on public.memberships
  for each row execute function private.end_enrollments_on_leave();

-- An active student has at least one active link (checked at commit, so the
-- approval and a change of modalities can run in any order).
create function private.check_student_has_modality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid uuid;
begin
  if tg_table_name = 'memberships' then
    v_mid := new.id;
  else
    v_mid := coalesce(new.membership_id, old.membership_id);
  end if;
  if exists (select 1 from public.memberships m where m.id = v_mid and m.role = 'student' and m.status = 'active')
     and not exists (select 1 from public.student_modality_enrollments e where e.membership_id = v_mid and e.status = 'active')
  then
    raise exception 'student_modality_required' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function private.check_student_has_modality() from public, anon;

create constraint trigger memberships_student_needs_modality
  after insert or update of status, role on public.memberships
  deferrable initially deferred
  for each row execute function private.check_student_has_modality();
create constraint trigger enrollments_student_needs_modality
  after update of status or delete on public.student_modality_enrollments
  deferrable initially deferred
  for each row execute function private.check_student_has_modality();

-- Caller is an active student linked (active) to the modality.
create function private.is_enrolled_in_modality(p_modality_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_modality_enrollments e
    join public.memberships m on m.id = e.membership_id
    where e.modality_id = p_modality_id
      and e.status = 'active'
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'student'
  );
$$;
revoke all on function private.is_enrolled_in_modality(uuid) from public, anon;
grant execute on function private.is_enrolled_in_modality(uuid) to authenticated;

-- The athlete competes (accepted) in the modality.
create function private.competes_in_modality(p_athlete_id uuid, p_modality_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_modality_enrollments e
    join public.memberships m on m.id = e.membership_id
    where e.modality_id = p_modality_id
      and e.is_competitor
      and m.user_id = p_athlete_id
      and m.status = 'active'
      and m.role = 'student'
  );
$$;
revoke all on function private.competes_in_modality(uuid, uuid) from public, anon;
grant execute on function private.competes_in_modality(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs: approval and the modalities of a student (owner and instructors)
-- -----------------------------------------------------------------------------

-- Opens (or re-opens) the link of a membership to a modality.
create function private.activate_enrollment(p_membership_id uuid, p_modality_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.student_modality_enrollments;
begin
  select * into v_e from public.student_modality_enrollments
  where membership_id = p_membership_id and modality_id = p_modality_id for update;
  if v_e.id is null then
    insert into public.student_modality_enrollments (membership_id, modality_id, status, started_at)
    values (p_membership_id, p_modality_id, 'active', now())
    returning * into v_e;
    insert into private.modality_active_periods (enrollment_id, starts_at) values (v_e.id, now());
  elsif v_e.status <> 'active' then
    update public.student_modality_enrollments
    set status = 'active', started_at = now(), updated_at = now()
    where id = v_e.id;
    insert into private.modality_active_periods (enrollment_id, starts_at) values (v_e.id, now());
  end if;
end;
$$;
revoke all on function private.activate_enrollment(uuid, uuid) from public, anon;

-- Ends a link: history stays; future championship entries of the modality go.
create function private.end_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.student_modality_enrollments;
  v_m public.memberships;
begin
  select * into v_e from public.student_modality_enrollments where id = p_enrollment_id for update;
  if v_e.id is null or v_e.status <> 'active' then
    return;
  end if;
  select * into v_m from public.memberships where id = v_e.membership_id;
  update private.modality_active_periods
  set ends_at = greatest(now(), starts_at)
  where enrollment_id = v_e.id and ends_at is null;
  update public.student_modality_enrollments set status = 'ended', updated_at = now() where id = v_e.id;
  delete from public.championship_entries ce
  using public.championships c
  where ce.championship_id = c.id
    and c.modality_id = v_e.modality_id
    and ce.athlete_id = v_m.user_id
    and c.event_date >= private.academy_local_date(v_m.academy_id);
end;
$$;
revoke all on function private.end_enrollment(uuid) from public, anon;

-- Validates a set of modality ids for an academy (at least one, all its own).
create function private.valid_modality_set(p_academy_id uuid, p_modality_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_length(p_modality_ids, 1), 0) > 0
    and not exists (
      select 1 from unnest(p_modality_ids) x(id)
      where x.id is null or not exists (
        select 1 from public.academy_modalities mo where mo.id = x.id and mo.academy_id = p_academy_id
      )
    );
$$;
revoke all on function private.valid_modality_set(uuid, uuid[]) from public, anon;

-- Staff approve a pending STUDENT request with their modalities, in one go.
create function public.approve_student(p_membership_id uuid, p_modality_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.memberships;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_m.role <> 'student' or v_m.status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = '22023';
  end if;
  if not private.valid_modality_set(v_m.academy_id, p_modality_ids) then
    raise exception 'student_modality_required' using errcode = '22023';
  end if;

  update public.memberships
  set status = 'active', decided_by = v_uid, decided_at = now()
  where id = p_membership_id;
  foreach v_id in array (select array_agg(distinct x) from unnest(p_modality_ids) x) loop
    perform private.activate_enrollment(p_membership_id, v_id);
  end loop;
end;
$$;

-- Staff set the modalities of an active student (the whole set, at least one).
create function public.set_student_modalities(p_membership_id uuid, p_modality_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
  v_id uuid;
  v_e public.student_modality_enrollments;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_m.role <> 'student' or v_m.status <> 'active' then
    raise exception 'invalid_modality_enrollment' using errcode = '22023';
  end if;
  if not private.valid_modality_set(v_m.academy_id, p_modality_ids) then
    raise exception 'student_modality_required' using errcode = '22023';
  end if;

  foreach v_id in array (select array_agg(distinct x) from unnest(p_modality_ids) x) loop
    perform private.activate_enrollment(p_membership_id, v_id);
  end loop;
  for v_e in
    select * from public.student_modality_enrollments
    where membership_id = p_membership_id and status = 'active' and not (modality_id = any (p_modality_ids))
  loop
    perform private.end_enrollment(v_e.id);
  end loop;
end;
$$;

-- Staff set a weekly class goal for one student in one modality (null = the
-- modality's goal).
create function public.set_student_weekly_goal(p_membership_id uuid, p_modality_id uuid, p_goal smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_goal is not null and (p_goal < 1 or p_goal > 14) then
    raise exception 'weekly_goal_invalid' using errcode = '22023';
  end if;
  update public.student_modality_enrollments
  set weekly_class_goal = p_goal, updated_at = now()
  where membership_id = p_membership_id and modality_id = p_modality_id and status = 'active';
  if not found then
    raise exception 'invalid_modality_enrollment' using errcode = '22023';
  end if;
end;
$$;

-- The old per-status RPC (active / suspended / ended) is replaced by the set.
drop function public.set_student_modality_enrollment(uuid, uuid, text);

-- -----------------------------------------------------------------------------
-- 2. Competitor per modality
-- -----------------------------------------------------------------------------
drop function public.invite_competitor(uuid);
drop function public.respond_competitor_invite(uuid, boolean);
drop function public.remove_competitor(uuid);

-- Staff invite an active student to compete in one of their modalities.
create function public.invite_competitor(p_membership_id uuid, p_modality_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.memberships;
  v_e public.student_modality_enrollments;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_m.role <> 'student' or v_m.status <> 'active' then
    raise exception 'competitor_target_invalid' using errcode = '22023';
  end if;
  select * into v_e from public.student_modality_enrollments
  where membership_id = p_membership_id and modality_id = p_modality_id and status = 'active' for update;
  if v_e.id is null then
    raise exception 'competitor_target_invalid' using errcode = '22023';
  end if;
  if v_e.is_competitor then
    raise exception 'already_competitor' using errcode = '22023';
  end if;
  if v_e.competitor_invited_at is not null then
    return;
  end if;
  update public.student_modality_enrollments
  set competitor_invited_at = now(), competitor_invited_by = v_uid, updated_at = now()
  where id = v_e.id;
end;
$$;

-- The invited student accepts or declines the invite of one modality.
create function public.respond_competitor_invite(p_membership_id uuid, p_modality_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.memberships;
  v_e public.student_modality_enrollments;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null or v_m.user_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_e from public.student_modality_enrollments
  where membership_id = p_membership_id and modality_id = p_modality_id for update;
  if v_e.id is null or v_e.competitor_invited_at is null then
    raise exception 'competitor_invite_missing' using errcode = 'P0002';
  end if;
  if p_accept then
    update public.student_modality_enrollments set is_competitor = true, updated_at = now() where id = v_e.id;
  else
    update public.student_modality_enrollments
    set competitor_invited_at = null, competitor_invited_by = null, updated_at = now()
    where id = v_e.id;
  end if;
end;
$$;

-- Staff take a student off the team of one modality (or cancel the invite);
-- the student can also leave on their own. Future entries in championships of
-- that modality go; past ones stay as history.
create function public.remove_competitor(p_membership_id uuid, p_modality_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.memberships;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null or not (v_m.user_id = v_uid or private.is_staff(v_m.academy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.student_modality_enrollments
  set is_competitor = false, competitor_invited_at = null, competitor_invited_by = null, updated_at = now()
  where membership_id = p_membership_id and modality_id = p_modality_id;

  delete from public.championship_entries e
  using public.championships c
  where e.championship_id = c.id
    and c.modality_id = p_modality_id
    and e.academy_id = v_m.academy_id
    and e.athlete_id = v_m.user_id
    and c.event_date >= private.academy_local_date(v_m.academy_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Championships belong to a modality
-- -----------------------------------------------------------------------------
alter table public.championships add column modality_id uuid;

update public.championships c
set modality_id = (
  select mo.id from public.academy_modalities mo
  where mo.academy_id = c.academy_id
  order by mo.position, mo.created_at, mo.id
  limit 1
);

alter table public.championships
  alter column modality_id set not null,
  add constraint championships_modality_fkey foreign key (modality_id, academy_id)
    references public.academy_modalities (id, academy_id) on delete restrict;
create index championships_modality_idx on public.championships (modality_id);

-- Moving an upcoming championship to another modality drops entries of
-- athletes that do not compete in it.
create function private.championship_modality_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A past championship keeps its entries as history.
  if new.event_date < private.academy_local_date(new.academy_id) then
    return null;
  end if;
  delete from public.championship_entries e
  where e.championship_id = new.id
    and not private.competes_in_modality(e.athlete_id, new.modality_id);
  return null;
end;
$$;
revoke all on function private.championship_modality_changed() from public, anon;
create trigger championships_modality_changed after update of modality_id on public.championships
  for each row when (old.modality_id is distinct from new.modality_id)
  execute function private.championship_modality_changed();

-- Modality of a championship, read past RLS (entries never read championships
-- under RLS: championships' policy reads entries).
create function private.championship_modality(p_championship_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.modality_id from public.championships c where c.id = p_championship_id;
$$;
revoke all on function private.championship_modality(uuid) from public, anon;
grant execute on function private.championship_modality(uuid) to authenticated;

drop policy "championships: staff or entered competitor reads" on public.championships;
create policy "championships: staff or entered competitor of the modality reads"
  on public.championships for select to authenticated
  using (
    private.is_staff(academy_id)
    or (
      private.competes_in_modality((select auth.uid()), modality_id)
      and exists (
        select 1 from public.championship_entries e
        where e.championship_id = championships.id and e.athlete_id = (select auth.uid())
      )
    )
  );
drop policy "championships: staff inserts" on public.championships;
create policy "championships: staff inserts"
  on public.championships for insert to authenticated
  with check (private.is_staff(academy_id));

drop policy "championship_entries: staff or own competitor reads" on public.championship_entries;
create policy "championship_entries: staff or own competitor reads"
  on public.championship_entries for select to authenticated
  using (
    private.is_staff(academy_id)
    or (
      athlete_id = (select auth.uid())
      and private.competes_in_modality(athlete_id, private.championship_modality(championship_id))
    )
  );
drop policy "championship_entries: staff inserts" on public.championship_entries;
create policy "championship_entries: staff enters competitors of the modality"
  on public.championship_entries for insert to authenticated
  with check (
    private.is_staff(academy_id)
    and private.competes_in_modality(athlete_id, private.championship_modality(championship_id))
  );

-- -----------------------------------------------------------------------------
-- 4. Schedules and check-ins follow the student's modalities
-- -----------------------------------------------------------------------------
drop policy "class_schedules: members read" on public.class_schedules;
create policy "class_schedules: staff or linked students read"
  on public.class_schedules for select to authenticated
  using (private.is_staff(academy_id) or private.is_enrolled_in_modality(modality_id));

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
        and private.is_enrolled_in_modality(s.modality_id)
    )
  );

drop policy "checkins: staff marks attendance" on public.checkins;
create policy "checkins: staff marks attendance"
  on public.checkins for insert to authenticated
  with check (
    private.is_staff(academy_id)
    and marked_by = (select auth.uid())
    and status = 'confirmed'
    and user_id <> (select auth.uid())
    and class_date <= private.academy_local_date(academy_id)
    and exists (
      select 1
      from public.class_schedules s
      join public.memberships m
        on m.academy_id = s.academy_id and m.user_id = checkins.user_id
       and m.role = 'student' and m.status = 'active'
      join public.student_modality_enrollments e
        on e.membership_id = m.id and e.modality_id = s.modality_id and e.status = 'active'
      where s.id = checkins.schedule_id
        and s.academy_id = checkins.academy_id
        and s.weekday::numeric = extract(dow from checkins.class_date)
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Water plan days: goal or limit
-- -----------------------------------------------------------------------------
alter table public.water_plan_days add column is_limit boolean not null default false;
alter table private.water_plan_goal_history add column is_limit boolean not null default false;

create or replace function private.track_water_plan_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_plan uuid := coalesce(new.plan_id, old.plan_id); v_day date;
begin
  select greatest(p.week_start, private.academy_local_date(p.academy_id)) into v_day from public.water_plans p where p.id = v_plan;
  if v_day is not null then
    insert into private.water_plan_goal_history(plan_id, weekday, effective_on, target_ml, is_limit)
    values (v_plan, coalesce(new.weekday, old.weekday), v_day,
      case when tg_op = 'DELETE' then null else new.target_ml end,
      case when tg_op = 'DELETE' then false else new.is_limit end)
    on conflict(plan_id, weekday, effective_on)
      do update set target_ml = excluded.target_ml, is_limit = excluded.is_limit, recorded_at = now();
  end if;
  return null;
end $$;

-- Target of a day for the ranking: the plan in force (goal or limit), else the
-- automatic goal (always a goal).
create function private.ranking_water_target(p_user uuid, p_academy uuid, p_day date)
returns table (goal integer, is_limit boolean)
language sql
stable
security definer
set search_path = ''
as $$
 with plan_in_force as (
   select p.id from public.water_plans p
   where p.athlete_id=p_user and p.week_start<=p_day
     and exists(select 1 from private.water_plan_goal_history h where h.plan_id=p.id and h.effective_on<=p_day)
   order by p.week_start desc,
     (select max(h.recorded_at) from private.water_plan_goal_history h where h.plan_id=p.id and h.effective_on<=p_day) desc,
     p.id limit 1
 ), planned as (
   select h.target_ml, h.is_limit from private.water_plan_goal_history h join plan_in_force p on p.id=h.plan_id
   where h.weekday=extract(dow from p_day) and h.effective_on<=p_day order by h.effective_on desc limit 1
 ), auto_goal as (
   select h.goal_ml from private.water_auto_goal_history h where h.user_id=p_user and h.effective_on<=p_day order by h.effective_on desc limit 1
 )
 select
   coalesce(
     (select target_ml from planned),
     case when exists(select 1 from auto_goal) then (select goal_ml from auto_goal)
     else (select g.goal_ml from public.water_goal_days g where g.user_id=p_user and g.day=p_day) end),
   coalesce((select pl.is_limit from planned pl where pl.target_ml is not null), false);
$$;
revoke all on function private.ranking_water_target(uuid, uuid, date) from public, anon;

create or replace function private.ranking_water_goal(p_user uuid, p_academy uuid, p_day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select t.goal from private.ranking_water_target(p_user, p_academy, p_day) t;
$$;

drop function public.set_water_plan(uuid, uuid, integer[]);
create function public.set_water_plan(p_academy_id uuid, p_athlete_id uuid, p_targets integer[], p_limits boolean[] default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.academy_local_date(p_academy_id);
  v_week date;
  v_plan_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if coalesce(array_length(p_targets, 1), 0) <> 7
     or (p_limits is not null and coalesce(array_length(p_limits, 1), 0) <> 7) then
    raise exception 'water_plan_invalid' using errcode = '22023';
  end if;
  v_week := v_today - (extract(isodow from v_today)::int - 1);

  insert into public.water_plans (athlete_id, academy_id, week_start)
  values (p_athlete_id, p_academy_id, v_week)
  on conflict (athlete_id, academy_id, week_start) do update set updated_at = now()
  returning id into v_plan_id;

  delete from public.water_plan_days where plan_id = v_plan_id;
  insert into public.water_plan_days (plan_id, weekday, target_ml, is_limit)
  select v_plan_id, d - 1, p_targets[d], coalesce(p_limits[d], false)
  from generate_series(1, 7) d
  where p_targets[d] is not null;

  return v_plan_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Ranking facts: confirmed classes per eligible day + weekly goal
-- -----------------------------------------------------------------------------
-- attendance = one row per eligible day of the period: {day, classes}
--   (classes = confirmed check-ins of the modality that day). The weekly
--   presence (confirmed ÷ weekly goal, at most 100 %) is computed by
--   calculateRanking from these facts.
-- hydration  = as before; `done` follows the day's rule (goal: total ≥ goal;
--   limit: 90 % ≤ total ≤ 100 %). Volumes never leave the database.
drop function public.academy_ranking_facts(uuid, uuid, date, date);
create function public.academy_ranking_facts(
  p_academy_id  uuid,
  p_modality_id uuid,
  p_from        date,
  p_to          date
)
returns table (
  user_id     uuid,
  full_name   text,
  avatar_path text,
  modality_id uuid,
  today       date,
  period_from date,
  period_to   date,
  weekly_goal integer,
  attendance  jsonb,
  hydration   jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_today date:=private.academy_local_date(p_academy_id); v_tz text;
begin
  if not private.is_member(p_academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_to>=v_today or p_to-p_from>365 then raise exception 'invalid_ranking_period' using errcode='22023'; end if;
  if p_modality_id is null or not exists(select 1 from public.academy_modalities mo where mo.id=p_modality_id and mo.academy_id=p_academy_id) then raise exception 'invalid_ranking_modality' using errcode='22023'; end if;
  select a.timezone into v_tz from public.academies a where a.id=p_academy_id;
  if not private.is_staff(p_academy_id) and not exists(
    select 1 from public.student_modality_enrollments e join public.memberships m on m.id=e.membership_id
    where e.modality_id=p_modality_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='student'
      and private.modality_enrollment_visible(e.id,p_from,p_to,v_today,v_tz)
  ) then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  with students as (
    select m.id as membership_id,m.user_id as uid,p.full_name as name,p.avatar_path as photo,e.id as enrollment_id,
      coalesce(e.weekly_class_goal,mo.weekly_class_goal)::integer as goal
    from public.memberships m join public.profiles p on p.id=m.user_id
    join public.student_modality_enrollments e on e.membership_id=m.id and e.modality_id=p_modality_id
    join public.academy_modalities mo on mo.id=e.modality_id
    where m.academy_id=p_academy_id and m.role='student' and m.status='active' and p.show_in_ranking
      and private.modality_enrollment_visible(e.id,p_from,p_to,v_today,v_tz)
  ),
  eligible_days as (
    select st.uid,d.day::date as day from students st
    cross join lateral generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
    where exists(select 1 from private.membership_active_periods ap where ap.membership_id=st.membership_id
      and (ap.starts_at at time zone v_tz)::date<d.day::date and (ap.ends_at is null or (ap.ends_at at time zone v_tz)::date>d.day::date))
      and exists(select 1 from private.modality_active_periods ap where ap.enrollment_id=st.enrollment_id
      and (ap.starts_at at time zone v_tz)::date<d.day::date and (ap.ends_at is null or (ap.ends_at at time zone v_tz)::date>d.day::date))
  ),
  class_days as (
    select ed.uid,ed.day,(select count(*)::int from public.checkins c
      where c.user_id=ed.uid and c.academy_id=p_academy_id and c.modality_id=p_modality_id
        and c.class_date=ed.day and c.status='confirmed') as classes
    from eligible_days ed
  ),
  water_totals as (
    select w.user_id as uid,(w.logged_at at time zone v_tz)::date as day,sum(w.amount_ml) as total
    from public.water_logs w join students st on st.uid=w.user_id
    where w.logged_at<((p_to+1)::timestamp at time zone v_tz) group by 1,2
  ),
  water_days as (
    -- Global individual history, uncut by modality: the same water facts in
    -- every modality of the student.
    select st.uid,d.day::date as day,t.goal,
      case when t.is_limit then coalesce(w.total,0) between ceil(t.goal*0.9) and t.goal
           else coalesce(w.total,0)>=t.goal end as done,
      exists(select 1 from eligible_days ed where ed.uid=st.uid and ed.day=d.day::date) as eligible
    from students st cross join lateral generate_series(
      least((select min(h.effective_on) from private.water_auto_goal_history h where h.user_id=st.uid),
            (select min(g.day) from public.water_goal_days g where g.user_id=st.uid))::timestamp,
      p_to::timestamp,interval '1 day') d(day)
    cross join lateral private.ranking_water_target(st.uid,p_academy_id,d.day::date) t
    left join water_totals w on w.uid=st.uid and w.day=d.day::date
  )
  select st.uid,st.name,st.photo,p_modality_id,v_today,p_from,p_to,st.goal,
    coalesce((select jsonb_agg(jsonb_build_object('day',c.day,'classes',c.classes) order by c.day)
      from class_days c where c.uid=st.uid),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('day',w.day,'known',coalesce(w.goal between 1 and 20000,false),'done',coalesce(w.done,false),'eligible',w.eligible) order by w.day)
      from water_days w where w.uid=st.uid),'[]'::jsonb)
  from students st order by st.uid;
end $function$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function
  public.approve_student(uuid, uuid[]),
  public.set_student_modalities(uuid, uuid[]),
  public.set_student_weekly_goal(uuid, uuid, smallint),
  public.invite_competitor(uuid, uuid),
  public.respond_competitor_invite(uuid, uuid, boolean),
  public.remove_competitor(uuid, uuid),
  public.set_water_plan(uuid, uuid, integer[], boolean[]),
  public.academy_ranking_facts(uuid, uuid, date, date)
from public, anon;
grant execute on function
  public.approve_student(uuid, uuid[]),
  public.set_student_modalities(uuid, uuid[]),
  public.set_student_weekly_goal(uuid, uuid, smallint),
  public.invite_competitor(uuid, uuid),
  public.respond_competitor_invite(uuid, uuid, boolean),
  public.remove_competitor(uuid, uuid),
  public.set_water_plan(uuid, uuid, integer[], boolean[]),
  public.academy_ranking_facts(uuid, uuid, date, date)
to authenticated;
