-- =============================================================================
-- Kimi — Instructor profile (owner / instructor seen by the academy)
--
--   class_schedules.instructor_id  who gives the class (optional); an active
--                                  owner/instructor of the same academy
--   instructor_profiles            per person: short bio, Instagram, WhatsApp
--                                  and "show contacts to students"
--   instructor_modalities          modalities a staff member teaches (owner sets)
--   instructor_belts               the staff member's own belt per modality,
--                                  from the academy's belt sequence
--   get_instructor_profile()       everything the profile screen shows, for any
--                                  active member; contacts are only returned to
--                                  the person, the academy's staff, or students
--                                  when the person turned them on
--
-- Rules: the person edits their own bio, contacts and belts; the owner also
-- edits any staff member's belts and modalities; members read all of it
-- (contacts as above). Graduations already record who graduated
-- (belt_history.awarded_by).
-- =============================================================================

-- ------------------------------------------------ schedules → instructor ---
alter table public.class_schedules
  add column instructor_id uuid references public.profiles (id) on delete set null;
create index class_schedules_instructor_idx on public.class_schedules (academy_id, instructor_id);

-- The instructor must be an active owner/instructor of the same academy.
-- SECURITY INVOKER: only staff write schedules, and staff read their
-- academy's memberships.
create function private.guard_schedule_instructor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.instructor_id is not null
     and (tg_op = 'INSERT' or new.instructor_id is distinct from old.instructor_id)
     and not exists (
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

revoke all on function private.guard_schedule_instructor() from public, anon;
grant execute on function private.guard_schedule_instructor() to authenticated;

create trigger class_schedules_guard_instructor before insert or update of instructor_id on public.class_schedules
  for each row execute function private.guard_schedule_instructor();

grant insert (instructor_id), update (instructor_id) on public.class_schedules to authenticated;

-- --------------------------------------------------- instructor_profiles ---
create table public.instructor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text check (bio is null or char_length(bio) between 1 and 160),
  -- Handle without "@".
  instagram text check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'),
  -- Digits only, with country code (wa.me format).
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  show_contacts_to_students boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger instructor_profiles_set_updated_at before update on public.instructor_profiles
  for each row execute function private.set_updated_at();

-- Normalized on write: trimmed bio (empty → null), handle without "@" in
-- lower case, phone digits only.
create function private.normalize_instructor_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.bio := nullif(btrim(new.bio), '');
  new.instagram := nullif(lower(regexp_replace(btrim(new.instagram), '^@+', '')), '');
  new.whatsapp := nullif(regexp_replace(new.whatsapp, '[^0-9]', '', 'g'), '');
  return new;
end;
$$;

revoke all on function private.normalize_instructor_profile() from public, anon;
grant execute on function private.normalize_instructor_profile() to authenticated;

create trigger instructor_profiles_normalize before insert or update on public.instructor_profiles
  for each row execute function private.normalize_instructor_profile();

alter table public.instructor_profiles enable row level security;

grant select on public.instructor_profiles to authenticated;
grant insert (user_id, bio, instagram, whatsapp, show_contacts_to_students) on public.instructor_profiles to authenticated;
grant update (bio, instagram, whatsapp, show_contacts_to_students) on public.instructor_profiles to authenticated;

-- Direct reads: the person and the staff of their academies. Students read it
-- through get_instructor_profile() (contacts filtered there).
create policy "instructor_profiles: own or staff reads"
  on public.instructor_profiles for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff_of_member(user_id));
create policy "instructor_profiles: own inserts"
  on public.instructor_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "instructor_profiles: own updates"
  on public.instructor_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------------ shared helper ---
-- The membership is an active owner/instructor of the academy and the caller
-- is that person (self) or, when p_owner_may is true, the academy's owner.
create function private.can_edit_staff_membership(p_membership_id uuid, p_academy_id uuid, p_owner_may boolean, p_self_may boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.id = p_membership_id
      and m.academy_id = p_academy_id
      and m.status = 'active'
      and m.role in ('owner', 'instructor')
      and (
        (p_self_may and m.user_id = (select auth.uid()))
        or (p_owner_may and private.is_owner(p_academy_id))
      )
  );
