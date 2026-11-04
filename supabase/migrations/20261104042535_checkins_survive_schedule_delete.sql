-- =============================================================================
-- Kimi — Deleting a class schedule keeps the check-ins
-- Professors can now delete schedules (not only deactivate them). Confirmed
-- check-ins are the student's history (total, streak, belt progress), so they
-- must survive: the schedule link becomes null instead of cascading.
-- academy_id stays (the composite FK only nulls schedule_id).
-- =============================================================================

alter table public.checkins drop constraint checkins_schedule_id_academy_id_fkey;

alter table public.checkins alter column schedule_id drop not null;

alter table public.checkins
  add constraint checkins_schedule_id_academy_id_fkey
  foreign key (schedule_id, academy_id)
  references public.class_schedules (id, academy_id)
  on delete set null (schedule_id);
