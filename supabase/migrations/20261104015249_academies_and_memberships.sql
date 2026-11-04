-- =============================================================================
-- Kimi — Academies and memberships
-- academies, memberships (role + approval status + competitor flag + belt),
-- reusable invite links, RLS helpers and the join / create flows.
--
-- Isolation model: every academy-scoped row is only visible to users with an
-- ACTIVE membership in that academy. Pending requests only see the academy
-- name. Joining (short invite code or long link) always lands as `pending`
-- until a professor of the academy approves it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Invite code generator: 8 chars without look-alikes (0/O, 1/I/L).
-- 32^8 ≈ 1.1e12 combinations; joining still needs a professor's approval.
-- -----------------------------------------------------------------------------
create function private.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 31) + 1, 1), ''
  )
  from extensions.gen_random_bytes(8) as b, generate_series(0, 7) as i;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  invite_code text not null unique default private.generate_invite_code()
    check (invite_code ~ '^[A-Z0-9]{8}$'),
  -- Owner (first professor). Cannot be demoted or removed by other professors.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index academies_created_by_idx on public.academies (created_by);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'pending',
  is_competitor boolean not null default false,
  belt text check (char_length(btrim(belt)) between 1 and 40),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, academy_id),
  -- Only students compete.
  constraint memberships_competitor_is_student check (not is_competitor or role = 'student')
);
-- (user_id, academy_id) unique index also serves user_id lookups.
create index memberships_academy_status_idx on public.memberships (academy_id, status);
create index memberships_decided_by_idx on public.memberships (decided_by);

create table public.academy_invites (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  role public.membership_role not null,
  -- 144 bits of randomness, URL-safe. Guessing a token is not feasible.
  token text not null unique default translate(
    encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'
  ),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- At most one live link per academy and role.
create unique index academy_invites_one_active_idx
  on public.academy_invites (academy_id, role) where revoked_at is null;
create index academy_invites_academy_id_idx on public.academy_invites (academy_id);
create index academy_invites_created_by_idx on public.academy_invites (created_by);

create trigger academies_set_updated_at before update on public.academies
  for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger academy_invites_set_updated_at before update on public.academy_invites
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS helpers.
-- SECURITY DEFINER to avoid RLS recursion on memberships (a memberships policy
-- that reads memberships would re-enter itself). They live in `private`, which
-- the Data API does not expose, and every one is anchored on auth.uid(): it can
-- only answer questions about what the CALLER may see.
-- -----------------------------------------------------------------------------

-- Caller has an active membership in the academy.
create function private.is_member(p_academy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- Caller is an active professor of the academy.
create function private.is_professor(p_academy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'professor'
  );
$$;

-- The athlete is an active competitor of the academy AND the caller is either
-- that athlete or an active professor of the academy. Returns false for any
-- other caller, so it never reveals competitor status to third parties.
create function private.is_competitor_of(p_athlete_id uuid, p_academy_id uuid)
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
        and viewer.role = 'professor'
    )
  );
$$;

-- Caller is an active competitor in any academy (personal logs with no
-- academy column: weight_logs).
create function private.is_competitor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.is_competitor
  );
$$;

-- Caller is an active professor of an academy where the athlete is an active
-- competitor (personal logs with no academy column: water_logs, weight_logs).
create function private.is_professor_of_competitor(p_athlete_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships athlete on athlete.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role = 'professor'
      and athlete.user_id = p_athlete_id
      and athlete.status = 'active'
      and athlete.is_competitor
  );
$$;

-- Caller is an active professor of an academy the user belongs to or is
-- asking to join (professors read member profiles and approve requests).
create function private.is_professor_of_member(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role = 'professor'
      and target.user_id = p_user_id
      and target.status in ('pending', 'active')
  );
$$;

-- Caller is active OR pending in the academy. Only for the academy row itself
-- (name shown while waiting for approval); never for other academy data.
create function private.has_membership_or_request(p_academy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status in ('pending', 'active')
  );
$$;

revoke all on function
  private.generate_invite_code(),
  private.is_member(uuid),
  private.is_professor(uuid),
  private.is_competitor_of(uuid, uuid),
  private.is_competitor(),
  private.is_professor_of_competitor(uuid),
  private.is_professor_of_member(uuid),
  private.has_membership_or_request(uuid)
