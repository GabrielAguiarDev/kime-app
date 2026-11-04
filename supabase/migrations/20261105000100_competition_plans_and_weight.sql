-- =============================================================================
-- Kimi — Competition data (phase 4)
--
-- weight_logs: one weigh-in per athlete and day (the athlete corrects or
-- deletes it); the latest weigh-in also becomes the profile weight, which
-- drives the automatic water goal.
--
-- water_plans: a plan starts on its week (Monday) and holds until a newer one.
-- set_water_plan writes the plan of the academy's current week in one call.
-- weekday follows class_schedules: 0 = Sunday … 6 = Saturday.
--
-- set_championship_entries: replaces the competitors entered in a championship.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- weight_logs
-- -----------------------------------------------------------------------------
delete from public.weight_logs w
using public.weight_logs newer
where newer.athlete_id = w.athlete_id
  and newer.logged_on = w.logged_on
  and (newer.created_at, newer.id) > (w.created_at, w.id);

alter table public.weight_logs
  add constraint weight_logs_one_per_day unique (athlete_id, logged_on);
drop index public.weight_logs_athlete_logged_on_idx;

grant update (weight_kg) on public.weight_logs to authenticated;
grant delete on public.weight_logs to authenticated;

create policy "weight_logs: competitor updates own"
  on public.weight_logs for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()) and private.is_competitor());
create policy "weight_logs: athlete deletes own"
  on public.weight_logs for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- The most recent weigh-in is the athlete's current weight.
create function private.weight_log_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete uuid := coalesce(new.athlete_id, old.athlete_id);
  v_latest numeric(5, 2);
begin
  select w.weight_kg into v_latest
  from public.weight_logs w
  where w.athlete_id = v_athlete
  order by w.logged_on desc
  limit 1;
  if v_latest is not null then
    update public.profiles set weight_kg = v_latest
    where id = v_athlete and weight_kg is distinct from v_latest;
  end if;
  return null;
end;
$$;
revoke all on function private.weight_log_to_profile() from public, anon;
grant execute on function private.weight_log_to_profile() to authenticated;

create trigger weight_logs_to_profile after insert or update or delete on public.weight_logs
  for each row execute function private.weight_log_to_profile();

-- -----------------------------------------------------------------------------
-- water_plans
-- -----------------------------------------------------------------------------
create index water_plans_athlete_week_idx on public.water_plans (athlete_id, week_start desc);

-- Staff write the plan of the current week (academy calendar). p_targets has
-- 7 entries, index 1 = Sunday … 7 = Saturday (SQL arrays start at 1); null =
-- no target that day (the automatic goal applies). All null keeps an empty
-- plan for the week: from this week on, the automatic goal applies every day.
-- SECURITY INVOKER: the water_plans / water_plan_days policies decide.
create function public.set_water_plan(p_academy_id uuid, p_athlete_id uuid, p_targets integer[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.academy_local_date(p_academy_id);
  v_week date;
  v_plan_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if coalesce(array_length(p_targets, 1), 0) <> 7 then
    raise exception 'water_plan_invalid' using errcode = '22023';
  end if;
  v_week := v_today - (extract(isodow from v_today)::int - 1);

  insert into public.water_plans (athlete_id, academy_id, week_start)
  values (p_athlete_id, p_academy_id, v_week)
  on conflict (athlete_id, academy_id, week_start) do update set updated_at = now()
  returning id into v_plan_id;

  delete from public.water_plan_days where plan_id = v_plan_id;
  insert into public.water_plan_days (plan_id, weekday, target_ml)
  select v_plan_id, d - 1, p_targets[d]
  from generate_series(1, 7) d
  where p_targets[d] is not null;

  return v_plan_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- championship_entries
-- -----------------------------------------------------------------------------
-- Replaces the athletes entered in a championship. SECURITY INVOKER: the
-- policies only accept active competitors of the academy, entered by staff.
create function public.set_championship_entries(p_championship_id uuid, p_athlete_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_academy_id uuid;
begin
  select c.academy_id into v_academy_id from public.championships c where c.id = p_championship_id;
  if v_academy_id is null or not private.is_staff(v_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.championship_entries
  where championship_id = p_championship_id
    and not (athlete_id = any (coalesce(p_athlete_ids, '{}')));

  -- Athletes already entered stay as they are (one who left the team since
  -- would fail the insert policy).
  insert into public.championship_entries (championship_id, academy_id, athlete_id)
  select distinct p_championship_id, v_academy_id, a
  from unnest(coalesce(p_athlete_ids, '{}')) a
  where not exists (
    select 1 from public.championship_entries e
    where e.championship_id = p_championship_id and e.athlete_id = a
  );
end;
$$;

revoke all on function
  public.set_water_plan(uuid, uuid, integer[]),
  public.set_championship_entries(uuid, uuid[])
from public, anon;
grant execute on function
  public.set_water_plan(uuid, uuid, integer[]),
  public.set_championship_entries(uuid, uuid[])
to authenticated;
