-- One continuous leaderboard per explicitly enrolled modality. Water logs and
-- freeze rules remain individual/shared. No guessed memberships from check-ins.
SET local check_function_bodies = off;

DROP FUNCTION "public"."academy_ranking_facts"(uuid, date, date);

CREATE TABLE "private"."modality_active_periods" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" uuid                     NOT NULL,
  "starts_at"     timestamp with time zone NOT NULL,
  "ends_at"       timestamp with time zone,
  CONSTRAINT "modality_active_periods_check" CHECK (((ends_at IS NULL) OR (ends_at >= starts_at))),
  CONSTRAINT "modality_active_periods_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."modality_active_periods"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."student_modality_enrollments" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" uuid                     NOT NULL,
  "modality_id"   uuid                     NOT NULL,
  "status"        text                     NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "student_modality_enrollments_membership_id_modality_id_key" UNIQUE (membership_id, modality_id),
  CONSTRAINT "student_modality_enrollments_pkey" PRIMARY KEY (id),
  CONSTRAINT "student_modality_enrollments_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'ended'::text])))
);

ALTER TABLE "public"."student_modality_enrollments"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."student_modality_enrollments" FROM "anon";

CREATE OR REPLACE FUNCTION private.modality_enrollment_visible (
  p_enrollment uuid,
  p_from       date,
  p_to         date,
  p_today      date,
  p_timezone   text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select exists(select 1 from public.student_modality_enrollments e where e.id=p_enrollment and (
    (p_to>=p_today-1 and e.status='active') or
    (p_to<p_today-1 and exists(select 1 from private.modality_active_periods ap where ap.enrollment_id=e.id
      and (ap.starts_at at time zone p_timezone)::date<p_to+1 and (ap.ends_at is null or (ap.ends_at at time zone p_timezone)::date>p_from)))
  ));
$function$;

CREATE OR REPLACE FUNCTION public.academy_ranking_facts (
  p_academy_id  uuid,
  p_modality_id uuid,
  p_from        date,
  p_to          date
)
  RETURNS TABLE (
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
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_today date:=private.academy_local_date(p_academy_id); v_tz text;
begin
  if not private.is_member(p_academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_to>=v_today or p_to-p_from>365 then raise exception 'invalid_ranking_period' using errcode='22023'; end if;
  if p_modality_id is null or not exists(select 1 from public.academy_modalities mo where mo.id=p_modality_id and mo.academy_id=p_academy_id) then raise exception 'invalid_ranking_modality' using errcode='22023'; end if;
  select a.timezone into v_tz from public.academies a where a.id=p_academy_id;
  if not private.is_staff(p_academy_id) and not exists(
    select 1 from public.student_modality_enrollments e join public.memberships m on m.id=e.membership_id
    where e.modality_id=p_modality_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='student'
      and private.modality_enrollment_visible(e.id,p_from,p_to,v_today,v_tz)
  ) then raise exception 'forbidden' using errcode='42501'; end if;
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
  class_facts as (
    select st.uid,d.day,e.occurrence_schedule_id as schedule_id,
      exists(select 1 from public.checkins c where c.user_id=st.uid and c.academy_id=p_academy_id and c.modality_id=p_modality_id
        and c.occurrence_schedule_id=e.occurrence_schedule_id and c.class_date=d.day and c.status='confirmed') as done
    from students st join public.student_class_enrollments e on e.membership_id=st.membership_id and e.modality_id=p_modality_id
    join eligible_days d on d.uid=st.uid and d.day>=e.starts_on and (e.ends_on is null or d.day<e.ends_on)
    where extract(dow from d.day)=e.weekday and not exists(select 1 from public.class_attendance_exceptions x
      where x.occurrence_schedule_id=e.occurrence_schedule_id and x.class_date=d.day and (x.membership_id is null or x.membership_id=st.membership_id))
  ),
  water_totals as (
    select w.user_id as uid,(w.logged_at at time zone v_tz)::date as day,sum(w.amount_ml) as total
    from public.water_logs w join students st on st.uid=w.user_id
    where w.logged_at<((p_to+1)::timestamp at time zone v_tz) group by 1,2
  ),
  water_days as (
    -- Global individual history, uncut by modality. This makes the frozen day
    -- identical in all modalities even when enrolment dates differ.
    select st.uid,d.day::date as day,g.goal,coalesce(w.total,0)>=g.goal as done,
      exists(select 1 from eligible_days ed where ed.uid=st.uid and ed.day=d.day::date) as eligible
    from students st cross join lateral generate_series(
      least((select min(h.effective_on) from private.water_auto_goal_history h where h.user_id=st.uid),
            (select min(g.day) from public.water_goal_days g where g.user_id=st.uid))::timestamp,
      p_to::timestamp,interval '1 day') d(day)
    cross join lateral(select private.ranking_water_goal(st.uid,p_academy_id,d.day::date) as goal) g
    left join water_totals w on w.uid=st.uid and w.day=d.day::date
  )
  select st.uid,st.name,st.photo,p_modality_id,v_today,p_from,p_to,
    coalesce((select jsonb_agg(jsonb_build_object('day',c.day,'id',c.schedule_id::text||':'||c.day::text,'done',c.done) order by c.day,c.schedule_id)
      from (select distinct * from class_facts) c where c.uid=st.uid),'[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('day',w.day,'known',coalesce(w.goal between 1 and 20000,false),'done',coalesce(w.done,false),'eligible',w.eligible) order by w.day)
      from water_days w where w.uid=st.uid),'[]'::jsonb)
  from students st order by st.uid;
end $function$;

REVOKE ALL ON FUNCTION "public"."academy_ranking_facts"(uuid, uuid, date, date) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.ranking_modalities (
  p_academy_id uuid,
  p_from       date,
  p_to         date
)
  RETURNS TABLE (
    modality_id uuid,
    name        text,
    "position"  integer
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_today date:=private.academy_local_date(p_academy_id); v_timezone text;
begin
  if not private.is_member(p_academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_to>=v_today or p_to-p_from>365 then raise exception 'invalid_ranking_period' using errcode='22023'; end if;
  select a.timezone into v_timezone from public.academies a where a.id=p_academy_id;
  return query select mo.id,mo.name,mo.position::integer from public.academy_modalities mo where mo.academy_id=p_academy_id and (
    private.is_staff(p_academy_id) or exists(
      select 1 from public.student_modality_enrollments e join public.memberships m on m.id=e.membership_id
      where e.modality_id=mo.id and m.user_id=(select auth.uid()) and m.status='active' and m.role='student'
      and private.modality_enrollment_visible(e.id,p_from,p_to,v_today,v_timezone)
    )
  ) order by mo.position,mo.name,mo.id;
end $function$;

REVOKE ALL ON FUNCTION "public"."ranking_modalities"(uuid, date, date) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.set_student_class_enrollment (
  p_membership_id uuid,
  p_schedule_id   uuid,
  p_enrolled      boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_m public.memberships; v_s public.class_schedules; v_day date;
begin
  select * into v_m from public.memberships where id=p_membership_id for update;
  select * into v_s from public.class_schedules where id=p_schedule_id;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if v_m.role<>'student' or v_m.status<>'active' or v_s.academy_id is distinct from v_m.academy_id or not v_s.active or p_enrolled is null then raise exception 'invalid_enrollment' using errcode='22023'; end if;
  v_day:=private.academy_local_date(v_m.academy_id)+1;
  if p_enrolled then
    if not exists(select 1 from public.student_modality_enrollments me where me.membership_id=v_m.id and me.modality_id=v_s.modality_id and me.status='active') then raise exception 'modality_enrollment_required' using errcode='22023'; end if;
    insert into public.student_class_enrollments(membership_id,schedule_id,starts_on,weekday,start_time,modality_id)
    values(v_m.id,v_s.id,v_day,v_s.weekday,v_s.start_time,v_s.modality_id)
    on conflict(membership_id,schedule_id) where ends_on is null do nothing;
  else
    update public.student_class_enrollments set ends_on=greatest(starts_on,v_day) where membership_id=v_m.id and schedule_id=v_s.id and ends_on is null;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.set_student_modality_enrollment (
  p_membership_id uuid,
  p_modality_id   uuid,
  p_status        text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_m public.memberships; v_e public.student_modality_enrollments;
begin
  select * into v_m from public.memberships where id=p_membership_id for update;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_status is null or p_status not in ('active','suspended','ended') or v_m.status<>'active' or v_m.role<>'student'
    or not exists(select 1 from public.academy_modalities mo where mo.id=p_modality_id and mo.academy_id=v_m.academy_id)
  then raise exception 'invalid_modality_enrollment' using errcode='22023'; end if;
  select * into v_e from public.student_modality_enrollments where membership_id=p_membership_id and modality_id=p_modality_id;
  if v_e.id is null then
    if p_status<>'active' then raise exception 'invalid_modality_enrollment' using errcode='22023'; end if;
    insert into public.student_modality_enrollments(membership_id,modality_id,status) values(p_membership_id,p_modality_id,'active') returning * into v_e;
    insert into private.modality_active_periods(enrollment_id,starts_at) values(v_e.id,now());
  elsif v_e.status is distinct from p_status then
    update private.modality_active_periods set ends_at=greatest(now(),starts_at) where enrollment_id=v_e.id and ends_at is null;
    update public.student_modality_enrollments set status=p_status,updated_at=now() where id=v_e.id;
    if p_status='active' then
      insert into private.modality_active_periods(enrollment_id,starts_at) values(v_e.id,now());
    end if;
  end if;
end $function$;

REVOKE ALL ON FUNCTION "public"."set_student_modality_enrollment"(uuid, uuid, text) FROM PUBLIC, "anon";

ALTER TABLE "public"."student_modality_enrollments"
  ADD CONSTRAINT "student_modality_enrollments_membership_id_fkey" FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;

ALTER TABLE "public"."student_modality_enrollments"
  ADD CONSTRAINT "student_modality_enrollments_modality_id_fkey" FOREIGN KEY (modality_id) REFERENCES public.academy_modalities(id) ON DELETE CASCADE;

ALTER TABLE "private"."modality_active_periods"
  ADD CONSTRAINT "modality_active_periods_enrollment_id_fkey" FOREIGN KEY (enrollment_id) REFERENCES public.student_modality_enrollments(id) ON DELETE CASCADE;

CREATE INDEX modality_active_periods_dates_idx ON private.modality_active_periods USING btree (enrollment_id, starts_at, ends_at);

CREATE UNIQUE INDEX modality_active_periods_open_idx ON private.modality_active_periods USING btree (enrollment_id)
  WHERE (ends_at IS NULL);

CREATE INDEX student_modality_enrollments_modality_idx ON public.student_modality_enrollments USING btree (modality_id, membership_id, status);

CREATE POLICY "modality enrollments: own or staff reads" ON "public"."student_modality_enrollments"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.id = student_modality_enrollments.membership_id) AND ((m.user_id = ( SELECT auth.uid() AS uid)) OR private.is_staff(m.academy_id))))));

REVOKE ALL ON FUNCTION "private"."modality_enrollment_visible"(uuid, date, date, date, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."modality_enrollment_visible"(uuid, date, date, date, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."modality_enrollment_visible"(uuid, date, date, date, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."academy_ranking_facts"(uuid, uuid, date, date) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."academy_ranking_facts"(uuid, uuid, date, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."academy_ranking_facts"(uuid, uuid, date, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."academy_ranking_facts"(uuid, uuid, date, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."ranking_modalities"(uuid, date, date) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."ranking_modalities"(uuid, date, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."ranking_modalities"(uuid, date, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."ranking_modalities"(uuid, date, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_student_modality_enrollment"(uuid, uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_student_modality_enrollment"(uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_student_modality_enrollment"(uuid, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_student_modality_enrollment"(uuid, uuid, text) TO "service_role";

REVOKE ALL ON TABLE "public"."student_modality_enrollments" FROM "authenticated";

GRANT SELECT ON TABLE "public"."student_modality_enrollments" TO "authenticated";

REVOKE ALL ON TABLE "public"."student_modality_enrollments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."student_modality_enrollments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."student_modality_enrollments" TO "service_role";


-- Existing live mandatory-class assignments are evidence of a modality
-- enrolment from the time staff created the assignment (not before, and never
-- from a future first class date). No other legacy student is auto-enrolled.
INSERT INTO public.student_modality_enrollments(membership_id,modality_id,status,created_at)
SELECT e.membership_id,e.modality_id,'active',min(e.created_at)
FROM public.student_class_enrollments e
JOIN public.memberships m ON m.id=e.membership_id AND m.status='active' AND m.role='student'
WHERE e.ends_on IS NULL AND e.modality_id IS NOT NULL
GROUP BY e.membership_id,e.modality_id;
INSERT INTO private.modality_active_periods(enrollment_id,starts_at)
SELECT id,created_at FROM public.student_modality_enrollments;
