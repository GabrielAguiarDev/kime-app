-- =============================================================================
-- Kimi — Platform admin (web/admin)
--
-- The admin page logs in with a Kimi account's e-mail + password plus TOTP
-- (aal2); Google/Apple sessions are refused. Only
-- accounts listed in private.platform_admins pass; that table has no grant at
-- all, so it is managed only through SQL (dashboard / CLI):
--
--   insert into private.platform_admins (user_id, note)
--   select id, 'dono do produto' from auth.users where email = '…';
--
-- Everything goes through the admin_* RPCs below (SECURITY DEFINER, each one
-- calls private.require_platform_admin() first). No table policy changes:
-- the app's RLS stays exactly as it was. The writes keep the app's
-- invariants (one owner per academy, an active student has at least one
-- modality, competitor columns) and are recorded in private.admin_audit_log.
-- =============================================================================

create table private.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action text not null,
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_target_idx on private.admin_audit_log (target_id, created_at desc);

revoke all on private.platform_admins, private.admin_audit_log from public, anon, authenticated;

-- Caller is a platform admin whose session began with e-mail + password and
-- passed the second factor (aal2), or the call fails. Returns the admin's id.
create function private.require_platform_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from private.platform_admins where user_id = v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Admin sessions start with e-mail + password (never Google/Apple) ...
  if not coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb) @> '[{"method": "password"}]'::jsonb then
    raise exception 'password_login_required' using errcode = '42501';
  end if;
  -- ... and passed the second factor (TOTP).
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;
revoke all on function private.require_platform_admin() from public, anon, authenticated;

create function private.admin_log(p_admin uuid, p_action text, p_target uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_audit_log (admin_id, action, target_id, details)
  values (p_admin, p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function private.admin_log(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- Search text for ILIKE with the wildcards escaped (null when blank).
create function private.admin_like(p_search text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when nullif(btrim(p_search), '') is null then null
    else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
$$;
revoke all on function private.admin_like(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reads
-- -----------------------------------------------------------------------------

-- Whether the caller is a platform admin (the page's gate; never raises).
-- Does not need aal2: the page asks it right after the password, to send
-- admins to the TOTP step and everyone else to "no access".
create function public.admin_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.platform_admins where user_id = (select auth.uid()));
$$;

create function public.admin_overview()
returns table (academies bigint, users bigint, active_students bigint, active_staff bigint, pending_requests bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query select
    (select count(*) from public.academies),
    (select count(*) from public.profiles p join auth.users u on u.id = p.id where not coalesce(u.is_anonymous, false)),
    (select count(*) from public.memberships where status = 'active' and role = 'student'),
    (select count(*) from public.memberships where status = 'active' and role <> 'student'),
    (select count(*) from public.memberships where status = 'pending');
end;
$$;

create function public.admin_list_academies(p_search text default null)
returns table (
  id uuid, name text, logo_path text, plan_tier text, created_at timestamptz,
  owner_id uuid, owner_name text, owner_email text,
  students bigint, staff bigint, pending bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := private.admin_like(p_search);
begin
  perform private.require_platform_admin();
  return query
  select a.id, a.name, a.logo_path, a.plan_tier, a.created_at,
    o.user_id, op.full_name, ou.email::text,
    (select count(*) from public.memberships m where m.academy_id = a.id and m.status = 'active' and m.role = 'student'),
    (select count(*) from public.memberships m where m.academy_id = a.id and m.status = 'active' and m.role <> 'student'),
    (select count(*) from public.memberships m where m.academy_id = a.id and m.status = 'pending')
  from public.academies a
  left join public.memberships o on o.academy_id = a.id and o.role = 'owner'
  left join public.profiles op on op.id = o.user_id
  left join auth.users ou on ou.id = o.user_id
  where v_like is null or a.name ilike v_like or op.full_name ilike v_like or ou.email ilike v_like
  order by a.name;
end;
$$;

create function public.admin_get_academy(p_academy_id uuid)
returns table (
  id uuid, name text, logo_path text, plan_tier text, timezone text, inactive_after_days integer,
  created_at timestamptz, owner_id uuid, owner_name text, owner_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select a.id, a.name, a.logo_path, a.plan_tier, a.timezone, a.inactive_after_days::integer, a.created_at,
    o.user_id, op.full_name, ou.email::text
  from public.academies a
  left join public.memberships o on o.academy_id = a.id and o.role = 'owner'
  left join public.profiles op on op.id = o.user_id
  left join auth.users ou on ou.id = o.user_id
  where a.id = p_academy_id;
end;
$$;

create function public.admin_academy_modalities(p_academy_id uuid)
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select mo.id, mo.name from public.academy_modalities mo
  where mo.academy_id = p_academy_id
  order by mo.position, mo.name;
end;
$$;

-- Every membership of the academy (any status), with the active modality links.
create function public.admin_list_members(p_academy_id uuid)
returns table (
  membership_id uuid, user_id uuid, full_name text, email text,
  role public.membership_role, status public.membership_status, is_competitor boolean,
  created_at timestamptz, decided_at timestamptz, modalities jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select m.id, m.user_id, p.full_name, u.email::text, m.role, m.status, m.is_competitor,
    m.created_at, m.decided_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'enrollment_id', e.id, 'modality_id', e.modality_id, 'name', mo.name, 'is_competitor', e.is_competitor
      ) order by mo.position, mo.name)
      from public.student_modality_enrollments e
      join public.academy_modalities mo on mo.id = e.modality_id
      where e.membership_id = m.id and e.status = 'active'
    ), '[]'::jsonb)
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.academy_id = p_academy_id
  order by
    case m.status when 'pending' then 0 when 'active' then 1 else 2 end,
    case m.role when 'owner' then 0 when 'instructor' then 1 else 2 end,
    p.full_name;
end;
$$;

create function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, full_name text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  academies bigint, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := private.admin_like(p_search);
begin
  perform private.require_platform_admin();
  return query
  select p.id, p.full_name, u.email::text, p.created_at, u.last_sign_in_at,
    (select count(*) from public.memberships m where m.user_id = p.id and m.status = 'active'),
    count(*) over ()
  from public.profiles p
  left join auth.users u on u.id = p.id
  where not coalesce(u.is_anonymous, false)
    and (v_like is null or p.full_name ilike v_like or u.email ilike v_like)
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- One user: profile, account data and every membership.
create function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_platform_admin();
  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', u.email,
    'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'is_anonymous', coalesce(u.is_anonymous, false),
    'birth_date', p.birth_date,
    'sex', p.sex,
    'height_cm', p.height_cm,
    'weight_kg', p.weight_kg,
    'reach_cm', p.reach_cm,
    'timezone', p.timezone,
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'academy_id', a.id, 'academy_name', a.name,
        'role', m.role, 'status', m.status, 'is_competitor', m.is_competitor, 'created_at', m.created_at
      ) order by a.name)
      from public.memberships m join public.academies a on a.id = m.academy_id
      where m.user_id = p.id
    ), '[]'::jsonb)
  ) into v_result
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Writes
-- -----------------------------------------------------------------------------

