-- =============================================================================
-- Kimi — Pre-launch hardening (phase 7)
--
-- 1. delete_my_account(): in-app account deletion (App Store requirement).
--    An owner must transfer each academy that still has other active members;
--    an academy where the owner is the only active member is deleted with the
--    account. Everything personal cascades from auth.users → profiles.
-- 2. Body data (weight, height, sex, birth date) is no longer readable by staff
--    of every member: only the user and staff of an academy where the user is
--    an active competitor (who accepted the invite), via get_profile_details.
-- 3. A rejected join request can be repeated only 24 h after the decision.
-- 4. lookup_invite_code (anonymous): at most 20 failed lookups per client IP
--    in 15 minutes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Account deletion
-- -----------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_blocked text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Owned academies that someone else still uses: transfer them first.
  select string_agg(a.name, ', ' order by a.name) into v_blocked
  from public.memberships own
  join public.academies a on a.id = own.academy_id
  where own.user_id = v_uid
    and own.role = 'owner'
    and exists (
      select 1 from public.memberships other
      where other.academy_id = own.academy_id
        and other.user_id <> v_uid
        and other.status = 'active'
    );
  if v_blocked is not null then
    raise exception 'owner_must_transfer' using errcode = '23514', detail = v_blocked;
  end if;

  -- Academies only this user runs go with the account (pending requests,
  -- schedules, codes and championships cascade from the academy).
  delete from public.academies a
  using public.memberships own
  where own.academy_id = a.id and own.user_id = v_uid and own.role = 'owner';

  -- profiles, memberships, check-ins, water, weight, plans... cascade.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Body data
-- -----------------------------------------------------------------------------
-- A column revoke does nothing under a table grant: grant the readable columns only.
revoke select on public.profiles from authenticated;
grant select (id, full_name, bottle_ml, timezone, avatar_path, created_at, updated_at)
  on public.profiles to authenticated;

-- The user's own body data, or a competitor's for staff of their academy.
-- Zero rows when the caller may not read them.
create function public.get_profile_details(p_user_id uuid)
returns table (weight_kg numeric, height_cm numeric, sex text, birth_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.weight_kg, p.height_cm, p.sex, p.birth_date
  from public.profiles p
  where p.id = p_user_id
    and (p.id = (select auth.uid()) or private.is_staff_of_competitor(p.id));
$$;

revoke all on function public.get_profile_details(uuid) from public, anon;
grant execute on function public.get_profile_details(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Rejected requests: 24 h before asking again
-- -----------------------------------------------------------------------------
create or replace function private.request_join(p_uid uuid, p_academy_id uuid, p_role public.membership_role)
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
    if v_existing.decided_at > now() - interval '24 hours' then
      raise exception 'join_cooldown' using errcode = '22023';
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

-- -----------------------------------------------------------------------------
-- 4. Code lookups: rate limit per client IP
-- -----------------------------------------------------------------------------
create table private.code_lookup_failures (
  id bigint generated always as identity primary key,
  client_ip text not null,
  attempted_at timestamptz not null default now()
);
create index code_lookup_failures_ip_time_idx on private.code_lookup_failures (client_ip, attempted_at);

-- Client IP as the API gateway reports it. Null outside an HTTP request
-- (SQL, tests): no limit then.
create function private.request_client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(coalesce(
    h ->> 'cf-connecting-ip',
    h ->> 'x-real-ip',
    split_part(h ->> 'x-forwarded-for', ',', 1)
  )), '')
  from (select nullif(current_setting('request.headers', true), '')::json as h) headers;
$$;

create or replace function public.lookup_invite_code(p_code text)
returns table (academy_name text, logo_path text, code_type public.membership_role)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_ip text := private.request_client_ip();
  v_rows integer;
begin
  if v_code !~ '^[A-HJKMNP-Z2-9]{8}$' then
    return;
  end if;

  if v_ip is not null and (
    select count(*) from private.code_lookup_failures f
    where f.client_ip = v_ip and f.attempted_at > now() - interval '15 minutes'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select a.name, a.logo_path, 'student'::public.membership_role
    from public.academies a
    where a.invite_code = v_code
    union all
    select a.name, a.logo_path, 'instructor'::public.membership_role
    from public.professor_codes p
    join public.academies a on a.id = p.academy_id
    where p.code = v_code and private.professor_code_is_live(p);
  get diagnostics v_rows = row_count;

  if v_rows = 0 and v_ip is not null then
    insert into private.code_lookup_failures (client_ip) values (v_ip);
    delete from private.code_lookup_failures
    where client_ip = v_ip and attempted_at < now() - interval '1 day';
  end if;
end;
$$;