from public, anon;

grant execute on function
  private.is_member(uuid),
  private.is_professor(uuid),
  private.is_competitor_of(uuid, uuid),
  private.is_competitor(),
  private.is_professor_of_competitor(uuid),
  private.is_professor_of_member(uuid),
  private.has_membership_or_request(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Membership write rules (SECURITY INVOKER triggers, run as the professor).
-- Columns a professor may write are limited by column grants; these triggers
-- enforce the transitions the grants cannot express.
-- -----------------------------------------------------------------------------
-- private.guard_membership_update() is defined after request_join below.

-- -----------------------------------------------------------------------------
-- Access
-- -----------------------------------------------------------------------------
alter table public.academies enable row level security;
alter table public.memberships enable row level security;
alter table public.academy_invites enable row level security;

grant select on public.academies to authenticated;
grant update (name) on public.academies to authenticated;

grant select, delete on public.memberships to authenticated;
-- status: approve / reject a pending request (guarded by trigger).
grant update (role, is_competitor, belt, status) on public.memberships to authenticated;

grant select on public.academy_invites to authenticated;
grant insert (academy_id, role, created_by) on public.academy_invites to authenticated;
grant update (revoked_at) on public.academy_invites to authenticated;

-- profiles: professors read the profiles of their members and requesters.
create policy "profiles: read own or as professor of the member"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_professor_of_member(id));

-- academies
create policy "academies: read when member or requester"
  on public.academies for select to authenticated
  using (private.has_membership_or_request(id));

create policy "academies: professor updates"
  on public.academies for update to authenticated
  using (private.is_professor(id))
  with check (private.is_professor(id));

-- memberships
create policy "memberships: read own or as professor"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_professor(academy_id));

create policy "memberships: professor updates academy"
  on public.memberships for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));

-- Never yourself, never the owner.
create policy "memberships: professor removes academy members"
  on public.memberships for delete to authenticated
  using (
    private.is_professor(academy_id)
    and user_id <> (select auth.uid())
    and not exists (
      select 1 from public.academies a
      where a.id = academy_id and a.created_by = memberships.user_id
    )
  );

-- academy_invites (links)
create policy "academy_invites: professor reads"
  on public.academy_invites for select to authenticated
  using (private.is_professor(academy_id));

create policy "academy_invites: professor creates"
  on public.academy_invites for insert to authenticated
  with check (private.is_professor(academy_id) and created_by = (select auth.uid()));

create policy "academy_invites: professor revokes"
  on public.academy_invites for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: the creator's first `professor` membership cannot be
