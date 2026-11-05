-- =============================================================================
-- Kimi — Wait after a rejected request: OFF for now (user decision, testing)
--
-- The wait before asking again after a rejection now comes from ONE place,
-- private.join_cooldown(). It returns 0 for now, so a rejected request can be
-- sent again right away. To turn the 24 h wait back on, replace the function
-- body with `select interval '24 hours';` in a new migration (nothing else
-- changes: request_join and the app message already handle it).
-- =============================================================================

create function private.join_cooldown()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '0';
$$;

revoke all on function private.join_cooldown() from public, anon, authenticated;

-- Same body as 20261105000400_prelaunch_hardening, the wait read from join_cooldown().
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
    if private.join_cooldown() > interval '0'
       and v_existing.decided_at > now() - private.join_cooldown() then
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
