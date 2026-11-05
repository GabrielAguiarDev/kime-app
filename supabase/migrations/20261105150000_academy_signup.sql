-- =============================================================================
-- Kimi — Academy sign-up flow (plans → name → logo → modalities → done)
--
--   academies.plan_tier         plan picked in the sign-up (illustrative, no
--                               billing yet); optional, null for academies
--                               created before. Written only by the function
--                               below (no column grant to the client).
--   create_academy_with_setup   ONE call at the end of the modalities step:
--                               academy + owner membership + modalities (each
--                               with or without belts) + suggested belts
--                               (no class counts). Nothing is created if the
--                               user gives up halfway, and nothing half-made
--                               is left if any part fails (single statement).
--
-- create_academy(name, modalities) stays for the existing callers / tests.
-- canCreateAcademy() (app) is still the single gate for who may create.
-- =============================================================================

alter table public.academies
  add column plan_tier text check (plan_tier in ('starter', 'pro', 'elite'));

comment on column public.academies.plan_tier is
  'Plan picked at sign-up (starter | pro | elite). No billing yet; read when subscriptions exist.';

-- p_modalities: jsonb array, 1..20 items, in display order:
--   [{ "name": "Jiu-Jitsu", "uses_belts": true,
--      "belts": [{ "primary_color": "white", "tip_color": null }, ...] }, ...]
-- Belts only for modalities with uses_belts; at most 30 per modality.
create or replace function public.create_academy_with_setup(
  p_name text,
  p_plan_tier text,
  p_modalities jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_academy_id uuid;
  v_item jsonb;
  v_ord int;
  v_modality_name text;
  v_uses_belts boolean;
  v_modality_id uuid;
  v_belt jsonb;
  v_belt_ord int;
  v_primary text;
  v_tip text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_academy_name' using errcode = '22023';
  end if;
  if p_plan_tier is not null and p_plan_tier not in ('starter', 'pro', 'elite') then
    raise exception 'invalid_plan_tier' using errcode = '22023';
  end if;
  if p_modalities is null or jsonb_typeof(p_modalities) <> 'array'
     or jsonb_array_length(p_modalities) not between 1 and 20 then
    raise exception 'invalid_modalities' using errcode = '22023';
  end if;

  -- Names: trimmed, 1..60 chars, unique ignoring case.
  if exists (
    select 1 from jsonb_array_elements(p_modalities) e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 'name') <> 'string'
       or char_length(btrim(e ->> 'name')) not between 1 and 60
  ) or (
    select count(distinct lower(btrim(e ->> 'name'))) from jsonb_array_elements(p_modalities) e
  ) <> jsonb_array_length(p_modalities) then
    raise exception 'invalid_modalities' using errcode = '22023';
  end if;

  insert into public.academies (name, created_by, plan_tier)
  values (v_name, v_uid, p_plan_tier)
  returning id into v_academy_id;

  insert into public.memberships (academy_id, user_id, role, status, decided_by, decided_at)
  values (v_academy_id, v_uid, 'owner', 'active', v_uid, now());

  for v_item, v_ord in
    select e, (o - 1)::int from jsonb_array_elements(p_modalities) with ordinality as t (e, o)
  loop
    v_modality_name := btrim(v_item ->> 'name');
    v_uses_belts := coalesce((v_item ->> 'uses_belts')::boolean, false);

    insert into public.academy_modalities (academy_id, name, position, uses_belts)
    values (v_academy_id, v_modality_name, v_ord::smallint, v_uses_belts)
    returning id into v_modality_id;

    if v_item ? 'belts' and jsonb_typeof(v_item -> 'belts') <> 'null' then
      if jsonb_typeof(v_item -> 'belts') <> 'array' or jsonb_array_length(v_item -> 'belts') > 30
         or (not v_uses_belts and jsonb_array_length(v_item -> 'belts') > 0) then
        raise exception 'invalid_belts' using errcode = '22023';
      end if;

      for v_belt, v_belt_ord in
        select b, (o - 1)::int from jsonb_array_elements(v_item -> 'belts') with ordinality as t (b, o)
      loop
        v_primary := v_belt ->> 'primary_color';
        v_tip := nullif(v_belt ->> 'tip_color', '');
        -- Colors are checked by the table (palette keys, one look per modality).
        insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required)
        values (v_academy_id, v_modality_id, v_primary, v_tip, v_belt_ord::smallint, null);
      end loop;
    end if;
  end loop;

  return v_academy_id;
end;
$$;

revoke all on function public.create_academy_with_setup(text, text, jsonb) from public, anon;
grant execute on function public.create_academy_with_setup(text, text, jsonb) to authenticated;
