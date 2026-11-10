-- The generated client types require academy_id on insert (NOT NULL without a
-- default), so the app sends it. The triggers still overwrite it with the
-- event's academy, so a wrong value changes nothing.
grant insert (academy_id) on public.academy_event_rsvps, public.academy_event_attendance, public.academy_event_payments
  to authenticated;
