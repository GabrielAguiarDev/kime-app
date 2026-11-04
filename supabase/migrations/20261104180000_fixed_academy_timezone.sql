-- =============================================================================
-- Kimi — Academy time zone fixed to America/Sao_Paulo (product decision,
-- 2026-11-04). The column stays (academy_local_date and the class stats read
-- it), always with this value: the app no longer offers a choice and clients
-- lose the column grant. Only migrations / the service role can change it.
-- =============================================================================

update public.academies set timezone = 'America/Sao_Paulo' where timezone <> 'America/Sao_Paulo';

alter table public.academies alter column timezone set default 'America/Sao_Paulo';

revoke update (timezone) on public.academies from authenticated;

comment on column public.academies.timezone is
  'Always America/Sao_Paulo for now (fixed by product). Defines "today" for classes.';
