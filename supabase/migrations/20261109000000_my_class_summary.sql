-- =============================================================================
-- Kimi — Class summary of the signed-in student (Jornada → Resumo)
--
-- One modality of one academy, for auth.uid() only:
--   modality_total   confirmed classes in the modality
--   academy_total    confirmed classes in every modality of the academy
--   recent_classes   confirmed classes in the modality in the recent window:
--   recent_days      the last 3 months up to today (academy local date), or
--                    since the membership started when that is later
--   belts            every graduation in the modality (newest first) with the
--                    confirmed classes done in that belt: after the day it was
--                    awarded up to the day of the next one (same rule as
--                    modality_class_stats.confirmed_since_belt)
--
-- No new table: confirmed check-ins + belt_history. SECURITY INVOKER and
-- filtered by auth.uid(): every RLS still applies, a student only ever gets
-- their own numbers. Null when the caller has no membership in the academy.
-- =============================================================================

create function public.my_class_summary(p_academy_id uuid, p_modality_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select m.id, (m.created_at at time zone a.timezone)::date as joined_on, a.timezone
    from public.memberships m
    join public.academies a on a.id = m.academy_id
    where m.academy_id = p_academy_id and m.user_id = (select auth.uid())
    limit 1
  ),
  today as (
    select private.academy_local_date(p_academy_id) as d
  ),
  mine as (
    select c.class_date, c.modality_id
    from public.checkins c
    where c.academy_id = p_academy_id
      and c.user_id = (select auth.uid())
      and c.status = 'confirmed'
  ),
  recent as (
    select greatest(((select d from today) - interval '3 months')::date, me.joined_on) as since
    from me
  ),
  belts as (
    select
      bh.belt_id,
      bh.awarded_at,
      (bh.awarded_at at time zone me.timezone)::date as awarded_on,
      lead(bh.awarded_at) over w as next_awarded_at,
      lead((bh.awarded_at at time zone me.timezone)::date) over w as next_on
    from public.belt_history bh
    join me on me.id = bh.membership_id
    where bh.modality_id = p_modality_id
    window w as (order by bh.awarded_at)
  )
  select jsonb_build_object(
    'modality_total', (select count(*) from mine where mine.modality_id = p_modality_id),
    'academy_total', (select count(*) from mine),
    'recent_classes', (
      select count(*) from mine, recent
      where mine.modality_id = p_modality_id and mine.class_date >= recent.since
    ),
    'recent_days', (select greatest(1, (select d from today) - recent.since + 1) from recent),
    'belts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'belt_id', b.belt_id,
          'awarded_at', b.awarded_at,
          'next_awarded_at', b.next_awarded_at,
          'classes', (
            select count(*) from mine
            where mine.modality_id = p_modality_id
              and mine.class_date > b.awarded_on
              and (b.next_on is null or mine.class_date <= b.next_on)
          )
        )
        order by b.awarded_at desc
      )
      from belts b
    ), '[]'::jsonb)
  )
  from me;
$$;

revoke all on function public.my_class_summary(uuid, uuid) from public, anon;
grant execute on function public.my_class_summary(uuid, uuid) to authenticated;