-- granted by a policy — any INSERT policy that allowed it would let a user
-- declare themselves professor of any academy. Creating the academy, the
-- owner membership and the two invite links happens in one transaction.
create function public.create_academy(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_academy_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_academy_name' using errcode = '22023';
  end if;

  insert into public.academies (name, created_by)
  values (v_name, v_uid)
  returning id into v_academy_id;

  insert into public.memberships (academy_id, user_id, role, status, decided_by, decided_at)
  values (v_academy_id, v_uid, 'professor', 'active', v_uid, now());

  insert into public.academy_invites (academy_id, role, created_by)
  values (v_academy_id, 'student', v_uid), (v_academy_id, 'professor', v_uid);

  return v_academy_id;
end;
$$;

-- Shared by join_academy / request_membership. Always lands as 'pending'.
-- An active or pending membership is never changed; a rejected one may ask
-- again. Internal: not executable by any API role.
create function private.request_join(p_uid uuid, p_academy_id uuid, p_role public.membership_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.memberships%rowtype;
  v_membership_id uuid;
begin
  select * into v_existing
  from public.memberships
  where academy_id = p_academy_id and user_id = p_uid
  for update;

  if found then
    if v_existing.status in ('active', 'pending') then
      return v_existing.id;
    end if;
    -- Bypasses the professor-only guard trigger on purpose: owned by postgres.
    update public.memberships
    set status = 'pending', role = p_role, is_competitor = false,
        decided_by = null, decided_at = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.memberships (academy_id, user_id, role, status)
  values (p_academy_id, p_uid, p_role, 'pending')
  on conflict (user_id, academy_id) do nothing
  returning id into v_membership_id;

  if v_membership_id is null then
    -- A concurrent request from the same user won the race.
    select id into v_membership_id
    from public.memberships
    where academy_id = p_academy_id and user_id = p_uid;
  end if;
  return v_membership_id;
end;
$$;

revoke all on function private.request_join(uuid, uuid, public.membership_role)
  from public, anon, authenticated;

-- The guard trigger rejects status changes made outside a pending decision;
-- request_join resets a rejected row, so it skips the guard for its own role.
create function private.guard_membership_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  -- Internal flows (SECURITY DEFINER RPCs) run as postgres.
  if current_user = 'postgres' then
    return new;
  end if;

  select a.created_by into v_owner from public.academies a where a.id = old.academy_id;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status = 'pending' then
      raise exception 'membership_not_pending' using errcode = '22023';
    end if;
    new.decided_by := (select auth.uid());
    new.decided_at := now();
  end if;

  if old.user_id = v_owner and new.role <> 'professor' then
    raise exception 'cannot_change_owner' using errcode = '42501';
  end if;
  if old.user_id = (select auth.uid()) and new.role <> old.role then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;
  if new.role = 'professor' then
    new.is_competitor := false;
  end if;
  return new;
end;
$$;

grant execute on function private.guard_membership_update() to authenticated;

create trigger memberships_guard_update
  before update on public.memberships
  for each row execute function private.guard_membership_update();

-- SECURITY DEFINER: the user is not a member yet, so RLS hides the academy
-- whose code they typed, and no policy may let a user insert their own
-- membership. Lands as a pending student until a professor approves.
create function public.join_academy(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_academy_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select a.id into v_academy_id
  from public.academies a
  where a.invite_code = upper(btrim(coalesce(p_invite_code, '')));
  if not found then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  return private.request_join(v_uid, v_academy_id, 'student');
end;
$$;

-- SECURITY DEFINER for the same reason as join_academy, through a long link
-- (deep link). The link carries the role: student or professor.
create function public.request_membership(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.academy_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.academy_invites
  where token = p_token and revoked_at is null;
  if not found then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  return private.request_join(v_uid, v_invite.academy_id, v_invite.role);
end;
$$;

-- SECURITY DEFINER: the invitee cannot read the academy yet. Reveals only the
-- academy name for a valid, unguessable token. Authenticated callers only.
create function public.get_invite_preview(p_token text)
returns table (academy_name text, role public.membership_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return query
    select a.name, i.role
    from public.academy_invites i
    join public.academies a on a.id = i.academy_id
    where i.token = p_token and i.revoked_at is null;
end;
$$;

-- SECURITY DEFINER: the professor needs the requester's e-mail to know who is
-- asking (profiles only carry a self-chosen name), and auth.users is not
-- readable by API roles. Returns rows only for professors of the academy.
create function public.list_pending_requests(p_academy_id uuid)
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
begin
  if (select auth.uid()) is null or not private.is_professor(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, p.full_name, u.email::text, m.role, m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.academy_id = p_academy_id
      and m.status = 'pending'
    order by m.created_at;
end;
$$;

-- SECURITY INVOKER: plain RLS (professor-only insert/update on invites).
-- Revokes the current link of a role and returns a fresh token atomically.
create function public.rotate_invite(p_academy_id uuid, p_role public.membership_role)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_token text;
begin
  update public.academy_invites
  set revoked_at = now()
  where academy_id = p_academy_id and role = p_role and revoked_at is null;

  insert into public.academy_invites (academy_id, role, created_by)
  values (p_academy_id, p_role, (select auth.uid()))
  returning token into v_token;
  return v_token;
end;
$$;

revoke all on function
  public.create_academy(text),
  public.join_academy(text),
  public.request_membership(text),
  public.get_invite_preview(text),
  public.list_pending_requests(uuid),
  public.rotate_invite(uuid, public.membership_role)
from public, anon;

grant execute on function
  public.create_academy(text),
  public.join_academy(text),
  public.request_membership(text),
  public.get_invite_preview(text),
  public.list_pending_requests(uuid),
  public.rotate_invite(uuid, public.membership_role)
to authenticated;
