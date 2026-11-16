-- Landing page pricing (2026-11-16): the static landing (web/landing) reads the
-- plan catalog with the anon key, so the prices there follow the admin.
-- list_public_plans() is security definer and only returns plans on sale
-- (code, name, price, discount, student limit, benefits, trial, highlight),
-- the same data shown in the app sign-up. The table itself stays closed.
grant execute on function public.list_public_plans() to anon;
