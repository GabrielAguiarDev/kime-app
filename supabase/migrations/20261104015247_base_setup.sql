-- =============================================================================
-- Kimi — Base setup
-- Private schema, deny-by-default privileges, shared enums and helpers.
--
-- The project has automatic RLS on new public tables and does NOT expose new
-- tables to the Data API: every table in later migrations grants access to
-- `authenticated` explicitly and ships its own policies. `anon` gets nothing.
-- =============================================================================

-- Not listed in [api].schemas: nothing here is reachable through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon;
-- Policies call private helpers as the invoking role.
grant usage on schema private to authenticated;

-- Deny-by-default for everything created from now on: every new table,
-- sequence and function must grant access explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
-- Competitor is not a role: it is a flag on a student membership.
create type public.membership_role as enum ('professor', 'student');
-- Joining an academy (invite code or link) always needs a professor's approval.
create type public.membership_status as enum ('pending', 'active', 'rejected');
create type public.checkin_status as enum ('pending', 'confirmed', 'rejected');

-- -----------------------------------------------------------------------------
-- updated_at maintenance (SECURITY INVOKER, runs as the writing role)
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

grant execute on function private.set_updated_at() to authenticated;
