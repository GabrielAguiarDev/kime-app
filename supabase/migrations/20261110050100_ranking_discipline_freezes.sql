-- Ranking: the Disciplina freezes whole weeks (user decision, 2026-11-10).
--
-- Before: the water streak had its own freezes (1 per 7 days, max 2) and a
-- covered day left the water denominator.
--
-- Now there is one weekly streak (20261110050000_discipline_weekly). A FROZEN
-- week takes its 7 days out of the ranking: presence (confirmed and grid
-- classes) and water. ranking_details.protected_days = eligible days of the
-- window inside frozen weeks. The water history before the window, only kept
-- for the old freezes, is no longer read.

-- -----------------------------------------------------------------------------
-- 1. Facts: water only inside the period.
-- -----------------------------------------------------------------------------
create or replace function private.ranking_facts_internal(
  p_academy_id  uuid,
  p_modality_id uuid,
  p_from        date,
  p_to          date
)
returns table (
  user_id     uuid,
  full_name   text,
  avatar_path text,
  modality_id uuid,
  today       date,
  period_from date,
  period_to   date,
  attendance  jsonb,
  hydration   jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_today date:=private.academy_local_date(p_academy_id); v_tz text;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to>=v_today or p_to-p_from>365 then raise exception 'invalid_ranking_period' using errcode='22023'; end if;
  if p_modality_id is null or not exists(select 1 from public.academy_modalities mo where mo.id=p_modality_id and mo.academy_id=p_academy_id) then raise exception 'invalid_ranking_modality' using errcode='22023'; end if;
  select a.timezone into v_tz from public.academies a where a.id=p_academy_id;
  return query
  with students as (
    select m.id as membership_id,m.user_id as uid,p.full_name as name,p.avatar_path as photo,e.id as enrollment_id
    from public.memberships m join public.profiles p on p.id=m.user_id
    join public.student_modality_enrollments e on e.membership_id=m.id and e.modality_id=p_modality_id
    where m.academy_id=p_academy_id and m.role='student' and m.status='active' and p.show_in_ranking
      and private.modality_enrollment_visible(e.id,p_from,p_to,v_today,v_tz)
  ),
  eligible_days as (
    select st.uid,d.day::date as day from students st
    cross join lateral generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
    where exists(select 1 from private.membership_active_periods ap where ap.membership_id=st.membership_id
      and (ap.starts_at at time zone v_tz)::date<d.day::date and (ap.ends_at is null or (ap.ends_at at time zone v_tz)::date>d.day::date))
      and exists(select 1 from private.modality_active_periods ap where ap.enrollment_id=st.enrollment_id
      and (ap.starts_at at time zone v_tz)::date<d.day::date and (ap.ends_at is null or (ap.ends_at at time zone v_tz)::date>d.day::date))
  ),
  class_days as (
    select ed.uid,ed.day,
      (select count(*)::int from public.checkins c
        where c.user_id=ed.uid and c.academy_id=p_academy_id and c.modality_id=p_modality_id
          and c.class_date=ed.day and c.status='confirmed') as classes,
      -- The modality's grid that weekday: active schedules created on or before the day.
      (select count(*)::int from public.class_schedules s
        where s.academy_id=p_academy_id and s.modality_id=p_modality_id and s.active
          and s.weekday=extract(dow from ed.day)::int
          and (s.created_at at time zone v_tz)::date<=ed.day) as scheduled
    from eligible_days ed
  ),
  water_totals as (
    select w.user_id as uid,(w.logged_at at time zone v_tz)::date as day,sum(w.amount_ml) as total
    from public.water_logs w join students st on st.uid=w.user_id
    where w.logged_at>=(p_from::timestamp at time zone v_tz) and w.logged_at<((p_to+1)::timestamp at time zone v_tz) group by 1,2
  ),
  water_days as (
    -- Individual water facts of the period, uncut by modality: the same water
    -- facts in every modality of the student. No history before the period:
    -- the water freezes are gone (the Disciplina freezes whole weeks).
    select st.uid,d.day::date as day,t.goal,
      private.water_day_state(coalesce(w.total,0)::integer,t.goal,t.is_limit) = 'done' as done,
      exists(select 1 from eligible_days ed where ed.uid=st.uid and ed.day=d.day::date) as eligible
    from students st cross join lateral generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
    cross join lateral private.ranking_water_target(st.uid,p_academy_id,d.day::date) t
    left join water_totals w on w.uid=st.uid and w.day=d.day::date
  )
  select st.uid,st.name,st.photo,p_modality_id,v_today,p_from,p_to,
    coalesce((select jsonb_agg(jsonb_build_object('day',c.day,'classes',c.classes,'scheduled',c.scheduled) order by c.day)
      from class_days c where c.uid=st.uid),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('day',w.day,'known',coalesce(w.goal between 1 and 20000,false),'done',coalesce(w.done,false),'eligible',w.eligible) order by w.day)
      from water_days w where w.uid=st.uid),'[]'::jsonb)
  from students st order by st.uid;
end $function$;

