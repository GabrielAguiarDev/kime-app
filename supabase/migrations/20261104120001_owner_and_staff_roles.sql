-- =============================================================================
-- Kimi — Owner × professor
--
-- Roles per membership: owner (exactly one per academy), professor, student.
--
--   staff (owner or professor): confirm check-ins, approve STUDENT requests,
--     class schedules, belts of the students, competitors, championships,
--     water and diet plans.
--   owner only: remove members, invite / approve / remove professors, academy
--     settings (name, logo, timezone, invite codes, modalities, belt goals),
--     and — when they exist — monthly fees and subscription.
--
-- Two helpers carry every rule: private.is_owner(academy) and
-- private.is_staff(academy). private.is_professor is dropped at the end, so
-- no policy can keep using the old "any professor" rule by accident.
--
-- Invariants enforced by the database:
--   * at most one owner per academy (partial unique index);
--   * at least one owner per academy (deferred constraint triggers: checked
--     at commit, so a transfer can demote and promote in one transaction);
--   * the owner is always active;
--   * role never changes through the API (no column grant): only
--     transfer_ownership() and the join flow change it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Data: the creator of each academy becomes its owner.
-- -----------------------------------------------------------------------------
-- Runs as postgres: the membership guard trigger lets internal flows through.
update public.memberships m
set role = 'owner'
from public.academies a
where a.id = m.academy_id
  and m.user_id = a.created_by
  and m.role = 'professor'
  and m.status = 'active';

-- Academies whose creator is gone (profile deleted): the oldest active
-- professor takes over.
update public.memberships m
set role = 'owner'
where m.id in (
  select distinct on (p.academy_id) p.id
  from public.memberships p
  where p.role = 'professor'
    and p.status = 'active'
    and not exists (
      select 1 from public.memberships o
      where o.academy_id = p.academy_id and o.role = 'owner'
    )
  order by p.academy_id, p.created_at
);

do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
  from public.academies a
  where not exists (
    select 1 from public.memberships m
    where m.academy_id = a.id and m.role = 'owner' and m.status = 'active'
  );
  if v_orphans > 0 then
    raise exception 'owner migration: % academies without an active professor to become owner', v_orphans;
  end if;
end;
$$;

-- `created_by` is history only (who created the academy). Authorization reads
-- the owner from memberships, so a transfer does not touch it.
comment on column public.academies.created_by is
  'Who created the academy (history). The current owner is the membership with role = owner.';

-- -----------------------------------------------------------------------------
-- 2. Owner invariants
-- -----------------------------------------------------------------------------
alter table public.memberships
  add constraint memberships_owner_is_active check (role <> 'owner' or status = 'active');

create unique index memberships_one_owner_idx
  on public.memberships (academy_id) where role = 'owner';

-- SECURITY DEFINER: runs at commit for whoever changed the row (e.g. a
-- student leaving), and RLS would hide the owner's row from them.
create function private.assert_academy_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- jsonb: the two tables' records have different fields.
  v_academy_id uuid := case when tg_table_name = 'academies'
    then (to_jsonb(new) ->> 'id')::uuid
    else (to_jsonb(old) ->> 'academy_id')::uuid end;
begin
  if exists (select 1 from public.academies a where a.id = v_academy_id)
     and not exists (
       select 1 from public.memberships m
       where m.academy_id = v_academy_id and m.role = 'owner' and m.status = 'active'
     ) then
    raise exception 'academy_needs_owner' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function private.assert_academy_has_owner() from public, anon, authenticated;

-- A new academy must have its owner by the end of the transaction.
create constraint trigger academies_need_owner
  after insert on public.academies
  deferrable initially deferred
  for each row execute function private.assert_academy_has_owner();

-- The owner row cannot be demoted or deleted unless another one takes over in
-- the same transaction. Deleting the whole academy is fine (cascade).
create constraint trigger memberships_keep_owner
  after update or delete on public.memberships
  deferrable initially deferred
  for each row when (old.role = 'owner')
  execute function private.assert_academy_has_owner();

-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------
-- Caller is the active owner of the academy.
create function private.is_owner(p_academy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

-- Caller is active staff (owner or professor) of the academy.
create function private.is_staff(p_academy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'professor')
  );
$$;

revoke all on function private.is_owner(uuid), private.is_staff(uuid) from public, anon;
grant execute on function private.is_owner(uuid), private.is_staff(uuid) to authenticated;

