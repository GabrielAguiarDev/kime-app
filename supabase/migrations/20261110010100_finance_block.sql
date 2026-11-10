-- =============================================================================
-- Kimi — Finance block (user request, 2026-11-10)
--
-- With "Bloquear aluno após 7 dias de atraso" on, a STUDENT with a charge
-- unpaid more than 7 days after the due date loses the academy features —
-- check-in, classes, ranking, championships and events — and keeps water,
-- the widget, profile, academy, modalities and belts. Computed on every
-- request by private.is_finance_blocked (no stored flag): marking the charge
-- paid unblocks right away.
--
-- 1. private.is_enrolled_in_modality now means "enrolled AND not blocked".
--    Every caller is a blocked feature (schedules, check-in insert,
--    class_attendees, ranking snapshots/history, championships,
--    championship_competitors, event modalities, events). Do NOT reuse it for
--    the app shell.
-- 2. private.can_see_academy_event: the "all modalities" branch too (covers
--    RSVP insert, academy_event_people and the event goers' photos).
-- 3. The "own row" branches that do not go through those helpers.
-- 4. Student RPCs that check the caller themselves raise `finance_blocked`.
-- Staff (owner / instructor) are never blocked and keep seeing the student.
-- =============================================================================

CREATE OR REPLACE FUNCTION private.is_enrolled_in_modality(p_modality_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.student_modality_enrollments e
    join public.memberships m on m.id = e.membership_id
    where e.modality_id = p_modality_id
      and e.status = 'active'
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'student'
      and not private.is_finance_blocked(m.academy_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION private.can_see_academy_event(p_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.academy_events e
    where e.id = p_event_id
      and (
        private.is_staff(e.academy_id)
        or (
          private.is_student(e.academy_id)
          and not private.is_finance_blocked(e.academy_id)
          and (
            e.all_modalities
            or exists (
              select 1 from public.academy_event_modalities em
              where em.event_id = e.id and private.is_enrolled_in_modality(em.modality_id)
            )
          )
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.ranking_modalities(p_academy_id uuid, p_from date, p_to date)
 RETURNS TABLE(modality_id uuid, name text, "position" integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_today date:=private.academy_local_date(p_academy_id); v_timezone text;
begin
  if not private.is_member(p_academy_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not private.is_staff(p_academy_id) and private.is_finance_blocked(p_academy_id) then
    raise exception 'finance_blocked' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from>p_to or p_to>=v_today or p_to-p_from>365 then raise exception 'invalid_ranking_period' using errcode='22023'; end if;
  select a.timezone into v_timezone from public.academies a where a.id=p_academy_id;
  return query select mo.id,mo.name,mo.position::integer from public.academy_modalities mo where mo.academy_id=p_academy_id and (
    private.is_staff(p_academy_id) or exists(
      select 1 from public.student_modality_enrollments e join public.memberships m on m.id=e.membership_id
      where e.modality_id=mo.id and m.user_id=(select auth.uid()) and m.status='active' and m.role='student'
      and private.modality_enrollment_visible(e.id,p_from,p_to,v_today,v_timezone)
    )
  ) order by mo.position,mo.name,mo.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.athlete_fight_history(p_academy_id uuid, p_athlete_id uuid)
 RETURNS TABLE(entry_id uuid, championship_id uuid, modality_id uuid, name text, event_date date, location text, placement text, is_historical boolean, fights jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_staff(p_academy_id) and private.is_finance_blocked(p_academy_id) then
    raise exception 'finance_blocked' using errcode = '42501';
  end if;
  if not (p_athlete_id = (select auth.uid()) or private.is_staff(p_academy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select e.id, c.id, c.modality_id, c.name, c.event_date, c.location, e.placement, c.is_historical,
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
$function$
;

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

CREATE OR REPLACE FUNCTION public.class_report(p_academy_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with me as (
    select m.id, m.created_at, (m.created_at at time zone a.timezone)::date as joined_on, a.timezone
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    where m.academy_id = p_academy_id
      and m.user_id = p_user_id
      and m.role = 'student'
      and (
        private.is_staff(p_academy_id)
        or (p_user_id = (select auth.uid()) and not private.is_finance_blocked(p_academy_id))
      )
    limit 1
  ),
  today as (
    select private.academy_local_date(p_academy_id) as d
  ),
  recent as (
    select greatest(((select d from today) - interval '3 months')::date, me.joined_on) as since
    from me
  ),
  mine as (
    select c.class_date, c.modality_id
    from public.checkins c
    where exists (select 1 from me)
      and c.academy_id = p_academy_id
      and c.user_id = p_user_id
      and c.status = 'confirmed'
  ),
  belts as (
    select
      bh.modality_id,
      bh.belt_id,
      bh.awarded_at,
      (bh.awarded_at at time zone me.timezone)::date as awarded_on,
      lead(bh.awarded_at) over w as next_awarded_at,
      lead((bh.awarded_at at time zone me.timezone)::date) over w as next_on
    from public.belt_history bh
    join me on me.id = bh.membership_id
    window w as (partition by bh.modality_id order by bh.awarded_at)
  ),
  last_award as (
    select distinct on (modality_id) modality_id, awarded_on
    from belts
    order by modality_id, awarded_at desc
  ),
  numbered as (
    select modality_id, class_date, row_number() over (partition by modality_id order by class_date) as n
    from mine
  )
  select jsonb_build_object(
    'joined_at', me.created_at,
    'today', (select d from today),
    'recent_since', (select since from recent),
    'enrollments', coalesce((
      select jsonb_agg(jsonb_build_object('modality_id', e.modality_id, 'status', e.status, 'is_competitor', e.is_competitor))
      from public.student_modality_enrollments e
      where e.membership_id = me.id
    ), '[]'::jsonb),
    'modalities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'modality_id', t.modality_id,
        'total', t.total,
        'since_belt', t.since_belt,
        'recent', t.recent
      ))
      from (
        select
          mine.modality_id,
          count(*) as total,
          count(*) filter (where la.awarded_on is null or mine.class_date > la.awarded_on) as since_belt,
          count(*) filter (where mine.class_date >= (select since from recent)) as recent
        from mine
        left join last_award la on la.modality_id = mine.modality_id
        where mine.modality_id is not null
        group by mine.modality_id
      ) t
    ), '[]'::jsonb),
    'months', coalesce((
      select jsonb_agg(jsonb_build_object('month', t.month, 'modality_id', t.modality_id, 'classes', t.classes) order by t.month)
      from (
        select date_trunc('month', class_date)::date as month, modality_id, count(*) as classes
        from mine
        group by 1, 2
      ) t
    ), '[]'::jsonb),
    'weeks', coalesce((
      select jsonb_agg(w.week order by w.week)
      from (select distinct date_trunc('week', class_date)::date as week from mine) w
    ), '[]'::jsonb),
    'belts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'modality_id', b.modality_id,
          'belt_id', b.belt_id,
          'awarded_at', b.awarded_at,
          'next_awarded_at', b.next_awarded_at,
          'classes', (
            select count(*) from mine
            where mine.modality_id = b.modality_id
              and mine.class_date > b.awarded_on
              and (b.next_on is null or mine.class_date <= b.next_on)
          )
        )
        order by b.awarded_at
      )
      from belts b
    ), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('modality_id', modality_id, 'count', n, 'date', class_date) order by modality_id, n)
      from numbered
      where n in (10, 25, 50) or (n >= 100 and n % 100 = 0)
    ), '[]'::jsonb)
  )
  from me;
$function$
;

-- -----------------------------------------------------------------------------
-- 3. Own-row branches
-- -----------------------------------------------------------------------------
alter policy "checkins: read own or as staff" on public.checkins
  using (
    (user_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
    or private.is_staff(academy_id)
  );

alter policy "checkins: delete own while pending" on public.checkins
  using (
    user_id = (select auth.uid())
    and status = 'pending'
    and not private.is_finance_blocked(academy_id)
  );

alter policy "ranking details: self or staff reads" on public.ranking_details
  using (
    (user_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
    or private.is_staff(academy_id)
  );

alter policy "championships: staff, entered competitor or linked student read" on public.championships
  using (
    private.is_staff(academy_id)
    or (
      not is_historical
      and not private.is_finance_blocked(academy_id)
      and (
        private.is_enrolled_in_modality(modality_id)
        or (
          private.competes_in_modality((select auth.uid()), modality_id)
          and exists (
            select 1 from public.championship_entries e
            where e.championship_id = championships.id and e.athlete_id = (select auth.uid())
          )
        )
      )
    )
  );

alter policy "championship_entries: staff or own competitor reads" on public.championship_entries
  using (
    private.is_staff(academy_id)
    or (
      athlete_id = (select auth.uid())
      and not private.is_finance_blocked(academy_id)
      and private.competes_in_modality(athlete_id, private.championship_modality(championship_id))
    )
  );

alter policy "championship_fights: staff or the athlete reads" on public.championship_fights
  using (
    private.is_staff(academy_id)
    or (athlete_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
  );

alter policy "athlete_previous_records: staff or the athlete reads" on public.athlete_previous_records
  using (
    private.is_staff(academy_id)
    or (athlete_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
  );

alter policy "academy_events: staff or audience reads" on public.academy_events
  using (
    private.is_staff(academy_id)
    or (
      private.is_student(academy_id)
      and not private.is_finance_blocked(academy_id)
      and (
        all_modalities
        or exists (
          select 1 from public.academy_event_modalities em
          where em.event_id = academy_events.id and private.is_enrolled_in_modality(em.modality_id)
        )
      )
    )
  );

alter policy "academy_event_rsvps: own, staff, or going to a visible event" on public.academy_event_rsvps
  using (
    (user_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
    or private.is_staff(academy_id)
    or (status = 'going' and private.can_see_academy_event(event_id))
  );

alter policy "academy_event_rsvps: audience changes own answer" on public.academy_event_rsvps
  using (user_id = (select auth.uid()) and private.can_see_academy_event(event_id))
  with check (
    user_id = (select auth.uid())
    and private.can_see_academy_event(event_id)
    and private.in_academy_event_audience(event_id, (select auth.uid()))
  );

alter policy "academy_event_attendance: staff or own reads" on public.academy_event_attendance
  using (
    (user_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
    or private.is_staff(academy_id)
  );

alter policy "academy_event_payments: staff or own reads" on public.academy_event_payments
  using (
    (user_id = (select auth.uid()) and not private.is_finance_blocked(academy_id))
    or private.is_staff(academy_id)
  );
