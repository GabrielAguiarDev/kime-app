-- Shared database rule for completed goal/limit days.
create function private.water_day_state(p_total integer, p_target integer, p_is_limit boolean)
returns text language sql immutable set search_path = '' as $$
  select case when p_target is null or p_target <= 0 then 'unconfigured'
    when p_is_limit and p_total > p_target then 'over'
    when (p_is_limit and p_total * 10 >= p_target * 9)
      or (not p_is_limit and p_total >= p_target) then 'done'
    else 'progress' end;
$$;
revoke all on function private.water_day_state(integer,integer,boolean) from public, anon, authenticated;

-- Personal streak history also carries whether each day was a limit.
drop function public.my_water_days();
create function public.my_water_days()
returns table(day date, total_ml integer, goal_ml integer, is_limit boolean)
language sql stable security definer set search_path = '' as $$
 with me as (select p.id,p.timezone from public.profiles p where p.id=(select auth.uid())),
 days as (select (w.logged_at at time zone me.timezone)::date as day, sum(w.amount_ml)::integer total_ml
          from public.water_logs w join me on me.id=w.user_id group by 1)
 select d.day,d.total_ml,t.goal,t.is_limit
 from days d cross join me
 left join lateral (
   select rt.goal,rt.is_limit from private.ranking_water_target(me.id,null,d.day) rt
 ) t on true
 order by d.day;
$$;
revoke all on function public.my_water_days() from public, anon;
grant execute on function public.my_water_days() to authenticated;

-- Only a compact attendance listing may be returned to classmates. Raw check-ins
-- remain visible only to the owner and academy staff.
alter table public.profiles add column show_checkins_to_peers boolean not null default true;
grant select(show_checkins_to_peers), update(show_checkins_to_peers) on public.profiles to authenticated;
create function public.class_attendees(p_schedule_id uuid, p_class_date date)
returns table(user_id uuid, full_name text, avatar_path text, status public.checkin_status, belt_primary text, belt_tip text)
language plpgsql stable security definer set search_path = '' as $$
declare v_schedule public.class_schedules%rowtype; v_staff boolean;
begin
 select * into v_schedule from public.class_schedules where id=p_schedule_id;
 if not found or p_class_date < private.academy_local_date(v_schedule.academy_id) then
   raise exception 'forbidden' using errcode='42501';
 end if;
 v_staff := private.is_staff(v_schedule.academy_id);
 if not v_staff and not private.is_enrolled_in_modality(v_schedule.modality_id) then
   raise exception 'forbidden' using errcode='42501';
 end if;
 return query
 select c.user_id,p.full_name,p.avatar_path,c.status,b.primary_color::text,b.tip_color::text
 from public.checkins c join public.profiles p on p.id=c.user_id
 left join lateral (select mb.primary_color,mb.tip_color from public.belt_history bh
   join public.memberships m on m.id=bh.membership_id
   join public.modality_belts mb on mb.id=bh.belt_id
   where m.user_id=c.user_id and bh.modality_id=v_schedule.modality_id
   order by bh.awarded_at desc limit 1) b on true
 where c.schedule_id=p_schedule_id and c.class_date=p_class_date
   and c.status in ('pending','confirmed')
   and (v_staff or c.user_id=(select auth.uid()) or p.show_checkins_to_peers)
 order by case when c.status='confirmed' then 0 else 1 end,p.full_name;
end; $$;
revoke all on function public.class_attendees(uuid,date) from public, anon;
grant execute on function public.class_attendees(uuid,date) to authenticated;

-- Photos are readable only within an active shared modality (or by self/staff).
create function private.shares_active_modality(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships vm
 join public.student_modality_enrollments ve on ve.membership_id=vm.id and ve.status='active'
 join public.student_modality_enrollments te on te.modality_id=ve.modality_id and te.status='active'
 join public.memberships tm on tm.id=te.membership_id and tm.academy_id=vm.academy_id
 where vm.user_id=(select auth.uid()) and vm.status='active' and vm.role='student'
   and tm.user_id=p_user_id and tm.status='active' and tm.role='student');
$$;
revoke all on function private.shares_active_modality(uuid) from public, anon;
grant execute on function private.shares_active_modality(uuid) to authenticated;
drop policy "avatars: own, staff of the member or ranked classmate reads" on storage.objects;
create policy "avatars: own staff or classmates" on storage.objects for select to authenticated
using (bucket_id='avatars' and (private.storage_folder_uuid(name)=(select auth.uid())
  or private.is_staff_of_member(private.storage_folder_uuid(name))
  or private.shares_active_modality(private.storage_folder_uuid(name))));

-- Private facts feed the daily materialization; remove the old client API.
drop function public.academy_ranking_facts(uuid,uuid,date,date);
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
  weekly_goal integer,
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
    select m.id as membership_id,m.user_id as uid,p.full_name as name,p.avatar_path as photo,e.id as enrollment_id,
      coalesce(e.weekly_class_goal,mo.weekly_class_goal)::integer as goal
    from public.memberships m join public.profiles p on p.id=m.user_id
    join public.student_modality_enrollments e on e.membership_id=m.id and e.modality_id=p_modality_id
    join public.academy_modalities mo on mo.id=e.modality_id
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
    select ed.uid,ed.day,(select count(*)::int from public.checkins c
      where c.user_id=ed.uid and c.academy_id=p_academy_id and c.modality_id=p_modality_id
        and c.class_date=ed.day and c.status='confirmed') as classes
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
  select st.uid,st.name,st.photo,p_modality_id,v_today,p_from,p_to,st.goal,
    coalesce((select jsonb_agg(jsonb_build_object('day',c.day,'classes',c.classes) order by c.day)
      from class_days c where c.uid=st.uid),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('day',w.day,'known',coalesce(w.goal between 1 and 20000,false),'done',coalesce(w.done,false),'eligible',w.eligible) order by w.day)
      from water_days w where w.uid=st.uid),'[]'::jsonb)
  from students st order by st.uid;
