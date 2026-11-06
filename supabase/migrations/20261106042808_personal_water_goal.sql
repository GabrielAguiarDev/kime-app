-- Personal fallback; staff plans retain priority in ranking_water_target.
alter table public.profiles add column personal_water_goal_ml integer
  check (personal_water_goal_ml between 50 and 20000);
grant update (personal_water_goal_ml) on public.profiles to authenticated;

create function private.guard_personal_water_goal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.personal_water_goal_ml is distinct from old.personal_water_goal_ml and exists (
    select 1 from public.memberships m
    where m.user_id = new.id and m.status = 'active' and m.is_competitor
  ) and exists (
    select 1 from public.water_plan_days d where d.plan_id = (
      select p.id from public.water_plans p
      where p.athlete_id = new.id and p.week_start <= (now() at time zone new.timezone)::date
      order by p.week_start desc, p.updated_at desc, p.id limit 1
    )
  ) then
    raise exception 'Sua meta está bloqueada pelo plano do professor.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.guard_personal_water_goal() from public, anon, authenticated;
create trigger profiles_guard_personal_water_goal before update of personal_water_goal_ml on public.profiles
for each row execute function private.guard_personal_water_goal();

create or replace function private.track_water_auto_goal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.water_auto_goal_history(user_id, effective_on, goal_ml)
  values (new.id, (now() at time zone 'America/Sao_Paulo')::date,
    coalesce(new.personal_water_goal_ml, round(new.weight_kg * 35)::integer))
  on conflict(user_id, effective_on) do update set goal_ml = excluded.goal_ml;
  return null;
end $$;
drop trigger profiles_water_goal_history on public.profiles;
create trigger profiles_water_goal_history after insert or update of weight_kg, personal_water_goal_ml on public.profiles
for each row execute function private.track_water_auto_goal();
