-- =============================================================================
-- Kimi — Extra belt shades ("Mais cores")
-- Light/dark variations of the design-system palette (2.4), chosen by the
-- user on 2026-11-04. Same storage as the base colors: keys in
-- modality_belts.primary_color / tip_color, names derived in the app.
-- =============================================================================

create or replace function private.is_belt_color(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_key in (
    'white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black', 'red',
    'light_gray', 'dark_gray', 'dark_yellow', 'light_green', 'dark_green',
    'light_blue', 'dark_blue', 'light_purple', 'light_brown', 'dark_red'
  );
$$;
