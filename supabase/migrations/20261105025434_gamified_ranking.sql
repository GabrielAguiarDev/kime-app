-- Continuous gamified ranking. Generated from the verified local schema.
-- Known membership/goal evidence is seeded below; no old weight is invented.
SET local check_function_bodies = off;

DROP FUNCTION "public"."academy_ranking"(uuid, date, uuid);

DROP FUNCTION "public"."academy_ranking_champions"(uuid, uuid);

CREATE TABLE "private"."membership_active_periods" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" uuid                     NOT NULL,
  "starts_at"     timestamp with time zone NOT NULL,
  "ends_at"       timestamp with time zone,
  CONSTRAINT "membership_active_periods_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."membership_active_periods"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."water_auto_goal_history" (
  "user_id"      uuid    NOT NULL,
  "effective_on" date    NOT NULL,
  "goal_ml"      integer,
  CONSTRAINT "water_auto_goal_history_pkey" PRIMARY KEY (user_id, effective_on)
);

ALTER TABLE "private"."water_auto_goal_history"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."water_plan_goal_history" (
  "plan_id"      uuid                     NOT NULL,
  "weekday"      smallint                 NOT NULL,
  "effective_on" date                     NOT NULL,
  "target_ml"    integer,
  "recorded_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "water_plan_goal_history_pkey" PRIMARY KEY (plan_id, weekday, effective_on)
);

ALTER TABLE "private"."water_plan_goal_history"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."class_attendance_exceptions" (
  "id"                     uuid NOT NULL DEFAULT gen_random_uuid(),
  "academy_id"             uuid NOT NULL,
  "schedule_id"            uuid,
  "class_date"             date NOT NULL,
  "membership_id"          uuid,
  "reason"                 text NOT NULL,
  "occurrence_schedule_id" uuid NOT NULL,
  CONSTRAINT "class_attendance_exceptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "class_attendance_exceptions_reason_check" CHECK (((length(btrim(reason)) >= 1) AND (length(btrim(reason)) <= 200))),
  CONSTRAINT "class_attendance_exceptions_schedule_id_class_date_membersh_key" UNIQUE NULLS NOT DISTINCT (occurrence_schedule_id, class_date, membership_id)
);

ALTER TABLE "public"."class_attendance_exceptions"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."class_attendance_exceptions" FROM "anon";

CREATE TABLE "public"."student_class_enrollments" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "membership_id"          uuid                     NOT NULL,
  "schedule_id"            uuid,
  "starts_on"              date                     NOT NULL,
  "ends_on"                date,
  "weekday"                smallint                 NOT NULL,
  "start_time"             time without time zone   NOT NULL,
  "modality_id"            uuid,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "occurrence_schedule_id" uuid                     NOT NULL,
  CONSTRAINT "student_class_enrollments_check" CHECK (((ends_on IS NULL) OR (ends_on >= starts_on))),
  CONSTRAINT "student_class_enrollments_pkey" PRIMARY KEY (id),
  CONSTRAINT "student_class_enrollments_weekday_check" CHECK (((weekday >= 0) AND (weekday <= 6)))
);

ALTER TABLE "public"."student_class_enrollments"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."student_class_enrollments" FROM "anon";

ALTER TABLE "public"."checkins"
  ADD COLUMN "occurrence_schedule_id" uuid;

