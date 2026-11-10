-- Ranking presence follows the modality's class grid (user decision, 2026-11-10).
--
-- Before: confirmed classes ÷ weekly goal (the modality's goal, or a per-student
-- override). A goal above the classes the grid offers could never be met, and
-- the professor wants students at every class.
--
-- Now: each eligible day carries the classes the modality's grid has that
-- weekday (active schedules that already existed that day). Per week of the
-- 28-day window: confirmed ÷ scheduled, at most 100 %; weeks without any
-- scheduled class are left out of the mean. The weekly goal is removed
-- (modality column, per-student column and its RPC).

-- -----------------------------------------------------------------------------
-- 1. Facts: scheduled classes per eligible day, no weekly goal.
-- -----------------------------------------------------------------------------
drop function private.ranking_facts_internal(uuid, uuid, date, date);
create function private.ranking_facts_internal(
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
    where w.logged_at<((p_to+1)::timestamp at time zone v_tz) group by 1,2
  ),
  water_days as (
    -- Global individual history, uncut by modality: the same water facts in
    -- every modality of the student.
    select st.uid,d.day::date as day,t.goal,
      private.water_day_state(coalesce(w.total,0)::integer,t.goal,t.is_limit) = 'done' as done,
      exists(select 1 from eligible_days ed where ed.uid=st.uid and ed.day=d.day::date) as eligible
    from students st cross join lateral generate_series(
      least((select min(h.effective_on) from private.water_auto_goal_history h where h.user_id=st.uid),
            (select min(g.day) from public.water_goal_days g where g.user_id=st.uid))::timestamp,
      p_to::timestamp,interval '1 day') d(day)
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
-- 2. Details: scheduled classes of the window instead of the weekly goal.
-- -----------------------------------------------------------------------------
alter table public.ranking_details add column scheduled_classes integer not null default 0;
alter table public.ranking_details drop column weekly_goal;

-- -----------------------------------------------------------------------------
-- 3. Score: weekly presence = confirmed ÷ scheduled (at most 100 %).
-- -----------------------------------------------------------------------------
create or replace function private.rebuild_rankings(p_academy_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
 v_mod record; v_fact record; v_day record;
 v_today date; v_from date; v_to date;
 v_week integer; v_days integer; v_classes integer; v_expected integer;
 v_attendance numeric; v_water numeric; v_score numeric;
 v_weeks integer; v_rated integer; v_confirmed integer; v_scheduled integer; v_eligible integer;
 v_known integer; v_done integer; v_protected integer;
 v_streak integer; v_freezes integer; v_started boolean;
 v_qualify integer;
begin
 for v_mod in select mo.id modality_id,mo.academy_id from public.academy_modalities mo
              where p_academy_id is null or mo.academy_id=p_academy_id loop
  v_today := private.academy_local_date(v_mod.academy_id);
  v_from := v_today-28; v_to := v_today-1;
  delete from public.ranking_snapshots where academy_id=v_mod.academy_id and modality_id=v_mod.modality_id;
  for v_fact in select * from private.ranking_facts_internal(v_mod.academy_id,v_mod.modality_id,v_from,v_to) loop
   v_attendance:=0; v_weeks:=0; v_rated:=0; v_confirmed:=0; v_scheduled:=0; v_eligible:=0;
   for v_week in 0..3 loop
    select count(*)::integer,coalesce(sum(a.classes),0)::integer,coalesce(sum(a.scheduled),0)::integer
      into v_days,v_classes,v_expected
    from jsonb_to_recordset(v_fact.attendance) as a(day date,classes integer,scheduled integer)
    where (v_to-a.day)/7=v_week;
    if v_days>0 then
      v_weeks:=v_weeks+1;
      v_eligible:=v_eligible+v_days;
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
   v_known:=0;v_done:=0;v_protected:=0;v_streak:=0;v_freezes:=0;v_started:=false;
   for v_day in select * from jsonb_to_recordset(v_fact.hydration) as h(day date,known boolean,done boolean,eligible boolean)
                order by day loop
    if v_day.day>=v_today then continue; end if;
    if v_day.known and v_day.done then
      v_started:=true;v_streak:=v_streak+1;
      if v_streak%7=0 then v_freezes:=least(2,v_freezes+1); end if;
      if v_day.day>=v_from and v_day.eligible then v_known:=v_known+1;v_done:=v_done+1; end if;
    elsif v_started and v_streak>0 and v_freezes>0 then
      v_freezes:=v_freezes-1;
      if v_day.day>=v_from and v_day.known and v_day.eligible then v_protected:=v_protected+1; end if;
    else
      v_streak:=0;
      if v_day.day>=v_from and v_day.known and v_day.eligible then v_known:=v_known+1; end if;
    end if;
   end loop;
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

-- -----------------------------------------------------------------------------
-- 4. The weekly goal leaves (modality, per-student override and its RPC).
-- -----------------------------------------------------------------------------
drop function public.set_student_weekly_goal(uuid, uuid, smallint);
alter table public.student_modality_enrollments drop column weekly_class_goal;
alter table public.academy_modalities drop column weekly_class_goal;

-- Today's ranking with the new rule (the daily job keeps it from here).
select private.rebuild_rankings();