end $function$;

revoke all on function private.ranking_facts_internal(uuid,uuid,date,date) from public, anon, authenticated;

create table public.ranking_snapshots (
 academy_id uuid not null references public.academies(id) on delete cascade,
 modality_id uuid not null references public.academy_modalities(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 period_from date not null,
 period_to date not null,
 full_name text not null,
 avatar_path text,
 position integer,
 score numeric(5,2) not null,
 status text not null check(status in ('ranked','qualifying')),
 updated_at timestamptz not null default now(),
 primary key(academy_id,modality_id,user_id)
);
create table public.ranking_details (
 academy_id uuid not null,
 modality_id uuid not null,
 user_id uuid not null,
 attendance_rate numeric(6,5) not null,
 hydration_rate numeric(6,5) not null,
 confirmed_classes integer not null,
 weekly_goal integer not null,
 weeks integer not null,
 hydration_goals_achieved integer not null,
 eligible_hydration_days integer not null,
 protected_days integer not null,
 eligible_days integer not null,
 days_to_qualify integer not null,
 primary key(academy_id,modality_id,user_id),
 foreign key(academy_id,modality_id,user_id) references public.ranking_snapshots(academy_id,modality_id,user_id) on delete cascade
);
alter table public.ranking_snapshots enable row level security;
alter table public.ranking_details enable row level security;
grant select on public.ranking_snapshots,public.ranking_details to authenticated;
create function private.ranking_visible_user(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select p.show_in_ranking from public.profiles p where p.id=p_user_id),false);
$$;
revoke all on function private.ranking_visible_user(uuid) from public,anon;
grant execute on function private.ranking_visible_user(uuid) to authenticated;
create policy "ranking: enrolled or staff reads" on public.ranking_snapshots for select to authenticated
using (private.ranking_visible_user(user_id) and (private.is_staff(academy_id) or private.is_enrolled_in_modality(modality_id)));
create policy "ranking details: self or staff reads" on public.ranking_details for select to authenticated
using (user_id=(select auth.uid()) or private.is_staff(academy_id));

-- The only writer is the scheduled/staff-triggered server function. It derives
-- facts from trusted tables and applies the same 90%-100% limit rule.
create function private.rebuild_rankings(p_academy_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
 v_mod record; v_fact record; v_day record;
 v_today date; v_from date; v_to date;
 v_week integer; v_days integer; v_classes integer;
 v_attendance numeric; v_water numeric; v_score numeric;
 v_weeks integer; v_confirmed integer; v_eligible integer;
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
   v_attendance:=0; v_weeks:=0; v_confirmed:=0; v_eligible:=0;
   for v_week in 0..3 loop
    select count(*)::integer,coalesce(sum(a.classes),0)::integer into v_days,v_classes
    from jsonb_to_recordset(v_fact.attendance) as a(day date,classes integer)
    where (v_to-a.day)/7=v_week;
    if v_days>0 then
      v_weeks:=v_weeks+1;
      v_eligible:=v_eligible+v_days;
      v_confirmed:=v_confirmed+v_classes;
      v_attendance:=v_attendance+least(1::numeric,v_classes::numeric/(v_fact.weekly_goal*v_days::numeric/7));
    end if;
   end loop;
   if v_weeks>0 then v_attendance:=v_attendance/v_weeks; end if;
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
     confirmed_classes,weekly_goal,weeks,hydration_goals_achieved,eligible_hydration_days,protected_days,eligible_days,days_to_qualify)
   values(v_mod.academy_id,v_mod.modality_id,v_fact.user_id,v_attendance,v_water,v_confirmed,v_fact.weekly_goal,
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

create function public.recalculate_ranking(p_academy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_staff(p_academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform private.rebuild_rankings(p_academy_id);
end; $$;
revoke all on function public.recalculate_ranking(uuid) from public,anon;
grant execute on function public.recalculate_ranking(uuid) to authenticated;

-- 03:10 UTC is 00:10 in Brasilia (UTC-3, no daylight saving time).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('kimi-daily-ranking','10 3 * * *','select private.rebuild_rankings()');
select private.rebuild_rankings();

-- Join requests carry an avatar path for the compact staff list.
drop function public.list_pending_requests(uuid);
create function public.list_pending_requests(p_academy_id uuid)
returns table(membership_id uuid,user_id uuid,full_name text,email text,role public.membership_role,requested_at timestamptz,avatar_path text)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner boolean;
begin
 if (select auth.uid()) is null or not private.is_staff(p_academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
 v_owner:=private.is_owner(p_academy_id);
 return query select m.id,m.user_id,p.full_name,u.email::text,m.role,m.created_at,p.avatar_path
 from public.memberships m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id
 where m.academy_id=p_academy_id and m.status='pending' and (m.role='student' or v_owner)
 order by m.created_at;
end; $$;
revoke all on function public.list_pending_requests(uuid) from public,anon;
grant execute on function public.list_pending_requests(uuid) to authenticated;
