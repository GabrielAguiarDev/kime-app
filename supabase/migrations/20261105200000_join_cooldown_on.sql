-- =============================================================================
-- Kimi — Wait after a rejected request: back ON (24 h), user decision.
-- Undoes 20261105190000_join_cooldown_off: request_join already reads the
-- wait from private.join_cooldown(); only the value changes.
-- =============================================================================

create or replace function private.join_cooldown()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '24 hours';
$$;

revoke all on function private.join_cooldown() from public, anon, authenticated;
