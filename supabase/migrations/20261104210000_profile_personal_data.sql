-- =============================================================================
-- Kimi — Personal data on the profile ("Meus dados")
-- sex and birth_date, edited only by the user (existing "profiles: update own"
-- policy + column grants). weight_kg / height_cm already exist (water goal).
-- Same visibility as the rest of the profile: the user and the staff of
-- academies where the user has a membership (private.is_staff_of_member).
-- =============================================================================

alter table public.profiles
  add column sex text check (sex in ('female', 'male', 'unspecified')),
  -- Lower bound only: a CHECK with current_date would break dump restores; the app rejects future dates.
  add column birth_date date check (birth_date >= date '1900-01-01');

grant update (sex, birth_date) on public.profiles to authenticated;