revoke all on function private.ranking_facts_internal(uuid,uuid,date,date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Score: frozen Disciplina weeks leave presence and water.
-- -----------------------------------------------------------------------------
create or replace function private.rebuild_rankings(p_academy_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
 v_mod record; v_fact record;
 v_today date; v_from date; v_to date;
 v_week integer; v_days integer; v_classes integer; v_expected integer;
 v_attendance numeric; v_water numeric; v_score numeric;
 v_weeks integer; v_rated integer; v_confirmed integer; v_scheduled integer; v_eligible integer;
 v_known integer; v_done integer; v_protected integer;
 v_frozen date[];
 v_qualify integer;
begin
 -- Disciplina first: its frozen weeks leave the ranking.
 perform private.refresh_discipline(m.user_id)
 from (select distinct mb.user_id from public.memberships mb
       where mb.role='student' and mb.status='active' and (p_academy_id is null or mb.academy_id=p_academy_id)) m;
 for v_mod in select mo.id modality_id,mo.academy_id from public.academy_modalities mo
              where p_academy_id is null or mo.academy_id=p_academy_id loop
  v_today := private.academy_local_date(v_mod.academy_id);
  v_from := v_today-28; v_to := v_today-1;
  delete from public.ranking_snapshots where academy_id=v_mod.academy_id and modality_id=v_mod.modality_id;
  for v_fact in select * from private.ranking_facts_internal(v_mod.academy_id,v_mod.modality_id,v_from,v_to) loop
   -- Mondays of the student's frozen Disciplina weeks: their 7 days are out
   -- of presence and water (no points added nor taken).
   select coalesce(array_agg(dw.week_start),'{}') into v_frozen from public.discipline_weeks dw
    where dw.user_id=v_fact.user_id and dw.state='frozen' and dw.week_start>v_from-7 and dw.week_start<=v_to;
   v_protected:=(select count(*)::integer from jsonb_to_recordset(v_fact.attendance) as a(day date)
    where date_trunc('week',a.day)::date=any(v_frozen));
   v_attendance:=0; v_weeks:=0; v_rated:=0; v_confirmed:=0; v_scheduled:=0; v_eligible:=0;
   for v_week in 0..3 loop
    select count(*)::integer,coalesce(sum(a.classes),0)::integer,coalesce(sum(a.scheduled),0)::integer
      into v_days,v_classes,v_expected
    from jsonb_to_recordset(v_fact.attendance) as a(day date,classes integer,scheduled integer)
    where (v_to-a.day)/7=v_week and not date_trunc('week',a.day)::date=any(v_frozen);
    if v_days>0 then
      v_weeks:=v_weeks+1;
      v_confirmed:=v_confirmed+v_classes;
      v_scheduled:=v_scheduled+v_expected;
      -- A week without classes in the grid neither adds nor takes points.
      if v_expected>0 then
        v_rated:=v_rated+1;
        v_attendance:=v_attendance+least(1::numeric,v_classes::numeric/v_expected);
      end if;
    end if;
   end loop;
   if v_rated>0 then v_attendance:=v_attendance/v_rated; end if;
   -- Qualification counts every eligible day, frozen or not.
   v_eligible:=jsonb_array_length(v_fact.attendance);
   select count(*)::integer,count(*) filter (where h.done)::integer into v_known,v_done
   from jsonb_to_recordset(v_fact.hydration) as h(day date,known boolean,done boolean,eligible boolean)
   where h.day between v_from and v_to and h.known and h.eligible
     and not date_trunc('week',h.day)::date=any(v_frozen);
   v_water:=case when v_known>0 then v_done::numeric/v_known else 0 end;
   v_score:=round((v_attendance*0.7+v_water*0.3)*100,2);
   v_qualify:=greatest(0,7-v_eligible);
   insert into public.ranking_snapshots(academy_id,modality_id,user_id,period_from,period_to,full_name,avatar_path,score,status)
   values(v_mod.academy_id,v_mod.modality_id,v_fact.user_id,v_from,v_to,v_fact.full_name,v_fact.avatar_path,v_score,
          case when v_qualify>0 then 'qualifying' else 'ranked' end);
   insert into public.ranking_details(academy_id,modality_id,user_id,attendance_rate,hydration_rate,
     confirmed_classes,scheduled_classes,weeks,hydration_goals_achieved,eligible_hydration_days,protected_days,eligible_days,days_to_qualify)
   values(v_mod.academy_id,v_mod.modality_id,v_fact.user_id,v_attendance,v_water,v_confirmed,v_scheduled,
     v_weeks,v_done,v_known,v_protected,v_eligible,v_qualify);
  end loop;
  with positioned as (
   select r.user_id,row_number() over(order by r.score desc,d.confirmed_classes desc,d.hydration_rate desc,r.user_id)::integer pos
   from public.ranking_snapshots r join public.ranking_details d
     on d.academy_id=r.academy_id and d.modality_id=r.modality_id and d.user_id=r.user_id
   where r.academy_id=v_mod.academy_id and r.modality_id=v_mod.modality_id and r.status='ranked')
  update public.ranking_snapshots r set position=p.pos from positioned p
   where r.academy_id=v_mod.academy_id and r.modality_id=v_mod.modality_id and r.user_id=p.user_id;
 end loop;
end; $$;
revoke all on function private.rebuild_rankings(uuid) from public,anon,authenticated;

select private.rebuild_rankings();
