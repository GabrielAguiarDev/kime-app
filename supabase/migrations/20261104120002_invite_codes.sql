-- =============================================================================
-- Kimi — Invite codes replace invite links
--
-- Student code: one fixed 8-character code per academy (academies.invite_code),
--   reusable. The owner can regenerate it; requests already sent stay valid.
-- Professor codes: single use, valid for 7 days, owner-only (create, list,
--   revoke). An expired, used or revoked code behaves exactly like a code
--   that does not exist.
--
-- Both kinds share one namespace (8 characters from an alphabet without
-- 0/O and 1/I/L), so a single field accepts either and the server tells which
-- one it is. lookup_invite_code() is the only thing `anon` can reach: it
-- returns the academy name, its logo path and the code kind — nothing else.
--
-- The long invite links (academy_invites) are gone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Links out
-- -----------------------------------------------------------------------------
drop function public.request_membership(text);
drop function public.get_invite_preview(text);
drop function public.rotate_invite(uuid, public.membership_role);
drop function public.join_academy(text);
drop function public.get_academy_preview_by_code(text);
drop table public.academy_invites;

-- -----------------------------------------------------------------------------
-- 2. Codes
-- -----------------------------------------------------------------------------
-- Alphabet of private.generate_invite_code(): no 0/O, 1/I/L.
alter table public.academies drop constraint academies_invite_code_check;
alter table public.academies
  add constraint academies_invite_code_check check (invite_code ~ '^[A-HJKMNP-Z2-9]{8}$');

create table public.professor_codes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint professor_codes_used_together check ((used_at is null) = (used_by is null))
);
create index professor_codes_academy_id_idx on public.professor_codes (academy_id);
create index professor_codes_created_by_idx on public.professor_codes (created_by);
create index professor_codes_used_by_idx on public.professor_codes (used_by);

create trigger professor_codes_set_updated_at before update on public.professor_codes
  for each row execute function private.set_updated_at();

-- A code no academy or professor code is using (shared namespace). With
-- 31^8 ≈ 8.5e11 codes, a collision is a once-in-forever retry.
create function private.new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := private.generate_invite_code();
    exit when not exists (select 1 from public.academies where invite_code = v_code)
          and not exists (select 1 from public.professor_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.new_invite_code() from public, anon, authenticated;

-- Academies created from now on also draw from the shared namespace.
alter table public.academies alter column invite_code set default private.new_invite_code();

-- A professor code is usable only while not used, not revoked and not expired.
create function private.professor_code_is_live(p public.professor_codes)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p.used_at is null and p.revoked_at is null and p.expires_at > now();
$$;

-- -----------------------------------------------------------------------------
-- 3. Access (professor_codes): owner reads and revokes; creation via RPC.
-- -----------------------------------------------------------------------------
alter table public.professor_codes enable row level security;

grant select on public.professor_codes to authenticated;
grant update (revoked_at) on public.professor_codes to authenticated;

create policy "professor_codes: owner reads"
  on public.professor_codes for select to authenticated
  using (private.is_owner(academy_id));

create policy "professor_codes: owner revokes"
  on public.professor_codes for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));

-- Revoking is one-way: a revoked (or used) code never comes back.
create function private.guard_professor_code_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'postgres' then
    return new;
  end if;
  if old.revoked_at is not null or old.used_at is not null or new.revoked_at is null then
    raise exception 'code_not_revocable' using errcode = '22023';
  end if;
  new.revoked_at := now();
  return new;
end;
$$;

grant execute on function private.guard_professor_code_update() to authenticated;

create trigger professor_codes_guard_update
  before update on public.professor_codes
  for each row execute function private.guard_professor_code_update();

