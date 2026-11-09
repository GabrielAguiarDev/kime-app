-- =============================================================================
-- Kimi — Relatório de treinos (user decision, 2026-11-09)
--
-- class_report(academy, user): the training report of one student, read by
-- the student themself or by the academy's staff (MemberDetail). Replaces
-- my_class_summary (the "Resumo" sheet is gone).
--
-- No new table: confirmed check-ins, belt_history and the enrollments. SECURITY
-- INVOKER (every RLS still applies) plus an explicit guard: the caller must be
-- the student or active staff of the academy, so a classmate (who can see
-- check-ins of peers) never gets someone else's numbers. Null otherwise, or
-- when the user has no student membership in the academy.
--
--   joined_at     membership start (Treina aqui desde)
--   today         academy local date
--   recent_since  start of the "last 3 months" window (or the membership start)
--   enrollments   [{modality_id, status, is_competitor}]
--   modalities    [{modality_id, total, since_belt, recent}] confirmed classes:
--                 all, after the day of the last graduation in it, in the window
--   months        [{month, modality_id, classes}] whole history, by month
--   weeks         Mondays of every week with a confirmed class (streak record)
--   belts         [{modality_id, belt_id, awarded_at, next_awarded_at, classes}]
--                 oldest first; classes done in the belt: after the day it was
--                 awarded up to the day of the next one (same rule as
--                 modality_class_stats.confirmed_since_belt)
--   milestones    [{modality_id, count, date}] day of the 10th, 25th, 50th,
--                 100th, 200th… confirmed class in the modality
-- =============================================================================

drop function public.my_class_summary(uuid, uuid);

create function public.class_report(p_academy_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select m.id, m.created_at, (m.created_at at time zone a.timezone)::date as joined_on, a.timezone
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    where m.academy_id = p_academy_id
      and m.user_id = p_user_id
      and m.role = 'student'
      and (p_user_id = (select auth.uid()) or private.is_staff(p_academy_id))
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
$$;

revoke all on function public.class_report(uuid, uuid) from public, anon;
grant execute on function public.class_report(uuid, uuid) to authenticated;
