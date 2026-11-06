-- Profile reads use column-level grants; retain the existing row policies.
grant select (personal_water_goal_ml) on public.profiles to authenticated;