create function public.admin_update_academy(
  p_academy_id uuid, p_name text, p_plan_tier text, p_inactive_after_days integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_old public.academies;
begin
  select * into v_old from public.academies where id = p_academy_id for update;
  if v_old.id is null then
    raise exception 'academy_not_found' using errcode = '22023';
  end if;
  update public.academies
  set name = btrim(p_name),
      plan_tier = nullif(btrim(p_plan_tier), ''),
      inactive_after_days = p_inactive_after_days
  where id = p_academy_id;
  perform private.admin_log(v_admin, 'update_academy', p_academy_id, jsonb_build_object(
    'before', jsonb_build_object('name', v_old.name, 'plan_tier', v_old.plan_tier, 'inactive_after_days', v_old.inactive_after_days),
    'after', jsonb_build_object('name', btrim(p_name), 'plan_tier', nullif(btrim(p_plan_tier), ''), 'inactive_after_days', p_inactive_after_days)));
end;
$$;

create function public.admin_update_profile(
  p_user_id uuid, p_full_name text, p_birth_date date, p_sex text,
  p_height_cm numeric, p_weight_kg numeric, p_reach_cm numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_old public.profiles;
begin
  select * into v_old from public.profiles where id = p_user_id for update;
  if v_old.id is null then
    raise exception 'profile_not_found' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  update public.profiles
  set full_name = btrim(p_full_name),
      birth_date = p_birth_date,
      sex = p_sex,
      height_cm = p_height_cm,
      reach_cm = p_reach_cm
  where id = p_user_id;
  -- Only when it changes: a weight update recalculates the water goal.
  if p_weight_kg is distinct from v_old.weight_kg then
    update public.profiles set weight_kg = p_weight_kg where id = p_user_id;
  end if;
  perform private.admin_log(v_admin, 'update_profile', p_user_id, jsonb_build_object(
    'before', jsonb_build_object('full_name', v_old.full_name, 'birth_date', v_old.birth_date, 'sex', v_old.sex,
      'height_cm', v_old.height_cm, 'weight_kg', v_old.weight_kg, 'reach_cm', v_old.reach_cm),
    'after', jsonb_build_object('full_name', btrim(p_full_name), 'birth_date', p_birth_date, 'sex', p_sex,
      'height_cm', p_height_cm, 'weight_kg', p_weight_kg, 'reach_cm', p_reach_cm)));
end;
$$;

-- Approve or reject a pending request. A student is approved with their
-- modalities (at least one), like approve_student.
create function public.admin_decide_membership(p_membership_id uuid, p_approve boolean, p_modality_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_m public.memberships;
  v_id uuid;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null then
    raise exception 'membership_not_found' using errcode = '22023';
  end if;
  if v_m.status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = '22023';
  end if;

  if not p_approve then
    update public.memberships set status = 'rejected', decided_by = v_admin, decided_at = now()
    where id = p_membership_id;
  else
    if v_m.role = 'student' and not private.valid_modality_set(v_m.academy_id, p_modality_ids) then
      raise exception 'student_modality_required' using errcode = '22023';
    end if;
    update public.memberships set status = 'active', decided_by = v_admin, decided_at = now()
    where id = p_membership_id;
    if v_m.role = 'student' then
      foreach v_id in array (select array_agg(distinct x) from unnest(p_modality_ids) x) loop
        perform private.activate_enrollment(p_membership_id, v_id);
      end loop;
    end if;
  end if;
  perform private.admin_log(v_admin, case when p_approve then 'approve_membership' else 'reject_membership' end,
    p_membership_id, jsonb_build_object('academy_id', v_m.academy_id, 'user_id', v_m.user_id, 'role', v_m.role,
      'modality_ids', to_jsonb(p_modality_ids)));
end;
$$;

-- Active member: professor ↔ student. The owner never changes here (the app's
-- transfer_ownership is the only way). Becoming a student needs modalities;
-- becoming a professor ends the modality links (with their future
-- championship entries); becoming a student, the member stops teaching
-- modalities and leaves the schedules they gave.
create function public.admin_set_member_role(p_membership_id uuid, p_role public.membership_role, p_modality_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_m public.memberships;
  v_id uuid;
  v_e public.student_modality_enrollments;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null then
    raise exception 'membership_not_found' using errcode = '22023';
  end if;
  if v_m.role = 'owner' or p_role is null or p_role = 'owner' or v_m.status <> 'active' then
    raise exception 'role_change_invalid' using errcode = '22023';
  end if;
  if v_m.role = p_role then
    return;
  end if;

  if p_role = 'student' then
    if not private.valid_modality_set(v_m.academy_id, p_modality_ids) then
      raise exception 'student_modality_required' using errcode = '22023';
    end if;
    update public.memberships set role = 'student' where id = p_membership_id;
    delete from public.instructor_modalities where membership_id = p_membership_id;
    update public.class_schedules set instructor_id = null
    where academy_id = v_m.academy_id and instructor_id = v_m.user_id;
    foreach v_id in array (select array_agg(distinct x) from unnest(p_modality_ids) x) loop
      perform private.activate_enrollment(p_membership_id, v_id);
    end loop;
  else
    -- Like the app ending a link: future championship entries go too.
    for v_e in
      select * from public.student_modality_enrollments where membership_id = p_membership_id and status = 'active'
    loop
      perform private.end_enrollment(v_e.id);
    end loop;
    update public.memberships set role = p_role where id = p_membership_id;
  end if;
  perform private.admin_log(v_admin, 'set_member_role', p_membership_id, jsonb_build_object(
    'academy_id', v_m.academy_id, 'user_id', v_m.user_id, 'from', v_m.role, 'to', p_role,
    'modality_ids', to_jsonb(p_modality_ids)));
end;
$$;

-- Active student: the whole set of modalities (at least one).
create function public.admin_set_student_modalities(p_membership_id uuid, p_modality_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_m public.memberships;
  v_id uuid;
  v_e public.student_modality_enrollments;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null or v_m.role <> 'student' or v_m.status <> 'active' then
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
  perform private.admin_log(v_admin, 'set_student_modalities', p_membership_id, jsonb_build_object(
    'academy_id', v_m.academy_id, 'user_id', v_m.user_id, 'modality_ids', to_jsonb(p_modality_ids)));
end;
$$;

-- Competitor in one active modality link, directly (no invite to accept).
-- Taking someone off the team works like the app's remove_competitor: future
-- entries in championships of that modality go, past ones stay as history.
-- Locks the membership before the link, in the same order as the app's RPCs.
create function public.admin_set_competitor(p_enrollment_id uuid, p_is_competitor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_e public.student_modality_enrollments;
  v_m public.memberships;
  v_value boolean := coalesce(p_is_competitor, false);
begin
  select m.* into v_m from public.memberships m
  where m.id = (select e.membership_id from public.student_modality_enrollments e where e.id = p_enrollment_id)
  for update;
  select * into v_e from public.student_modality_enrollments where id = p_enrollment_id for update;
  if v_e.id is null or v_e.status <> 'active' or v_m.role <> 'student' or v_m.status <> 'active' then
    raise exception 'competitor_target_invalid' using errcode = '22023';
  end if;
  update public.student_modality_enrollments
  set is_competitor = v_value, competitor_invited_at = null, competitor_invited_by = null, updated_at = now()
  where id = p_enrollment_id;
  if not v_value then
    delete from public.championship_entries ce
    using public.championships c
    where ce.championship_id = c.id
      and c.modality_id = v_e.modality_id
      and ce.academy_id = v_m.academy_id
      and ce.athlete_id = v_m.user_id
      and c.event_date >= private.academy_local_date(v_m.academy_id);
  end if;
  perform private.admin_log(v_admin, 'set_competitor', p_enrollment_id, jsonb_build_object(
    'academy_id', v_m.academy_id, 'user_id', v_m.user_id, 'modality_id', v_e.modality_id, 'is_competitor', v_value));
end;
$$;

-- Removes a membership from the academy (same as the owner removing someone
-- in the app). The owner is never removed.
create function public.admin_remove_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_platform_admin();
  v_m public.memberships;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null then
    raise exception 'membership_not_found' using errcode = '22023';
  end if;
  if v_m.role = 'owner' then
    raise exception 'cannot_remove_owner' using errcode = '22023';
  end if;
  delete from public.memberships where id = p_membership_id;
  perform private.admin_log(v_admin, 'remove_membership', p_membership_id, jsonb_build_object(
    'academy_id', v_m.academy_id, 'user_id', v_m.user_id, 'role', v_m.role, 'status', v_m.status));
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: authenticated may call; every function checks the admin list itself.
-- -----------------------------------------------------------------------------
revoke all on function
  public.admin_is_admin(),
  public.admin_overview(),
  public.admin_list_academies(text),
  public.admin_get_academy(uuid),
  public.admin_academy_modalities(uuid),
  public.admin_list_members(uuid),
  public.admin_list_users(text, integer, integer),
  public.admin_get_user(uuid),
  public.admin_update_academy(uuid, text, text, integer),
  public.admin_update_profile(uuid, text, date, text, numeric, numeric, numeric),
  public.admin_decide_membership(uuid, boolean, uuid[]),
  public.admin_set_member_role(uuid, public.membership_role, uuid[]),
  public.admin_set_student_modalities(uuid, uuid[]),
  public.admin_set_competitor(uuid, boolean),
  public.admin_remove_membership(uuid)
from public, anon;

grant execute on function
  public.admin_is_admin(),
  public.admin_overview(),
  public.admin_list_academies(text),
  public.admin_get_academy(uuid),
  public.admin_academy_modalities(uuid),
  public.admin_list_members(uuid),
  public.admin_list_users(text, integer, integer),
  public.admin_get_user(uuid),
  public.admin_update_academy(uuid, text, text, integer),
  public.admin_update_profile(uuid, text, date, text, numeric, numeric, numeric),
  public.admin_decide_membership(uuid, boolean, uuid[]),
  public.admin_set_member_role(uuid, public.membership_role, uuid[]),
  public.admin_set_student_modalities(uuid, uuid[]),
  public.admin_set_competitor(uuid, boolean),
  public.admin_remove_membership(uuid)
to authenticated;