-- The "of member / of competitor" helpers: renamed (policies follow the
-- function, not its name) and widened from professor to staff.
alter function private.is_professor_of_member(uuid) rename to is_staff_of_member;
alter function private.is_professor_of_competitor(uuid) rename to is_staff_of_competitor;

-- Caller is active staff of an academy the user belongs to or asks to join.
-- A professor only reaches students and active staff; someone asking to join
-- as professor is visible to the owner only.
create or replace function private.is_staff_of_member(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role in ('owner', 'professor')
      and target.user_id = p_user_id
      and target.status in ('pending', 'active')
      and (viewer.role = 'owner' or target.role = 'student' or target.status = 'active')
  );
$$;

-- Caller is active staff of an academy where the athlete is an active competitor.
create or replace function private.is_staff_of_competitor(p_athlete_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships athlete on athlete.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role in ('owner', 'professor')
      and athlete.user_id = p_athlete_id
      and athlete.status = 'active'
      and athlete.is_competitor
  );
$$;

-- The athlete is an active competitor of the academy AND the caller is that
-- athlete or active staff of the academy.
create or replace function private.is_competitor_of(p_athlete_id uuid, p_academy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships athlete
    where athlete.academy_id = p_academy_id
      and athlete.user_id = p_athlete_id
      and athlete.status = 'active'
      and athlete.is_competitor
  )
  and (
    p_athlete_id = (select auth.uid())
    or exists (
      select 1 from public.memberships viewer
      where viewer.academy_id = p_academy_id
        and viewer.user_id = (select auth.uid())
        and viewer.status = 'active'
        and viewer.role in ('owner', 'professor')
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. Membership writes
-- -----------------------------------------------------------------------------
-- role changes only through SECURITY DEFINER flows (join, transfer).
revoke update on public.memberships from authenticated;
grant update (is_competitor, belt, status) on public.memberships to authenticated;

-- SECURITY INVOKER: the transitions the grants and policies cannot express.
create or replace function private.guard_membership_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Internal flows (SECURITY DEFINER RPCs) run as postgres.
  if current_user = 'postgres' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'cannot_change_role' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status = 'pending' then
      raise exception 'membership_not_pending' using errcode = '22023';
    end if;
    new.decided_by := (select auth.uid());
    new.decided_at := now();
  end if;
  return new;
end;
$$;

-- Rewrite the membership policies.
drop policy "memberships: read own or as professor" on public.memberships;
drop policy "memberships: professor updates academy" on public.memberships;
drop policy "memberships: professor removes academy members" on public.memberships;

-- Staff read students and active staff; pending/rejected PROFESSOR requests
-- are the owner's business only (the owner decides them).
create policy "memberships: read own, as owner, or as staff"
  on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_owner(academy_id)
    or (private.is_staff(academy_id) and (role = 'student' or status = 'active'))
  );

-- Staff: students only (approve requests, competitor flag, belt via history).
create policy "memberships: staff updates students"
  on public.memberships for update to authenticated
  using (role = 'student' and private.is_staff(academy_id))
  with check (role = 'student' and private.is_staff(academy_id));

-- Owner: everyone, including professor requests.
create policy "memberships: owner updates"
  on public.memberships for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

-- Owner removes students and professors; never themselves (see transfer).
create policy "memberships: owner removes members"
  on public.memberships for delete to authenticated
  using (private.is_owner(academy_id) and user_id <> (select auth.uid()) and role <> 'owner');

-- Anyone but the owner may leave (or cancel their own request).
create policy "memberships: member leaves"
  on public.memberships for delete to authenticated
  using (user_id = (select auth.uid()) and role <> 'owner');

-- -----------------------------------------------------------------------------
-- 5. Academy-scoped policies
-- -----------------------------------------------------------------------------
-- academies: settings are owner-only.
drop policy "academies: professor updates" on public.academies;
create policy "academies: owner updates"
  on public.academies for update to authenticated
  using (private.is_owner(id))
  with check (private.is_owner(id));

-- academy_invites (links): owner-only. Replaced by codes in the next migration.
drop policy "academy_invites: professor reads" on public.academy_invites;
drop policy "academy_invites: professor creates" on public.academy_invites;
drop policy "academy_invites: professor revokes" on public.academy_invites;
create policy "academy_invites: owner reads"
  on public.academy_invites for select to authenticated
  using (private.is_owner(academy_id));
create policy "academy_invites: owner creates"
  on public.academy_invites for insert to authenticated
  with check (private.is_owner(academy_id) and created_by = (select auth.uid()));
create policy "academy_invites: owner revokes"
  on public.academy_invites for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

-- academy_modalities: part of the academy settings → owner.
drop policy "academy_modalities: professor inserts" on public.academy_modalities;
drop policy "academy_modalities: professor updates" on public.academy_modalities;
drop policy "academy_modalities: professor deletes" on public.academy_modalities;
create policy "academy_modalities: owner inserts"
  on public.academy_modalities for insert to authenticated
  with check (private.is_owner(academy_id));
create policy "academy_modalities: owner updates"
  on public.academy_modalities for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));
