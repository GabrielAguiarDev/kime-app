-- Keep the membership enum in English while the app still displays 'Professor'.
-- PostgreSQL renames existing enum data in place, including policy and check expressions.
-- Stored function source must be updated because PL/pgSQL resolves enum literals at runtime.
alter type public.membership_role rename value 'professor' to 'instructor';

CREATE OR REPLACE FUNCTION private.is_competitor_of(p_athlete_id uuid, p_academy_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        and viewer.role in ('owner', 'instructor')
    )
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_staff(p_academy_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'instructor')
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_staff_of_competitor(p_athlete_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships athlete on athlete.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role in ('owner', 'instructor')
      and athlete.user_id = p_athlete_id
      and athlete.status = 'active'
      and athlete.is_competitor
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_staff_of_member(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.academy_id = viewer.academy_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role in ('owner', 'instructor')
      and target.user_id = p_user_id
      and target.status in ('pending', 'active')
      and (viewer.role = 'owner' or target.role = 'student' or target.status = 'active')
  );
$function$;

CREATE OR REPLACE FUNCTION public.join_with_code(p_code text)
 RETURNS TABLE(membership_id uuid, academy_id uuid, status membership_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    v_role := 'instructor';
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
    if v_role = 'instructor' then
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
$function$;

CREATE OR REPLACE FUNCTION public.lookup_invite_code(p_code text)
 RETURNS TABLE(academy_name text, logo_path text, code_type membership_role)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select a.name, a.logo_path, 'instructor'::public.membership_role
    from public.professor_codes p
    join public.academies a on a.id = p.academy_id
    where p.code = v_code and private.professor_code_is_live(p);
end;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_ownership(p_academy_id uuid, p_membership_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and role = 'instructor'
    and status = 'active'
    and user_id <> v_uid
  for update;
  if not found then
    raise exception 'transfer_target_invalid' using errcode = '22023';
  end if;

  -- Demote first: the one-owner index is immediate.
  update public.memberships set role = 'instructor'
  where academy_id = p_academy_id and user_id = v_uid and role = 'owner';
  update public.memberships set role = 'owner'
  where id = p_membership_id;
end;
$function$;
