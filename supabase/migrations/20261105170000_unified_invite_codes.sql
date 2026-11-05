-- =============================================================================
-- Kimi — Unified invite codes
--
-- Every academy has exactly TWO active codes, both fixed and reusable:
--   student     → join request as student (approved by owner or instructors)
--   instructor  → join request as professor (approved by the owner only)
-- They live in ONE table with the kind and the status (active | replaced).
-- The database guarantees one active code per kind and academy (partial
-- unique index) and codes unique across all academies (unique `code`, also
-- across replaced codes: from this migration on, an old code never comes back).
--
-- Replaces academies.invite_code (student) and the single-use, 7-day
-- professor_codes. Existing academies keep their student code and get a fixed
-- professor code. Live single-use professor codes stop working (the owner
-- shares the new fixed one).
--
-- "Gerar novo código" (owner only): the active code of that kind becomes
-- `replaced` and a new one is created. Requests already sent stay valid (they
-- are memberships, not tied to the code).
--
-- Reads: the owner sees both codes; instructors see the active student code
-- (to invite students); students see none. Writes only through the RPCs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table public.academy_invite_codes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  code_type public.membership_role not null check (code_type in ('student', 'instructor')),
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  status text not null default 'active' check (status in ('active', 'replaced')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  constraint academy_invite_codes_replaced_at check ((status = 'replaced') = (replaced_at is not null))
);

-- One active code per kind and academy.
create unique index academy_invite_codes_one_active_idx
  on public.academy_invite_codes (academy_id, code_type) where status = 'active';
create index academy_invite_codes_created_by_idx on public.academy_invite_codes (created_by);

comment on table public.academy_invite_codes is
  'Invite codes: one active student and one active instructor code per academy; replaced codes are kept (never reused).';

