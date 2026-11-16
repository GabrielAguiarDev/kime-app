-- =============================================================================
-- Kimi — Platform admin without the second factor (2026-11-16, user's call)
--
-- The admin no longer requires TOTP (aal2). It still requires an account in
-- private.platform_admins and a session that began with e-mail + password.
-- To bring the second factor back, re-add the aal check below.
-- =============================================================================

create or replace function private.require_platform_admin()
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
  -- Admin sessions start with e-mail + password (never Google/Apple).
  if not coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb) @> '[{"method": "password"}]'::jsonb then
    raise exception 'password_login_required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;
revoke all on function private.require_platform_admin() from public, anon, authenticated;
