-- =============================================================================
-- Kimi — Foundation
-- profiles, gyms, memberships (role + approval status), reusable invite links.
--
-- Isolation model: every gym-scoped row is only visible to users with a
-- membership in that gym. Membership writes never happen through direct table
-- access; they go through SECURITY DEFINER RPCs that enforce the rules
-- (create gym, join via invite link, professor approves/rejects).
-- =============================================================================

create schema if not exists private;

-- Deny-by-default for everything created from now on (this and later
-- migrations): every new table / function must grant access explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.membership_role as enum ('student', 'competitor', 'professor');
create type public.membership_status as enum ('pending', 'active', 'rejected');
-- An invite link can only bring in students or professors.
-- Competitor is a promotion of an existing student (phase 4).
create type public.invite_role as enum ('student', 'professor');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  -- Owner (first professor). Cannot be removed by other professors.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gyms_created_by_idx on public.gyms (created_by);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (gym_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_gym_status_idx on public.memberships (gym_id, status);
create index memberships_decided_by_idx on public.memberships (decided_by);

create table public.gym_invites (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  role public.invite_role not null,
  -- 144 bits of randomness, URL-safe. Guessing a token is not feasible.
  token text not null unique default translate(
    encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'
  ),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- At most one live link per gym and role.
create unique index gym_invites_one_active_idx
  on public.gym_invites (gym_id, role) where revoked_at is null;
create index gym_invites_created_by_idx on public.gym_invites (created_by);

-- -----------------------------------------------------------------------------
-- Profile bootstrap: one profile per auth user.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS helpers (private schema = not exposed through the Data API).
-- SECURITY DEFINER avoids RLS recursion on memberships; every helper is
-- anchored on auth.uid(), so it can only answer questions about the caller.
-- -----------------------------------------------------------------------------
-- Includes PENDING requests: only for low-sensitivity data (gym name).
-- Health data must use is_active_member / is_professor.
create function private.has_membership_or_request(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.gym_id = p_gym_id and m.user_id = (select auth.uid())
      and m.status in ('pending', 'active')
  );
$$;

create function private.is_active_member(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.gym_id = p_gym_id and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function private.is_professor(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.gym_id = p_gym_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = 'professor'
  );
$$;

-- Caller can see another user's profile when both are active in the same gym,
-- or when the caller is a professor of a gym the other user is asking to join.
create function private.can_view_profile(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.gym_id = viewer.gym_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and target.user_id = p_user_id
      and (
        target.status = 'active'
        or (viewer.role = 'professor' and target.status = 'pending')
      )
  );
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function
  private.has_membership_or_request(uuid),
  private.is_active_member(uuid),
  private.is_professor(uuid),
  private.can_view_profile(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges: anon gets nothing on tables; authenticated only what RLS allows.
-- Writes to memberships / gyms / invites only through the RPCs below.
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.gyms, public.memberships, public.gym_invites
  from anon, authenticated;

grant select on public.profiles, public.gyms, public.memberships, public.gym_invites
  to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name) on public.gyms to authenticated;

alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.memberships enable row level security;
alter table public.gym_invites enable row level security;

create policy "profiles: read self or shared gym"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.can_view_profile(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "gyms: read when member"
  on public.gyms for select to authenticated
  using (private.has_membership_or_request(id));

create policy "gyms: professor updates"
  on public.gyms for update to authenticated
  using (private.is_professor(id))
  with check (private.is_professor(id));

create policy "memberships: read own or as professor"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_professor(gym_id));

create policy "gym_invites: professor reads"
  on public.gym_invites for select to authenticated
  using (private.is_professor(gym_id));

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Open sign-up flow: creator becomes the gym's first professor.
create function public.create_gym(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_gym_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_gym_name' using errcode = '22023';
  end if;

  insert into public.gyms (name, created_by)
  values (v_name, v_uid)
  returning id into v_gym_id;

  insert into public.memberships (gym_id, user_id, role, status, decided_by, decided_at)
  values (v_gym_id, v_uid, 'professor', 'active', v_uid, now());

  insert into public.gym_invites (gym_id, role, created_by)
  values (v_gym_id, 'student', v_uid), (v_gym_id, 'professor', v_uid);

  return v_gym_id;
end;
$$;

-- Read-only preview shown before sign-up ("Você foi convidado para ...").
-- Callable by anon: it only reveals the gym name for a valid, unguessable token.
create function public.get_invite_preview(p_token text)
returns table (gym_name text, role public.invite_role)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, i.role
  from public.gym_invites i
  join public.gyms g on g.id = i.gym_id
  where i.token = p_token and i.revoked_at is null;
$$;

-- Join request through an invite link. Always lands as 'pending'.
-- An active membership is never downgraded; a rejected one may re-request.
create function public.request_membership(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.gym_invites%rowtype;
  v_existing public.memberships%rowtype;
  v_membership_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.gym_invites
  where token = p_token and revoked_at is null;
  if not found then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.memberships
  where gym_id = v_invite.gym_id and user_id = v_uid
  for update;

  if found then
    if v_existing.status in ('active', 'pending') then
      return v_existing.id;
    end if;
    update public.memberships
    set status = 'pending', role = v_invite.role::text::public.membership_role,
        decided_by = null, decided_at = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.memberships (gym_id, user_id, role, status)
  values (v_invite.gym_id, v_uid, v_invite.role::text::public.membership_role, 'pending')
  on conflict (gym_id, user_id) do nothing
  returning id into v_membership_id;

  if v_membership_id is null then
    -- Concurrent request from the same user won the race.
    select id into v_membership_id
    from public.memberships
    where gym_id = v_invite.gym_id and user_id = v_uid;
  end if;
  return v_membership_id;
end;
$$;

-- Professor decides on a pending request of their own gym.
create function public.decide_membership(p_membership_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_target from public.memberships where id = p_membership_id for update;
  if not found or not private.is_professor(v_target.gym_id) then
    -- Same error for "missing" and "not yours": do not leak existence.
    raise exception 'membership_not_found' using errcode = 'P0002';
  end if;
  if v_target.status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = '22023';
  end if;

  update public.memberships
  set status = case when p_approve then 'active' else 'rejected' end::public.membership_status,
      decided_by = v_uid,
      decided_at = now()
  where id = p_membership_id;
end;
$$;

-- Professor revokes the current link of a role and gets a fresh one.
create function public.rotate_invite(p_gym_id uuid, p_role public.invite_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null or not private.is_professor(p_gym_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Serialize rotations of the same gym.
  perform 1 from public.gyms where id = p_gym_id for update;

  update public.gym_invites
  set revoked_at = now()
  where gym_id = p_gym_id and role = p_role and revoked_at is null;

  insert into public.gym_invites (gym_id, role, created_by)
  values (p_gym_id, p_role, v_uid)
  returning token into v_token;
  return v_token;
end;
$$;

-- Professor removes an active member (or a pending request) from their gym.
-- The gym owner can never be removed; nobody removes themselves here.
create function public.remove_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_target from public.memberships where id = p_membership_id for update;
  if not found or not private.is_professor(v_target.gym_id) then
    raise exception 'membership_not_found' using errcode = 'P0002';
  end if;
  if v_target.user_id = v_uid
     or v_target.user_id = (select g.created_by from public.gyms g where g.id = v_target.gym_id) then
    raise exception 'cannot_remove_member' using errcode = '42501';
  end if;

  update public.memberships
  set status = 'rejected', decided_by = v_uid, decided_at = now()
  where id = p_membership_id;
end;
$$;

-- Pending requests of a gym, with the requester's e-mail so the professor can
-- tell who is asking (profiles carry only a self-chosen name).
create function public.list_pending_requests(p_gym_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role public.membership_role,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, p.full_name, u.email::text, m.role, m.created_at
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.gym_id = p_gym_id
    and m.status = 'pending'
    and private.is_professor(p_gym_id)
  order by m.created_at;
$$;

revoke all on function
  public.remove_membership(uuid),
  public.list_pending_requests(uuid),
  public.create_gym(text),
  public.get_invite_preview(text),
  public.request_membership(text),
  public.decide_membership(uuid, boolean),
  public.rotate_invite(uuid, public.invite_role)
from public, anon, authenticated;

grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function
  public.remove_membership(uuid),
  public.list_pending_requests(uuid),
  public.create_gym(text),
  public.request_membership(text),
  public.decide_membership(uuid, boolean),
  public.rotate_invite(uuid, public.invite_role)
to authenticated;