CREATE OR REPLACE FUNCTION private.close_schedule_enrollments()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_day date := private.academy_local_date(old.academy_id);
begin
  if tg_op = 'UPDATE' and (new.active, new.weekday, new.start_time, new.modality_id) is not distinct from (old.active, old.weekday, old.start_time, old.modality_id) then return new; end if;
  update public.student_class_enrollments set ends_on = greatest(starts_on, v_day)
  where schedule_id = old.id and ends_on is null;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.ranking_water_goal (
  p_user    uuid,
  p_academy uuid,
  p_day     date
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 with plan_in_force as (
   select p.id from public.water_plans p
   where p.athlete_id=p_user and p.week_start<=p_day
     and exists(select 1 from private.water_plan_goal_history h where h.plan_id=p.id and h.effective_on<=p_day)
   order by p.week_start desc,
     (select max(h.recorded_at) from private.water_plan_goal_history h where h.plan_id=p.id and h.effective_on<=p_day) desc,
     p.id limit 1
 ), auto_goal as (
   select h.goal_ml from private.water_auto_goal_history h where h.user_id=p_user and h.effective_on<=p_day order by h.effective_on desc limit 1
 )
 select coalesce(
   (select h.target_ml from private.water_plan_goal_history h join plan_in_force p on p.id=h.plan_id
     where h.weekday=extract(dow from p_day) and h.effective_on<=p_day order by h.effective_on desc limit 1),
   -- A known null goal is not replaced by a stale observation for the same day.
   case when exists(select 1 from auto_goal) then (select goal_ml from auto_goal)
   else (select g.goal_ml from public.water_goal_days g where g.user_id=p_user and g.day=p_day) end
 );
$function$;

CREATE OR REPLACE FUNCTION private.stamp_enrollment_schedule()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.occurrence_schedule_id := new.schedule_id;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.stamp_occurrence_schedule()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.occurrence_schedule_id := new.schedule_id;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.track_ranking_membership()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'UPDATE' and (old.status = 'active' and old.role = 'student') and (new.status <> 'active' or new.role <> 'student') then
    update private.membership_active_periods set ends_at = now() where membership_id = new.id and ends_at is null;
  end if;
  if new.status = 'active' and new.role = 'student' and (tg_op = 'INSERT' or old.status <> 'active' or old.role <> 'student') then
    insert into private.membership_active_periods(membership_id, starts_at) values (new.id, now());
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.track_water_auto_goal()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into private.water_auto_goal_history(user_id, effective_on, goal_ml)
  values (new.id, (now() at time zone 'America/Sao_Paulo')::date, round(new.weight_kg * 35)::integer)
  on conflict(user_id, effective_on) do update set goal_ml = excluded.goal_ml;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.track_water_plan_edit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into private.water_plan_goal_history(plan_id,weekday,effective_on,target_ml)
  values(new.id,7,greatest(new.week_start,private.academy_local_date(new.academy_id)),null)
  on conflict(plan_id,weekday,effective_on) do update set recorded_at=now();
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.track_water_plan_goal()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_plan uuid := coalesce(new.plan_id, old.plan_id); v_day date;
begin
  select greatest(p.week_start, private.academy_local_date(p.academy_id)) into v_day from public.water_plans p where p.id = v_plan;
  if v_day is not null then
    insert into private.water_plan_goal_history(plan_id, weekday, effective_on, target_ml)
    values (v_plan, coalesce(new.weekday, old.weekday), v_day, case when tg_op = 'DELETE' then null else new.target_ml end)
    on conflict(plan_id, weekday, effective_on) do update set target_ml = excluded.target_ml, recorded_at = now();
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.academy_ranking_facts (
  p_academy_id uuid,
  p_from       date DEFAULT NULL::date,
  p_to         date DEFAULT NULL::date
)
  RETURNS TABLE (
    user_id     uuid,
    full_name   text,
    avatar_path text,
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
declare v_today date := private.academy_local_date(p_academy_id); v_from date; v_to date; v_tz text;
begin
  if not private.is_member(p_academy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_to := least(coalesce(p_to, v_today - 1), v_today - 1);
  v_from := coalesce(p_from, v_to - 27);
  if v_from > v_to or v_to - v_from > 365 then raise exception 'invalid_ranking_period' using errcode = '22023'; end if;
  select a.timezone into v_tz from public.academies a where a.id = p_academy_id;
  return query
  with students as (
    select m.id as membership_id, m.user_id as uid, p.full_name as name, p.avatar_path as photo
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.academy_id = p_academy_id and m.role = 'student' and m.status = 'active' and p.show_in_ranking
  ),
  class_facts as (
    select st.uid, d.day::date as day, e.occurrence_schedule_id as schedule_id,
      exists (select 1 from public.checkins c where c.user_id = st.uid and c.academy_id = p_academy_id and c.occurrence_schedule_id = e.occurrence_schedule_id and c.class_date = d.day::date and c.status = 'confirmed') as done
    from students st join public.student_class_enrollments e on e.membership_id = st.membership_id
    cross join lateral generate_series(greatest(e.starts_on, v_from)::timestamp, least(coalesce(e.ends_on - 1, v_to), v_to)::timestamp, interval '1 day') d(day)
    where extract(dow from d.day) = e.weekday
      and exists (select 1 from private.membership_active_periods ap where ap.membership_id = st.membership_id and (ap.starts_at at time zone v_tz)::date < d.day::date and (ap.ends_at is null or (ap.ends_at at time zone v_tz)::date > d.day::date))
      and not exists (select 1 from public.class_attendance_exceptions x where x.occurrence_schedule_id = e.occurrence_schedule_id and x.class_date = d.day::date and (x.membership_id is null or x.membership_id = st.membership_id))
  ),
  water_totals as (
    select w.user_id as uid, (w.logged_at at time zone v_tz)::date as day, sum(w.amount_ml) as total
    from public.water_logs w join students st on st.uid = w.user_id
    where w.logged_at < (v_today::timestamp at time zone v_tz)
    group by 1,2
  ),
  water_days as (
    select st.uid, d.day::date as day, g.goal,
      coalesce(w.total, 0) >= g.goal as done,
      exists (select 1 from private.membership_active_periods ap where ap.membership_id = st.membership_id and (ap.starts_at at time zone v_tz)::date < d.day::date and (ap.ends_at is null or (ap.ends_at at time zone v_tz)::date > d.day::date)) as eligible
    from students st
    cross join lateral generate_series(
      least((select min(h.effective_on) from private.water_auto_goal_history h where h.user_id = st.uid), (select min(g.day) from public.water_goal_days g where g.user_id = st.uid))::timestamp,
      v_to::timestamp, interval '1 day') d(day)
    cross join lateral (select private.ranking_water_goal(st.uid, p_academy_id, d.day::date) as goal) g
    left join water_totals w on w.uid = st.uid and w.day = d.day::date
  )
  select st.uid, st.name, st.photo, v_today, v_from, v_to,
    coalesce((select jsonb_agg(jsonb_build_object('day', c.day, 'id', c.schedule_id::text || ':' || c.day::text, 'done', c.done) order by c.day, c.schedule_id) from (select distinct * from class_facts) c where c.uid = st.uid), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('day', w.day, 'known', coalesce(w.goal between 1 and 20000, false), 'done', coalesce(w.done, false), 'eligible', w.eligible) order by w.day) from water_days w where w.uid = st.uid), '[]'::jsonb)
  from students st order by st.uid;
end $function$;

REVOKE ALL ON FUNCTION "public"."academy_ranking_facts"(uuid, date, date) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.my_water_days()
  RETURNS TABLE (
    day      date,
    total_ml integer,
    goal_ml  integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with me as (select p.id,p.timezone from public.profiles p where p.id=(select auth.uid())),
  totals as (
    select (w.logged_at at time zone me.timezone)::date as day,sum(w.amount_ml)::integer as total_ml
    from public.water_logs w join me on me.id=w.user_id group by 1
  )
  select t.day,t.total_ml,private.ranking_water_goal((select auth.uid()),null,t.day) from totals t order by t.day;
$function$;

CREATE OR REPLACE FUNCTION public.record_my_water_goal()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_day date := (now() at time zone 'America/Sao_Paulo')::date; v_goal integer; v_academy uuid;
begin
  if (select auth.uid()) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select m.academy_id into v_academy from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'active' and m.is_competitor order by m.created_at, m.id limit 1;
  v_goal := private.ranking_water_goal((select auth.uid()), v_academy, v_day);
  if v_goal between 1 and 20000 then
    insert into public.water_goal_days(user_id, day, goal_ml) values ((select auth.uid()), v_day, v_goal)
    on conflict(user_id, day) do update set goal_ml = excluded.goal_ml;
  end if;
end $function$;

REVOKE ALL ON FUNCTION "public"."record_my_water_goal"() FROM PUBLIC, "anon";

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
  select * into v_m from public.memberships where id = p_membership_id for update;
  select * into v_s from public.class_schedules where id = p_schedule_id;
  if v_m.id is null or not private.is_staff(v_m.academy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_m.role <> 'student' or v_m.status <> 'active' or v_s.academy_id is distinct from v_m.academy_id or not v_s.active then raise exception 'invalid_enrollment' using errcode = '22023'; end if;
  v_day := private.academy_local_date(v_m.academy_id) + 1;
  if p_enrolled then
    insert into public.student_class_enrollments(membership_id, schedule_id, starts_on, weekday, start_time, modality_id)
    values (v_m.id, v_s.id, v_day, v_s.weekday, v_s.start_time, v_s.modality_id)
    on conflict (membership_id, schedule_id) where ends_on is null do nothing;
  else
    update public.student_class_enrollments set ends_on = greatest(starts_on, v_day) where membership_id = v_m.id and schedule_id = v_s.id and ends_on is null;
  end if;
end $function$;

REVOKE ALL ON FUNCTION "public"."set_student_class_enrollment"(uuid, uuid, boolean) FROM PUBLIC, "anon";

ALTER TABLE "private"."membership_active_periods"
  ADD CONSTRAINT "membership_active_periods_membership_id_fkey" FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;

ALTER TABLE "private"."water_auto_goal_history"
  ADD CONSTRAINT "water_auto_goal_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "private"."water_plan_goal_history"
  ADD CONSTRAINT "water_plan_goal_history_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.water_plans(id) ON DELETE CASCADE;

ALTER TABLE "public"."class_attendance_exceptions"
  ADD CONSTRAINT "class_attendance_exceptions_academy_id_fkey" FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE;

ALTER TABLE "public"."class_attendance_exceptions"
  ADD CONSTRAINT "class_attendance_exceptions_membership_id_fkey" FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;

ALTER TABLE "public"."class_attendance_exceptions"
  ADD CONSTRAINT "class_attendance_exceptions_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES public.class_schedules(id) ON DELETE SET NULL;

ALTER TABLE "public"."student_class_enrollments"
  ADD CONSTRAINT "student_class_enrollments_membership_id_fkey" FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;

ALTER TABLE "public"."student_class_enrollments"
  ADD CONSTRAINT "student_class_enrollments_modality_id_fkey" FOREIGN KEY (modality_id) REFERENCES public.academy_modalities(id) ON DELETE SET NULL;

ALTER TABLE "public"."student_class_enrollments"
  ADD CONSTRAINT "student_class_enrollments_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES public.class_schedules(id) ON DELETE SET NULL;

CREATE INDEX membership_active_periods_member_idx ON private.membership_active_periods USING btree (membership_id, starts_at);

CREATE INDEX class_attendance_exceptions_academy_idx ON public.class_attendance_exceptions USING btree (academy_id);

CREATE INDEX class_attendance_exceptions_member_idx ON public.class_attendance_exceptions USING btree (membership_id);

CREATE UNIQUE INDEX student_class_enrollments_live_idx ON public.student_class_enrollments USING btree (membership_id, schedule_id)
  WHERE (ends_on IS NULL);

CREATE INDEX student_class_enrollments_modality_idx ON public.student_class_enrollments USING btree (modality_id);

CREATE INDEX student_class_enrollments_schedule_idx ON public.student_class_enrollments USING btree (schedule_id);

CREATE TRIGGER checkins_occurrence_schedule
  BEFORE INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_occurrence_schedule();

CREATE TRIGGER exceptions_occurrence_schedule
  BEFORE INSERT ON public.class_attendance_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_enrollment_schedule();

CREATE TRIGGER schedules_close_enrollments
  BEFORE DELETE OR UPDATE OF active, weekday, start_time, modality_id ON public.class_schedules
  FOR EACH ROW
  EXECUTE FUNCTION private.close_schedule_enrollments();

CREATE TRIGGER memberships_ranking_history
  AFTER INSERT OR UPDATE OF status, ROLE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION private.track_ranking_membership();

CREATE TRIGGER profiles_water_goal_history
  AFTER INSERT OR UPDATE OF weight_kg ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.track_water_auto_goal();

CREATE TRIGGER enrollments_occurrence_schedule
  BEFORE INSERT ON public.student_class_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_enrollment_schedule();

CREATE TRIGGER water_plan_days_goal_history
  AFTER INSERT OR DELETE OR UPDATE ON public.water_plan_days
  FOR EACH ROW
  EXECUTE FUNCTION private.track_water_plan_goal();

CREATE TRIGGER water_plans_goal_edit
  AFTER INSERT OR UPDATE ON public.water_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.track_water_plan_edit();

CREATE POLICY "attendance exceptions: staff writes" ON "public"."class_attendance_exceptions"
  FOR ALL
  TO "authenticated"
  USING (private.is_staff(academy_id))
  WITH CHECK ((private.is_staff(academy_id) AND (EXISTS ( SELECT 1
   FROM public.class_schedules s
  WHERE ((s.id = class_attendance_exceptions.schedule_id) AND (s.academy_id = class_attendance_exceptions.academy_id)))) AND ((membership_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.id = class_attendance_exceptions.membership_id) AND (m.academy_id = class_attendance_exceptions.academy_id)))))));

