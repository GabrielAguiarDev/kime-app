-- =============================================================================
-- Timer: each user's presets are personal (2026-11-09, user decision: the
-- academy does not define timer presets for its members).
--
-- 1. profiles.timer_preset_order: the order of the user's list ("Gerenciar
--    predefinições", hold and drag). Ids of personal presets (uuid text) and
--    of ready-made ones (`builtin:*`); ids missing from it come after, in the
--    app's default order. Follows the user across devices, like
--    hidden_timer_presets.
-- 2. Academy presets (timer_presets) stop being shown: each one is copied to
--    the personal list of whoever created it, so the owner keeps them. The
--    table stays (unused by the app) until it is dropped in a later cleanup.
-- =============================================================================

alter table public.profiles
  add column timer_preset_order text[] not null default '{}'
  constraint profiles_timer_preset_order_size check (cardinality(timer_preset_order) <= 200);
grant select(timer_preset_order), update(timer_preset_order) on public.profiles to authenticated;

insert into public.personal_timer_presets (user_id, name, rounds, round_seconds, rest_seconds, warning_seconds)
select distinct on (t.created_by, lower(btrim(t.name)))
  t.created_by, btrim(t.name), t.rounds, t.round_seconds, t.rest_seconds, t.warning_seconds
from public.timer_presets t
where t.created_by is not null
order by t.created_by, lower(btrim(t.name)), t.created_at
on conflict (user_id, lower(btrim(name))) do nothing;
