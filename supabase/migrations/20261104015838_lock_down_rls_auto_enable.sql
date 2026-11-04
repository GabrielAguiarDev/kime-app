-- =============================================================================
-- Kimi — Lock down public.rls_auto_enable()
-- The hosted project's "automatic RLS" setting installs this SECURITY DEFINER
-- event-trigger function in public, executable by anon/authenticated (advisor
-- 0028/0029). Event triggers fire regardless of EXECUTE, so revoking it only
-- removes API exposure. It does not exist on the local stack, hence the guard.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