CREATE POLICY "enrollments: own or staff reads" ON "public"."student_class_enrollments"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.id = student_class_enrollments.membership_id) AND ((m.user_id = ( SELECT auth.uid() AS uid)) OR private.is_staff(m.academy_id))))));

REVOKE ALL ON FUNCTION "private"."close_schedule_enrollments"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."close_schedule_enrollments"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."close_schedule_enrollments"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."ranking_water_goal"(uuid, uuid, date) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."ranking_water_goal"(uuid, uuid, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."ranking_water_goal"(uuid, uuid, date) TO "postgres";

REVOKE ALL ON FUNCTION "private"."stamp_enrollment_schedule"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."stamp_enrollment_schedule"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."stamp_enrollment_schedule"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."stamp_occurrence_schedule"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."stamp_occurrence_schedule"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."stamp_occurrence_schedule"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."track_ranking_membership"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."track_ranking_membership"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."track_ranking_membership"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."track_water_auto_goal"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."track_water_auto_goal"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."track_water_auto_goal"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."track_water_plan_edit"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."track_water_plan_edit"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."track_water_plan_edit"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."track_water_plan_goal"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."track_water_plan_goal"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "private"."track_water_plan_goal"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."academy_ranking_facts"(uuid, date, date) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."academy_ranking_facts"(uuid, date, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."academy_ranking_facts"(uuid, date, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."academy_ranking_facts"(uuid, date, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."record_my_water_goal"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."record_my_water_goal"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_my_water_goal"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_my_water_goal"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_student_class_enrollment"(uuid, uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_student_class_enrollment"(uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_student_class_enrollment"(uuid, uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_student_class_enrollment"(uuid, uuid, boolean) TO "service_role";

REVOKE ALL ON TABLE "public"."class_attendance_exceptions" FROM "authenticated";

REVOKE ALL ("reason") ON TABLE "public"."class_attendance_exceptions" FROM "authenticated";

GRANT UPDATE ("reason") ON TABLE "public"."class_attendance_exceptions" TO "authenticated";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."class_attendance_exceptions" TO "authenticated";

REVOKE ALL ON TABLE "public"."class_attendance_exceptions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."class_attendance_exceptions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."class_attendance_exceptions" TO "service_role";

REVOKE ALL ON TABLE "public"."student_class_enrollments" FROM "authenticated";

GRANT SELECT ON TABLE "public"."student_class_enrollments" TO "authenticated";

REVOKE ALL ON TABLE "public"."student_class_enrollments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."student_class_enrollments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."student_class_enrollments" TO "service_role";

REVOKE ALL ON TABLE "public"."water_goal_days" FROM "authenticated";

GRANT SELECT ON TABLE "public"."water_goal_days" TO "authenticated";

REVOKE ALL ON TABLE "public"."water_plan_days" FROM "authenticated";

REVOKE ALL ("target_ml") ON TABLE "public"."water_plan_days" FROM "authenticated";

GRANT UPDATE ("target_ml") ON TABLE "public"."water_plan_days" TO "authenticated";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."water_plan_days" TO "authenticated";

REVOKE ALL ON TABLE "public"."water_plans" FROM "authenticated";

REVOKE ALL ("updated_at") ON TABLE "public"."water_plans" FROM "authenticated";

GRANT UPDATE ("updated_at") ON TABLE "public"."water_plans" TO "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."water_plans" TO "authenticated";


-- Data migration: retain occurrence identities of existing check-ins.
UPDATE public.checkins SET occurrence_schedule_id = schedule_id WHERE occurrence_schedule_id IS NULL;

-- Approval timestamp is the earliest reliable active-membership evidence.
INSERT INTO private.membership_active_periods(membership_id, starts_at)
SELECT id, greatest(created_at, coalesce(decided_at, created_at))
FROM public.memberships WHERE status = 'active' AND role = 'student';

-- Begin automatic weight history NOW, never retroactively.
INSERT INTO private.water_auto_goal_history(user_id, effective_on, goal_ml)
SELECT id, (now() AT TIME ZONE 'America/Sao_Paulo')::date, round(weight_kg * 35)::integer
FROM public.profiles;

-- Existing plans are known from today onward; keep water_goal_days observations
-- as the only evidence for earlier dates. Marker 7 includes automatic plans.
INSERT INTO private.water_plan_goal_history(plan_id, weekday, effective_on, target_ml)
SELECT d.plan_id, d.weekday, greatest(p.week_start, (now() AT TIME ZONE a.timezone)::date), d.target_ml
FROM public.water_plan_days d JOIN public.water_plans p ON p.id = d.plan_id
JOIN public.academies a ON a.id = p.academy_id;
INSERT INTO private.water_plan_goal_history(plan_id, weekday, effective_on, target_ml)
SELECT p.id, 7, greatest(p.week_start, (now() AT TIME ZONE a.timezone)::date), null
FROM public.water_plans p JOIN public.academies a ON a.id = p.academy_id;

-- Indexed lookup of each confirmed historical occurrence, including deleted schedules.
CREATE INDEX checkins_ranking_occurrence_idx ON public.checkins(user_id,academy_id,occurrence_schedule_id,class_date) WHERE status='confirmed';
