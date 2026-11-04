-- =============================================================================
-- Kimi — Competitor team by accepted invite (phase 4)
--
-- Staff invite an active student; the student accepts (and from then on staff
-- read their weight, water logs and plans) or declines. is_competitor only
-- turns true on acceptance, with the date. Staff can take the student off the
-- team at any time and the student can leave on their own.
--
-- is_competitor is no longer written directly by clients: only these RPCs.
-- =============================================================================

alter table public.memberships
  add column competitor_invited_at timestamptz,
  add column competitor_invited_by uuid references public.profiles (id) on delete set null,
  add column competitor_since timestamptz;

create index memberships_competitor_invited_by_idx on public.memberships (competitor_invited_by);

-- Competitors switched on directly before this phase keep their place.
update public.memberships
set competitor_since = coalesce(decided_at, created_at)
where is_competitor;

-- Keeps the competitor columns consistent whatever the write path
-- (RPCs below, request_join re-opening a row, role/status changes).
create function private.normalize_membership_competitor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.role <> 'student' then
    new.is_competitor := false;
  end if;
  if not new.is_competitor then
    new.competitor_since := null;
  elsif new.competitor_since is null then
    new.competitor_since := now();
  end if;
  if new.is_competitor or new.status <> 'active' or new.role <> 'student' then
    new.competitor_invited_at := null;
    new.competitor_invited_by := null;
  end if;
  return new;
end;
$$;
revoke all on function private.normalize_membership_competitor() from public, anon;
grant execute on function private.normalize_membership_competitor() to authenticated;

-- Runs after memberships_guard_update (triggers fire in name order).
create trigger memberships_normalize_competitor before insert or update on public.memberships
  for each row execute function private.normalize_membership_competitor();

alter table public.memberships
  add constraint memberships_competitor_since check ((competitor_since is not null) = is_competitor),
  add constraint memberships_competitor_invite check (
    competitor_invited_at is null or (not is_competitor and role = 'student' and status = 'active')
  );

revoke update (is_competitor) on public.memberships from authenticated;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Staff invite an active student of the academy. Idempotent while pending.
create function public.invite_competitor(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_member from public.memberships where id = p_membership_id for update;
  if not found or not private.is_staff(v_member.academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.role <> 'student' or v_member.status <> 'active' then
    raise exception 'competitor_target_invalid' using errcode = '22023';
  end if;
  if v_member.is_competitor then
    raise exception 'already_competitor' using errcode = '22023';
  end if;
  if v_member.competitor_invited_at is not null then
    return;
  end if;

  update public.memberships
  set competitor_invited_at = now(), competitor_invited_by = v_uid
  where id = p_membership_id;
end;
$$;

-- The invited student accepts or declines their own invite.
create function public.respond_competitor_invite(p_membership_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_member from public.memberships where id = p_membership_id for update;
  if not found or v_member.user_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_member.competitor_invited_at is null then
    raise exception 'competitor_invite_missing' using errcode = 'P0002';
  end if;

  if p_accept then
    update public.memberships set is_competitor = true where id = p_membership_id;
  else
    update public.memberships
    set competitor_invited_at = null, competitor_invited_by = null
    where id = p_membership_id;
  end if;
end;
$$;

-- Staff take a student off the team (or cancel a pending invite); the student
-- can also leave on their own. Entries in championships that have not happened
-- yet are removed; past ones stay as history.
create function public.remove_competitor(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_member from public.memberships where id = p_membership_id for update;
  if not found or not (v_member.user_id = v_uid or private.is_staff(v_member.academy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.memberships
  set is_competitor = false, competitor_invited_at = null, competitor_invited_by = null
  where id = p_membership_id;

  delete from public.championship_entries e
  using public.championships c
  where e.championship_id = c.id
    and e.academy_id = v_member.academy_id
    and e.athlete_id = v_member.user_id
    and c.event_date >= private.academy_local_date(v_member.academy_id);
end;
$$;

revoke all on function
  public.invite_competitor(uuid),
  public.respond_competitor_invite(uuid, boolean),
  public.remove_competitor(uuid)
from public, anon;
grant execute on function
  public.invite_competitor(uuid),
  public.respond_competitor_invite(uuid, boolean),
  public.remove_competitor(uuid)
to authenticated;
