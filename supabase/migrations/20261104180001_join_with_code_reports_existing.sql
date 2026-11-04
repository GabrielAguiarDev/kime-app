-- =============================================================================
-- Kimi — join_with_code tells whether the request is new
-- The app shows "Você já faz parte da …" / "Seu pedido para a … já está
-- aguardando aprovação" instead of pretending a new request was sent.
-- Same body as before plus the `is_new` column (false when the user was
-- already active or pending: nothing was created, no code was spent).
-- =============================================================================

drop function public.join_with_code(text);

create function public.join_with_code(p_code text)
returns table (membership_id uuid, academy_id uuid, status public.membership_status, is_new boolean)
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
  v_is_new boolean := false;
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
    v_is_new := true;
    v_membership_id := private.request_join(v_uid, v_academy_id, v_role);
    if v_role = 'instructor' then
      update public.professor_codes
      set used_at = now(), used_by = v_uid
      where id = v_professor_code.id;
    end if;
  end if;

  return query
    select m.id, m.academy_id, m.status, v_is_new
    from public.memberships m
    where m.id = v_membership_id;
end;
$$;

revoke all on function public.join_with_code(text) from public, anon;
grant execute on function public.join_with_code(text) to authenticated;