create policy "academy_modalities: owner deletes"
  on public.academy_modalities for delete to authenticated
  using (private.is_owner(academy_id));

-- belt_goals: goals per belt are academy settings → owner.
drop policy "belt_goals: professor inserts" on public.belt_goals;
drop policy "belt_goals: professor updates" on public.belt_goals;
drop policy "belt_goals: professor deletes" on public.belt_goals;
create policy "belt_goals: owner inserts"
  on public.belt_goals for insert to authenticated
  with check (private.is_owner(academy_id));
create policy "belt_goals: owner updates"
  on public.belt_goals for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));
create policy "belt_goals: owner deletes"
  on public.belt_goals for delete to authenticated
  using (private.is_owner(academy_id));

-- class_schedules: staff.
drop policy "class_schedules: professor inserts" on public.class_schedules;
drop policy "class_schedules: professor updates" on public.class_schedules;
drop policy "class_schedules: professor deletes" on public.class_schedules;
create policy "class_schedules: staff inserts"
  on public.class_schedules for insert to authenticated
  with check (private.is_staff(academy_id));
create policy "class_schedules: staff updates"
  on public.class_schedules for update to authenticated
  using (private.is_staff(academy_id))
  with check (private.is_staff(academy_id));
create policy "class_schedules: staff deletes"
  on public.class_schedules for delete to authenticated
  using (private.is_staff(academy_id));

-- checkins: staff reads and decides.
drop policy "checkins: read own or as professor" on public.checkins;
drop policy "checkins: professor decides" on public.checkins;
create policy "checkins: read own or as staff"
  on public.checkins for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(academy_id));
-- Never one's own check-in: staff train too, and would inflate their own count.
create policy "checkins: staff decides others"
  on public.checkins for update to authenticated
  using (private.is_staff(academy_id) and user_id <> (select auth.uid()))
  with check (private.is_staff(academy_id) and user_id <> (select auth.uid()));

-- belt_history: staff award students' belts; the owner also awards professors'.
drop policy "belt_history: own or professor of the academy reads" on public.belt_history;
drop policy "belt_history: professor of the academy awards" on public.belt_history;
create policy "belt_history: own or staff reads"
  on public.belt_history for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and (m.user_id = (select auth.uid()) or private.is_staff(m.academy_id))
  ));
create policy "belt_history: staff awards students, owner awards anyone"
  on public.belt_history for insert to authenticated
  with check (exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and m.status = 'active'
      and (
        private.is_owner(m.academy_id)
        or (m.role = 'student' and private.is_staff(m.academy_id))
      )
  ));

-- water_plans / water_plan_days: staff.
drop policy "water_plans: competitor reads own, professor reads competitors" on public.water_plans;
drop policy "water_plans: professor inserts" on public.water_plans;
drop policy "water_plans: professor updates" on public.water_plans;
drop policy "water_plans: professor deletes" on public.water_plans;
create policy "water_plans: competitor reads own, staff reads competitors"
  on public.water_plans for select to authenticated
  using (
    (athlete_id = (select auth.uid()) or private.is_staff(academy_id))
    and private.is_competitor_of(athlete_id, academy_id)
  );
create policy "water_plans: staff inserts"
  on public.water_plans for insert to authenticated
  with check (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "water_plans: staff updates"
  on public.water_plans for update to authenticated
  using (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id))
  with check (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "water_plans: staff deletes"
  on public.water_plans for delete to authenticated
  using (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));

