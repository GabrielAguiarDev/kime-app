-- Championships may or may not count in the athlete's record ("cartel")
-- (user decision, 2026-11-10): an internal championship does not. The staff
-- member who creates or edits the championship decides; default true, so every
-- existing championship keeps counting.
--  - championships.counts_in_record (staff write it, like the other event columns);
--  - athlete_fight_history returns it (the Cartel screen lists every championship,
--    but only those that count are added up);
--  - fight_record_summary adds only the championships that count.

alter table public.championships add column counts_in_record boolean not null default true;
grant insert (counts_in_record), update (counts_in_record) on public.championships to authenticated;

drop function public.athlete_fight_history(uuid, uuid);
create function public.athlete_fight_history(p_academy_id uuid, p_athlete_id uuid)
returns table (
  entry_id uuid,
  championship_id uuid,
  modality_id uuid,
  name text,
  event_date date,
  location text,
  placement text,
  is_historical boolean,
  counts_in_record boolean,
  -- [{id, result, method, stage, opponent_name, note, created_at}] in recording order.
  fights jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff(p_academy_id) and private.is_finance_blocked(p_academy_id) then
    raise exception 'finance_blocked' using errcode = '42501';
  end if;
  if not (p_athlete_id = (select auth.uid()) or private.is_staff(p_academy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select e.id, c.id, c.modality_id, c.name, c.event_date, c.location, e.placement, c.is_historical, c.counts_in_record,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'result', f.result, 'method', f.method, 'stage', f.stage,
        'opponent_name', f.opponent_name, 'note', f.note, 'created_at', f.created_at
      ) order by f.created_at, f.id)
      from public.championship_fights f where f.entry_id = e.id
    ), '[]'::jsonb)
  from public.championship_entries e
  join public.championships c on c.id = e.championship_id
  where e.academy_id = p_academy_id
    and e.athlete_id = p_athlete_id
    and c.event_date <= private.academy_local_date(p_academy_id)
  order by c.event_date desc, c.name;
end;
$$;
revoke all on function public.athlete_fight_history(uuid, uuid) from public, anon;
grant execute on function public.athlete_fight_history(uuid, uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.fight_record_summary(p_academy_id uuid, p_athlete_id uuid)
 RETURNS TABLE(modality_id uuid, wins integer, losses integer, draws integer, gold integer, silver integer, bronze integer, championships integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_full boolean := p_athlete_id = (select auth.uid()) or private.is_staff(p_academy_id);
  v_viewer uuid;
begin
  if not private.is_staff(p_academy_id) and private.is_finance_blocked(p_academy_id) then
    raise exception 'finance_blocked' using errcode = '42501';
  end if;
  if not v_full then
    select m.id into v_viewer from public.memberships m
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = 'student';
    if v_viewer is null then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  return query
  with athlete as (
    select m.id from public.memberships m
    where m.academy_id = p_academy_id and m.user_id = p_athlete_id and m.status = 'active' and m.role = 'student'
  ),
  modalities as (
    -- Competes now…
    select e.modality_id
    from public.student_modality_enrollments e
    where e.membership_id = (select id from athlete) and e.is_competitor
      and (v_full or exists (
        select 1 from public.student_modality_enrollments ve
        where ve.membership_id = v_viewer and ve.status = 'active' and ve.modality_id = e.modality_id
      ))
    union
    -- …or has results (athlete / staff only).
    select c.modality_id
    from public.championship_entries en
    join public.championships c on c.id = en.championship_id
    where v_full and en.academy_id = p_academy_id and en.athlete_id = p_athlete_id
      and c.event_date <= private.academy_local_date(p_academy_id)
    union
    select pr.modality_id
    from public.athlete_previous_records pr
    where v_full and pr.academy_id = p_academy_id and pr.athlete_id = p_athlete_id
  ),
  entries as (
    select en.id, c.modality_id, en.placement
    from public.championship_entries en
    join public.championships c on c.id = en.championship_id
    where en.academy_id = p_academy_id and en.athlete_id = p_athlete_id
      and c.event_date <= private.academy_local_date(p_academy_id)
      -- Internal championships (counts_in_record = false) stay out of the record.
      and c.counts_in_record
  ),
  previous as (
    select pr.* from public.athlete_previous_records pr
    where pr.academy_id = p_academy_id and pr.athlete_id = p_athlete_id
  )
  select mo.modality_id,
    (select count(*)::int from public.championship_fights f join entries en on en.id = f.entry_id
      where en.modality_id = mo.modality_id and f.result = 'win')
      + coalesce((select p.wins from previous p where p.modality_id = mo.modality_id), 0),
    (select count(*)::int from public.championship_fights f join entries en on en.id = f.entry_id
      where en.modality_id = mo.modality_id and f.result = 'loss')
      + coalesce((select p.losses from previous p where p.modality_id = mo.modality_id), 0),
    (select count(*)::int from public.championship_fights f join entries en on en.id = f.entry_id
      where en.modality_id = mo.modality_id and f.result = 'draw')
      + coalesce((select p.draws from previous p where p.modality_id = mo.modality_id), 0),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id and en.placement = 'gold')
      + coalesce((select p.gold from previous p where p.modality_id = mo.modality_id), 0),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id and en.placement = 'silver')
      + coalesce((select p.silver from previous p where p.modality_id = mo.modality_id), 0),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id and en.placement = 'bronze')
      + coalesce((select p.bronze from previous p where p.modality_id = mo.modality_id), 0),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id)
  from modalities mo
  where exists (select 1 from athlete);
end;
$function$
;
