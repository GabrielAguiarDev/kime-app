-- =============================================================================
-- Kimi — Account deletion: academy logos
--
-- Storage files cannot be deleted with SQL (storage.protect_delete): the app
-- removes them through the Storage API, and only the owner may. So, before
-- delete_my_account, the app asks which academies go with the account
-- (account_deletion_academies), deletes their logo folders while still the
-- owner, then deletes the account.
-- =============================================================================

-- Raises owner_must_transfer when the caller owns an academy that other active
-- members still use; otherwise returns the academies the account takes along.
create function public.account_deletion_academies()
returns table (academy_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_blocked text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select string_agg(a.name, ', ' order by a.name) into v_blocked
  from public.memberships own
  join public.academies a on a.id = own.academy_id
  where own.user_id = v_uid
    and own.role = 'owner'
    and exists (
      select 1 from public.memberships other
      where other.academy_id = own.academy_id
        and other.user_id <> v_uid
        and other.status = 'active'
    );
  if v_blocked is not null then
    raise exception 'owner_must_transfer' using errcode = '23514', detail = v_blocked;
  end if;

  return query
    select own.academy_id
    from public.memberships own
    where own.user_id = v_uid and own.role = 'owner';
end;
$$;

revoke all on function public.account_deletion_academies() from public, anon;
grant execute on function public.account_deletion_academies() to authenticated;