$$;

revoke all on function private.can_edit_staff_membership(uuid, uuid, boolean, boolean) from public, anon;
grant execute on function private.can_edit_staff_membership(uuid, uuid, boolean, boolean) to authenticated;

-- ------------------------------------------------- instructor_modalities ---
create table public.instructor_modalities (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  academy_id uuid not null,
  modality_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, modality_id),
  foreign key (modality_id, academy_id)
    references public.academy_modalities (id, academy_id) on delete cascade
);
create index instructor_modalities_academy_modality_idx on public.instructor_modalities (academy_id, modality_id);

alter table public.instructor_modalities enable row level security;

grant select, delete on public.instructor_modalities to authenticated;
grant insert (membership_id, academy_id, modality_id) on public.instructor_modalities to authenticated;

create policy "instructor_modalities: members read"
  on public.instructor_modalities for select to authenticated
  using (private.is_member(academy_id));
create policy "instructor_modalities: owner inserts"
  on public.instructor_modalities for insert to authenticated
  with check (private.can_edit_staff_membership(membership_id, academy_id, true, false));
create policy "instructor_modalities: owner deletes"
  on public.instructor_modalities for delete to authenticated
  using (private.is_owner(academy_id));

-- SECURITY INVOKER: plain RLS (owner only). Replaces the set of modalities of
-- one staff membership in a single transaction (empty array = none).
create function public.set_instructor_modalities(p_membership_id uuid, p_modality_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_academy uuid;
begin
  select m.academy_id into v_academy from public.memberships m where m.id = p_membership_id;
  if v_academy is null or not private.can_edit_staff_membership(p_membership_id, v_academy, true, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.instructor_modalities
  where membership_id = p_membership_id
    and modality_id <> all (coalesce(p_modality_ids, '{}'));

  insert into public.instructor_modalities (membership_id, academy_id, modality_id)
  select p_membership_id, v_academy, x.id
  from unnest(coalesce(p_modality_ids, '{}')) as x (id)
  on conflict (membership_id, modality_id) do nothing;
end;
$$;

revoke all on function public.set_instructor_modalities(uuid, uuid[]) from public, anon;
grant execute on function public.set_instructor_modalities(uuid, uuid[]) to authenticated;

-- ------------------------------------------------------ instructor_belts ---
create table public.instructor_belts (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  academy_id uuid not null,
  modality_id uuid not null,
  belt_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (membership_id, modality_id),
  foreign key (modality_id, academy_id)
    references public.academy_modalities (id, academy_id) on delete cascade,
  -- Removing a belt from the sequence clears it from the staff member.
  foreign key (belt_id, modality_id)
    references public.modality_belts (id, modality_id) on delete cascade
);
create index instructor_belts_academy_idx on public.instructor_belts (academy_id);
create index instructor_belts_belt_idx on public.instructor_belts (belt_id, modality_id);

create trigger instructor_belts_set_updated_at before update on public.instructor_belts
  for each row execute function private.set_updated_at();

alter table public.instructor_belts enable row level security;

grant select, delete on public.instructor_belts to authenticated;
grant insert (membership_id, academy_id, modality_id, belt_id) on public.instructor_belts to authenticated;
grant update (belt_id) on public.instructor_belts to authenticated;

-- Only modalities that use belts.
create policy "instructor_belts: members read"
  on public.instructor_belts for select to authenticated
  using (private.is_member(academy_id));
create policy "instructor_belts: self or owner inserts"
  on public.instructor_belts for insert to authenticated
  with check (
    private.can_edit_staff_membership(membership_id, academy_id, true, true)
    and exists (
      select 1 from public.academy_modalities mo
      where mo.id = modality_id and mo.academy_id = instructor_belts.academy_id and mo.uses_belts
    )
  );
create policy "instructor_belts: self or owner updates"
  on public.instructor_belts for update to authenticated
  using (private.can_edit_staff_membership(membership_id, academy_id, true, true))
  with check (private.can_edit_staff_membership(membership_id, academy_id, true, true));
create policy "instructor_belts: self or owner deletes"
  on public.instructor_belts for delete to authenticated
  using (private.can_edit_staff_membership(membership_id, academy_id, true, true));

-- ------------------------------------------------ get_instructor_profile ---
-- One active owner/instructor of the academy, for any active member of it.
-- Zero rows when the caller is not a member or the person is not staff there.
-- SECURITY DEFINER: students cannot read profiles, instructor_profiles nor
-- every schedule (only those of their modalities); this returns the fixed
-- public part of the profile and hides the contacts from students unless the
-- person turned them on. Counts are aggregates (no student is identified).
create function public.get_instructor_profile(p_academy_id uuid, p_user_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  avatar_path text,
  role public.membership_role,
  member_since timestamptz,
  bio text,
  instagram text,
  whatsapp text,
  show_contacts_to_students boolean,
  graduations_count integer,
  competitors_count integer,
  modality_ids uuid[],
  -- [{modality_id, belt_id}]
  belts jsonb,
  -- [{id, modality_id, weekday, start_time}] active schedules given by the person
  schedules jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.memberships%rowtype;
  v_contacts boolean;
begin
  if not private.is_member(p_academy_id) then
    return;
  end if;

  select * into v_target from public.memberships m
  where m.academy_id = p_academy_id and m.user_id = p_user_id
    and m.status = 'active' and m.role in ('owner', 'instructor');
  if not found then
    return;
  end if;

  v_contacts := p_user_id = (select auth.uid())
    or private.is_staff(p_academy_id)
    or coalesce((select ip.show_contacts_to_students from public.instructor_profiles ip where ip.user_id = p_user_id), false);

  return query
  select
    v_target.id,
    p.id,
    p.full_name,
    p.avatar_path,
    v_target.role,
    coalesce(v_target.decided_at, v_target.created_at),
    ip.bio,
    case when v_contacts then ip.instagram end,
    case when v_contacts then ip.whatsapp end,
    coalesce(ip.show_contacts_to_students, false),
    (select count(*)::int
       from public.belt_history bh
       join public.memberships sm on sm.id = bh.membership_id
      where bh.awarded_by = p_user_id and sm.academy_id = p_academy_id),
    (select count(distinct e.membership_id)::int
       from public.instructor_modalities im
       join public.student_modality_enrollments e
         on e.modality_id = im.modality_id and e.status = 'active' and e.is_competitor
       join public.memberships sm
         on sm.id = e.membership_id and sm.status = 'active' and sm.role = 'student'
      where im.membership_id = v_target.id),
    coalesce((select array_agg(im.modality_id order by mo.position)
                from public.instructor_modalities im
                join public.academy_modalities mo on mo.id = im.modality_id
               where im.membership_id = v_target.id), '{}'),
    coalesce((select jsonb_agg(jsonb_build_object('modality_id', ib.modality_id, 'belt_id', ib.belt_id) order by mo.position)
                from public.instructor_belts ib
                join public.academy_modalities mo on mo.id = ib.modality_id
               where ib.membership_id = v_target.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                       'id', s.id,
                       'modality_id', s.modality_id,
                       'weekday', s.weekday,
                       'start_time', to_char(s.start_time, 'HH24:MI')
                     ) order by s.start_time, s.weekday)
                from public.class_schedules s
               where s.academy_id = p_academy_id and s.instructor_id = p_user_id and s.active), '[]'::jsonb)
  from public.profiles p
  left join public.instructor_profiles ip on ip.user_id = p.id
  where p.id = p_user_id;
end;
$$;

revoke all on function public.get_instructor_profile(uuid, uuid) from public, anon;
grant execute on function public.get_instructor_profile(uuid, uuid) to authenticated;
