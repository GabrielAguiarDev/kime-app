-- =============================================================================
-- Kimi — The academy logo cannot be removed (product decision, 2026-11-04)
-- It can be replaced (a new path), never set back to null once the academy has
-- one. Academies created before a logo existed keep null until the owner adds one.
-- =============================================================================

create function private.guard_logo_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.logo_path is not null and new.logo_path is null then
    raise exception 'logo_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_logo_removal() from public, anon;
grant execute on function private.guard_logo_removal() to authenticated;

create trigger academies_guard_logo_removal before update of logo_path on public.academies
  for each row execute function private.guard_logo_removal();
