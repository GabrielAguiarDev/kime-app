-- =============================================================================
-- Kimi — Diet plan writes (phase 5)
--
-- diet_plans (one per competitor, academy and day) + diet_plan_meals already
-- exist with their policies (staff write for competitors of their academy; the
-- competitor reads their own). These RPCs are SECURITY INVOKER: the policies
-- decide, the functions only keep the day row and the meal positions right.
-- =============================================================================

create index diet_plans_athlete_date_idx on public.diet_plans (athlete_id, plan_date);

-- Creates or edits one meal of a day. p_meal_id null = new meal, appended
-- after the others. p_meal_time null = no time.
create function public.save_diet_meal(
  p_academy_id uuid,
  p_athlete_id uuid,
  p_plan_date date,
  p_meal_id uuid,
  p_name text,
  p_meal_time time,
  p_description text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_meal_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_meal_id is not null then
    update public.diet_plan_meals m
    set name = btrim(p_name), meal_time = p_meal_time, description = coalesce(p_description, '')
    from public.diet_plans p
    where m.id = p_meal_id
      and p.id = m.plan_id
      and p.academy_id = p_academy_id
      and p.athlete_id = p_athlete_id
      and p.plan_date = p_plan_date
    returning m.id into v_meal_id;
    if v_meal_id is null then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    return v_meal_id;
  end if;

  insert into public.diet_plans (athlete_id, academy_id, plan_date)
  values (p_athlete_id, p_academy_id, p_plan_date)
  on conflict (athlete_id, academy_id, plan_date) do update set updated_at = now()
  returning id into v_plan_id;

  insert into public.diet_plan_meals (plan_id, position, name, meal_time, description)
  select v_plan_id,
         coalesce((select max(position) + 1 from public.diet_plan_meals where plan_id = v_plan_id), 0),
         btrim(p_name), p_meal_time, coalesce(p_description, '')
  returning id into v_meal_id;
  return v_meal_id;
end;
$$;

-- Replaces the meals of p_to_date with a copy of p_from_date's (same athlete
-- and academy). Copying an empty day clears the target day.
create function public.copy_diet_day(
  p_academy_id uuid,
  p_athlete_id uuid,
  p_from_date date,
  p_to_date date
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_from uuid;
  v_to uuid;
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_from_date = p_to_date then
    raise exception 'diet_copy_same_day' using errcode = '22023';
  end if;

  select id into v_from from public.diet_plans
  where athlete_id = p_athlete_id and academy_id = p_academy_id and plan_date = p_from_date;

  insert into public.diet_plans (athlete_id, academy_id, plan_date)
  values (p_athlete_id, p_academy_id, p_to_date)
  on conflict (athlete_id, academy_id, plan_date) do update set updated_at = now()
  returning id into v_to;

  delete from public.diet_plan_meals where plan_id = v_to;
  insert into public.diet_plan_meals (plan_id, position, name, meal_time, description)
  select v_to, position, name, meal_time, description
  from public.diet_plan_meals
  where plan_id = v_from;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function
  public.save_diet_meal(uuid, uuid, date, uuid, text, time, text),
  public.copy_diet_day(uuid, uuid, date, date)
from public, anon;
grant execute on function
  public.save_diet_meal(uuid, uuid, date, uuid, text, time, text),
  public.copy_diet_day(uuid, uuid, date, date)
to authenticated;
