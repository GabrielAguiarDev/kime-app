-- The ready-made timer presets (Boxe, Muay Thai, MMA, rola) live in the app;
-- each user may remove the ones they don't use (user decision, 2026-11-06).
-- Stored as the hidden built-in ids (`builtin:*`), on the profile so it
-- follows the user across devices and sign-outs.
alter table public.profiles
  add column hidden_timer_presets text[] not null default '{}'
  constraint profiles_hidden_timer_presets_size check (cardinality(hidden_timer_presets) <= 20);
grant select(hidden_timer_presets), update(hidden_timer_presets) on public.profiles to authenticated;