drop policy "water_plan_days: read with plan" on public.water_plan_days;
drop policy "water_plan_days: professor inserts" on public.water_plan_days;
drop policy "water_plan_days: professor updates" on public.water_plan_days;
drop policy "water_plan_days: professor deletes" on public.water_plan_days;
create policy "water_plan_days: read with plan"
  on public.water_plan_days for select to authenticated
  using (exists (
    select 1 from public.water_plans p
    where p.id = plan_id
      and (p.athlete_id = (select auth.uid()) or private.is_staff(p.academy_id))
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "water_plan_days: staff inserts"
  on public.water_plan_days for insert to authenticated
  with check (exists (
    select 1 from public.water_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "water_plan_days: staff updates"
  on public.water_plan_days for update to authenticated
  using (exists (
    select 1 from public.water_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ))
  with check (exists (
    select 1 from public.water_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "water_plan_days: staff deletes"
  on public.water_plan_days for delete to authenticated
  using (exists (
    select 1 from public.water_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));

-- diet_plans / diet_plan_meals: staff.
drop policy "diet_plans: competitor reads own, professor reads competitors" on public.diet_plans;
drop policy "diet_plans: professor inserts" on public.diet_plans;
drop policy "diet_plans: professor updates" on public.diet_plans;
drop policy "diet_plans: professor deletes" on public.diet_plans;
create policy "diet_plans: competitor reads own, staff reads competitors"
  on public.diet_plans for select to authenticated
  using (
    (athlete_id = (select auth.uid()) or private.is_staff(academy_id))
    and private.is_competitor_of(athlete_id, academy_id)
  );
create policy "diet_plans: staff inserts"
  on public.diet_plans for insert to authenticated
  with check (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "diet_plans: staff updates"
  on public.diet_plans for update to authenticated
  using (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id))
  with check (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "diet_plans: staff deletes"
  on public.diet_plans for delete to authenticated
  using (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));

drop policy "diet_plan_meals: read with plan" on public.diet_plan_meals;
drop policy "diet_plan_meals: professor inserts" on public.diet_plan_meals;
drop policy "diet_plan_meals: professor updates" on public.diet_plan_meals;
drop policy "diet_plan_meals: professor deletes" on public.diet_plan_meals;
create policy "diet_plan_meals: read with plan"
  on public.diet_plan_meals for select to authenticated
  using (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and (p.athlete_id = (select auth.uid()) or private.is_staff(p.academy_id))
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "diet_plan_meals: staff inserts"
  on public.diet_plan_meals for insert to authenticated
  with check (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "diet_plan_meals: staff updates"
  on public.diet_plan_meals for update to authenticated
  using (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ))
  with check (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));
create policy "diet_plan_meals: staff deletes"
  on public.diet_plan_meals for delete to authenticated
  using (exists (
    select 1 from public.diet_plans p
    where p.id = plan_id
      and private.is_staff(p.academy_id)
      and private.is_competitor_of(p.athlete_id, p.academy_id)
  ));

-- championships / championship_entries: staff.
drop policy "championships: professor or entered competitor reads" on public.championships;
drop policy "championships: professor inserts" on public.championships;
drop policy "championships: professor updates" on public.championships;
drop policy "championships: professor deletes" on public.championships;
drop policy "championship_entries: professor or own competitor reads" on public.championship_entries;
drop policy "championship_entries: professor inserts" on public.championship_entries;
drop policy "championship_entries: professor deletes" on public.championship_entries;
create policy "championships: staff or entered competitor reads"
  on public.championships for select to authenticated
  using (
    private.is_staff(academy_id)
    or (
      private.is_competitor_of((select auth.uid()), academy_id)
      and exists (
        select 1 from public.championship_entries e
        where e.championship_id = championships.id and e.athlete_id = (select auth.uid())
      )
    )
  );
create policy "championships: staff inserts"
  on public.championships for insert to authenticated
  with check (private.is_staff(academy_id));
create policy "championships: staff updates"
  on public.championships for update to authenticated
  using (private.is_staff(academy_id))
  with check (private.is_staff(academy_id));
create policy "championships: staff deletes"
  on public.championships for delete to authenticated
  using (private.is_staff(academy_id));

create policy "championship_entries: staff or own competitor reads"
  on public.championship_entries for select to authenticated
  using (
    private.is_staff(academy_id)
    or (athlete_id = (select auth.uid()) and private.is_competitor_of(athlete_id, academy_id))
  );
create policy "championship_entries: staff inserts"
  on public.championship_entries for insert to authenticated
  with check (private.is_staff(academy_id) and private.is_competitor_of(athlete_id, academy_id));
create policy "championship_entries: staff deletes"
  on public.championship_entries for delete to authenticated
  using (private.is_staff(academy_id));

-- Storage: the logo is an academy setting → owner.
drop policy "academy-logos: professor reads own academy objects" on storage.objects;
drop policy "academy-logos: professor uploads" on storage.objects;
drop policy "academy-logos: professor replaces" on storage.objects;
drop policy "academy-logos: professor deletes" on storage.objects;
create policy "academy-logos: owner reads own academy objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'academy-logos' and private.is_owner(private.academy_id_from_storage_path(name)));
create policy "academy-logos: owner uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'academy-logos' and private.is_owner(private.academy_id_from_storage_path(name)));
create policy "academy-logos: owner replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'academy-logos' and private.is_owner(private.academy_id_from_storage_path(name)))
  with check (bucket_id = 'academy-logos' and private.is_owner(private.academy_id_from_storage_path(name)));
create policy "academy-logos: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'academy-logos' and private.is_owner(private.academy_id_from_storage_path(name)));

-- -----------------------------------------------------------------------------
-- 6. RPCs
-- -----------------------------------------------------------------------------
-- create_academy: the creator is the OWNER. Same body otherwise.
create or replace function public.create_academy(p_name text, p_modalities text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_academy_id uuid;
  v_modalities text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_academy_name' using errcode = '22023';
  end if;

  -- Trimmed, non-empty, deduplicated case-insensitively, first spelling wins, order kept.
  select coalesce(array_agg(m.name order by m.first_ord), '{}')
  into v_modalities
  from (
    select distinct on (lower(btrim(u.name))) btrim(u.name) as name, u.ord as first_ord
    from unnest(coalesce(p_modalities, '{}')) with ordinality as u (name, ord)
    where btrim(u.name) <> ''
    order by lower(btrim(u.name)), u.ord
  ) m;

  if cardinality(v_modalities) not between 1 and 20
     or exists (select 1 from unnest(v_modalities) n where char_length(n) > 60) then
    raise exception 'invalid_modalities' using errcode = '22023';
  end if;

  insert into public.academies (name, created_by)
  values (v_name, v_uid)
  returning id into v_academy_id;

  insert into public.memberships (academy_id, user_id, role, status, decided_by, decided_at)
  values (v_academy_id, v_uid, 'owner', 'active', v_uid, now());

  insert into public.academy_invites (academy_id, role, created_by)
  values (v_academy_id, 'student', v_uid), (v_academy_id, 'professor', v_uid);

  insert into public.academy_modalities (academy_id, name, position)
  select v_academy_id, n, (ord - 1)::smallint
  from unnest(v_modalities) with ordinality as t (n, ord);

  return v_academy_id;
end;
$$;

-- list_pending_requests: staff see student requests; professor requests only
-- reach the owner (only the owner approves them).
create or replace function public.list_pending_requests(p_academy_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role public.membership_role,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner boolean;
begin
  if (select auth.uid()) is null or not private.is_staff(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_owner := private.is_owner(p_academy_id);
  return query
    select m.id, m.user_id, p.full_name, u.email::text, m.role, m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.academy_id = p_academy_id
      and m.status = 'pending'
      and (m.role = 'student' or v_owner)
    order by m.created_at;
end;
$$;

-- SECURITY DEFINER: role has no column grant (no policy could express "swap
-- the owner"). The caller must be the owner; the target an ACTIVE PROFESSOR
-- of the same academy. The old owner becomes a professor. The academy row is
-- locked so two transfers cannot interleave.
create function public.transfer_ownership(p_academy_id uuid, p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform 1 from public.academies where id = p_academy_id for update;
  if not private.is_owner(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from public.memberships
  where id = p_membership_id
    and academy_id = p_academy_id
    and role = 'professor'
    and status = 'active'
    and user_id <> v_uid
  for update;
  if not found then
    raise exception 'transfer_target_invalid' using errcode = '22023';
  end if;

  -- Demote first: the one-owner index is immediate.
  update public.memberships set role = 'professor'
  where academy_id = p_academy_id and user_id = v_uid and role = 'owner';
  update public.memberships set role = 'owner'
  where id = p_membership_id;
end;
$$;

revoke all on function public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. The old helper goes away (fails if any policy still used it).
-- -----------------------------------------------------------------------------
drop function private.is_professor(uuid);
