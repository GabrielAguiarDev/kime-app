-- A TV may remove only its own pairing. Its anonymous user and display row stay
-- in place so create_tv_pairing can issue a fresh code for the same browser.
create function public.tv_disconnect_self() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null
    or (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.tv_displays
  set academy_id = null,
      name = 'TV',
      pairing_code = null,
      pairing_expires_at = null,
      paired_by = null,
      paired_at = null,
      timer_state = null,
      state_version = state_version + 1
  where display_user_id = (select auth.uid());

  if not found then
    raise exception 'display_not_found' using errcode = '22023';
  end if;
end $$;

revoke all on function public.tv_disconnect_self() from public, anon;
grant execute on function public.tv_disconnect_self() to authenticated;