-- -----------------------------------------------------------------------------
-- 4. RPCs
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: the code generator is private. Owner only.
-- Requests already sent with the old code stay pending: they are memberships,
-- not tied to the code.
create function public.regenerate_student_code(p_academy_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if (select auth.uid()) is null or not private.is_owner(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.academies
  set invite_code = private.new_invite_code()
  where id = p_academy_id
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- SECURITY DEFINER: same generator. Owner only; at most 20 live codes per
-- academy (a cap against runaway creation, far above real use).
create function public.create_professor_code(p_academy_id uuid)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.is_owner(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.professor_codes p
      where p.academy_id = p_academy_id and private.professor_code_is_live(p)) >= 20 then
    raise exception 'too_many_codes' using errcode = '22023';
  end if;
  return query
    insert into public.professor_codes as p (academy_id, code, created_by)
    values (p_academy_id, private.new_invite_code(), v_uid)
    returning p.id, p.code, p.expires_at;
end;
$$;

-- SECURITY DEFINER, callable by anon: shown BEFORE sign-in (code → academy
-- card). Returns only the academy name, logo path and code kind for a live
-- code; anything else (bad format, unknown, expired, used, revoked) returns no
-- row, without telling which.
create function public.lookup_invite_code(p_code text)
returns table (academy_name text, logo_path text, code_type public.membership_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if v_code !~ '^[A-HJKMNP-Z2-9]{8}$' then
    return;
  end if;
  return query
    select a.name, a.logo_path, 'student'::public.membership_role
    from public.academies a
    where a.invite_code = v_code
    union all
    select a.name, a.logo_path, 'professor'::public.membership_role
    from public.professor_codes p
    join public.academies a on a.id = p.academy_id
    where p.code = v_code and private.professor_code_is_live(p);
end;
$$;

-- SECURITY DEFINER: the user is not a member yet, so RLS hides the academy,
-- and no policy may let a user insert their own membership. Lands as a
-- pending request with the role the code carries.
--   * Already an active or pending member of that academy: nothing changes,
--     the existing membership is returned (no duplicate) and a professor code
--     is NOT spent.
--   * Professor code: locked and marked used in the same transaction, so two
--     people cannot both use it.
create function public.join_with_code(p_code text)
returns table (membership_id uuid, academy_id uuid, status public.membership_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_academy_id uuid;
  v_professor_code public.professor_codes%rowtype;
  v_role public.membership_role;
  v_membership_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select a.id into v_academy_id from public.academies a where a.invite_code = v_code;
  if found then
    v_role := 'student';
  else
    select * into v_professor_code
    from public.professor_codes p
    where p.code = v_code
    for update;
    if not found or not private.professor_code_is_live(v_professor_code) then
      raise exception 'invite_invalid' using errcode = 'P0002';
    end if;
    v_academy_id := v_professor_code.academy_id;
    v_role := 'professor';
  end if;

  -- One join per user and academy at a time: two codes sent at once by the
  -- same person cannot both be spent on a single request.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_academy_id::text, 0));

  -- Already in (active or waiting): do not duplicate, do not spend the code.
  select m.id into v_membership_id
  from public.memberships m
  where m.academy_id = v_academy_id and m.user_id = v_uid and m.status in ('active', 'pending');
  if not found then
    v_membership_id := private.request_join(v_uid, v_academy_id, v_role);
    if v_role = 'professor' then
      update public.professor_codes
      set used_at = now(), used_by = v_uid
      where id = v_professor_code.id;
    end if;
  end if;

  return query
    select m.id, m.academy_id, m.status
    from public.memberships m
    where m.id = v_membership_id;
end;
$$;

revoke all on function
  public.regenerate_student_code(uuid),
  public.create_professor_code(uuid),
  public.lookup_invite_code(text),
  public.join_with_code(text),
  private.professor_code_is_live(public.professor_codes)
from public, anon;

grant execute on function
  public.regenerate_student_code(uuid),
  public.create_professor_code(uuid),
  public.join_with_code(text)
to authenticated;

-- The one function anon can call.
grant execute on function public.lookup_invite_code(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. create_academy: no more links.
-- -----------------------------------------------------------------------------
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

  insert into public.academy_modalities (academy_id, name, position)
  select v_academy_id, n, (ord - 1)::smallint
  from unnest(v_modalities) with ordinality as t (n, ord);

  return v_academy_id;
end;
$$;