-- -----------------------------------------------------------------------------
-- 2. Generator (shared namespace) and data migration
-- -----------------------------------------------------------------------------
create or replace function private.new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  -- 31^8 ≈ 8.5e11 codes: a collision is a once-in-forever retry.
  loop
    v_code := private.generate_invite_code();
    exit when not exists (select 1 from public.academy_invite_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.new_invite_code() from public, anon, authenticated;

-- Existing student codes keep working.
insert into public.academy_invite_codes (academy_id, code_type, code, created_by, created_at)
select a.id, 'student', a.invite_code, a.created_by, a.created_at
from public.academies a;

-- Professor codes already handed out must not be reissued to someone else.
insert into public.academy_invite_codes (academy_id, code_type, code, status, created_by, created_at, replaced_at)
select p.academy_id, 'instructor', p.code, 'replaced', p.created_by, p.created_at, now()
from public.professor_codes p
where not exists (select 1 from public.academy_invite_codes c where c.code = p.code);

-- A fixed professor code for every existing academy (one by one, so the
-- generator sees the codes inserted before).
do $$
declare
  a record;
begin
  for a in select id, created_by from public.academies loop
    insert into public.academy_invite_codes (academy_id, code_type, code, created_by)
    values (a.id, 'instructor', private.new_invite_code(), a.created_by);
  end loop;
end;
$$;

-- New academies (create_academy, create_academy_with_setup, seed) get both codes.
create function private.create_academy_invite_codes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.academy_invite_codes (academy_id, code_type, code, created_by)
  values (new.id, 'student', private.new_invite_code(), new.created_by);
  insert into public.academy_invite_codes (academy_id, code_type, code, created_by)
  values (new.id, 'instructor', private.new_invite_code(), new.created_by);
  return null;
end;
$$;

revoke all on function private.create_academy_invite_codes() from public, anon, authenticated;

create trigger academies_create_invite_codes after insert on public.academies
  for each row execute function private.create_academy_invite_codes();

-- -----------------------------------------------------------------------------
-- 3. Old model out (functions first: they reference the table/column)
-- -----------------------------------------------------------------------------
drop function public.regenerate_student_code(uuid);
drop function public.create_professor_code(uuid);
drop function private.professor_code_is_live(public.professor_codes);
drop table public.professor_codes;
drop function private.guard_professor_code_update();
alter table public.academies drop column invite_code;

-- -----------------------------------------------------------------------------
-- 4. Access: reads only (writes through the RPCs below)
-- -----------------------------------------------------------------------------
alter table public.academy_invite_codes enable row level security;

grant select on public.academy_invite_codes to authenticated;

create policy "academy_invite_codes: owner reads"
  on public.academy_invite_codes for select to authenticated
  using (private.is_owner(academy_id));

create policy "academy_invite_codes: staff reads the active student code"
  on public.academy_invite_codes for select to authenticated
  using (code_type = 'student' and status = 'active' and private.is_staff(academy_id));

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------

-- "Gerar novo código" (owner only). SECURITY DEFINER: the generator is private
-- and the table has no write grants. The academy row is locked so two
-- regenerations at once cannot both replace the same code.
create function public.regenerate_invite_code(p_academy_id uuid, p_code_type public.membership_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
begin
  if v_uid is null or not private.is_owner(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_code_type is null or p_code_type not in ('student', 'instructor') then
    raise exception 'invalid_code_type' using errcode = '22023';
  end if;

  -- NO KEY UPDATE: serializes regenerations without blocking FK inserts (memberships, check-ins…).
  perform 1 from public.academies where id = p_academy_id for no key update;

  update public.academy_invite_codes
  set status = 'replaced', replaced_at = now()
  where academy_id = p_academy_id and code_type = p_code_type and status = 'active';

  insert into public.academy_invite_codes (academy_id, code_type, code, created_by)
  values (p_academy_id, p_code_type, private.new_invite_code(), v_uid)
  returning code into v_code;
  return v_code;
end;
$$;

-- Callable by anon (shown BEFORE sign-in): only the academy name, its logo
-- path and the code kind, for an ACTIVE code. Anything else returns no row,
-- without telling why. Same per-IP failure limit as before.
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
    select a.name, a.logo_path, c.code_type
    from public.academy_invite_codes c
    join public.academies a on a.id = c.academy_id
    where c.code = v_code and c.status = 'active';
  get diagnostics v_rows = row_count;

  if v_rows = 0 and v_ip is not null then
    insert into private.code_lookup_failures (client_ip) values (v_ip);
    delete from private.code_lookup_failures
    where client_ip = v_ip and attempted_at < now() - interval '1 day';
  end if;
end;
$$;

-- Active code → pending request with the role the code carries. Codes are
-- reusable now: nothing is spent. Already active or pending in that academy:
-- the existing membership is returned (is_new = false).
create or replace function public.join_with_code(p_code text)
returns table (membership_id uuid, academy_id uuid, status public.membership_status, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_academy_id uuid;
  v_role public.membership_role;
  v_membership_id uuid;
  v_is_new boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select c.academy_id, c.code_type into v_academy_id, v_role
  from public.academy_invite_codes c
  where c.code = v_code and c.status = 'active';
  if not found then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  -- One join per user and academy at a time.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_academy_id::text, 0));

  select m.id into v_membership_id
  from public.memberships m
  where m.academy_id = v_academy_id and m.user_id = v_uid and m.status in ('active', 'pending');
  if not found then
    v_is_new := true;
    v_membership_id := private.request_join(v_uid, v_academy_id, v_role);
  end if;

  return query
    select m.id, m.academy_id, m.status, v_is_new
    from public.memberships m
    where m.id = v_membership_id;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid, public.membership_role) from public, anon;
grant execute on function public.regenerate_invite_code(uuid, public.membership_role) to authenticated;
revoke all on function public.join_with_code(text) from public, anon;
grant execute on function public.join_with_code(text) to authenticated;
revoke all on function public.lookup_invite_code(text) from public;
grant execute on function public.lookup_invite_code(text) to anon, authenticated;
