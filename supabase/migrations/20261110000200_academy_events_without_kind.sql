-- =============================================================================
-- Kimi — Academy events without a type (user decision, 2026-11-10)
--
-- Events vary too much to predefine kinds: the title says what it is. Drops
-- academy_events.kind, the academy_event_kind enum and the p_kind argument.
-- =============================================================================

drop function public.save_academy_event(uuid, uuid, text, public.academy_event_kind, text, date, time, time,
  text, uuid[], integer, integer, date, text);

alter table public.academy_events drop column kind;
drop type public.academy_event_kind;

create function public.save_academy_event(
  p_event_id uuid,
  p_academy_id uuid,
  p_title text,
  p_description text,
  p_event_date date,
  p_start_time time,
  p_end_time time,
  p_location text,
  p_modality_ids uuid[],
  p_price_cents integer,
  p_capacity integer,
  p_rsvp_deadline date,
  p_cover_path text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_all boolean := coalesce(cardinality(p_modality_ids), 0) = 0;
begin
  if not private.is_staff(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not v_all and exists (
    select 1 from unnest(p_modality_ids) mid
    where not exists (select 1 from public.academy_modalities m where m.id = mid and m.academy_id = p_academy_id)
  ) then
    raise exception 'invalid_modality' using errcode = 'P0001';
  end if;

  if p_event_id is null then
    insert into public.academy_events (academy_id, title, description, event_date, start_time, end_time,
      location, all_modalities, price_cents, capacity, rsvp_deadline, cover_path)
    values (p_academy_id, btrim(p_title), nullif(btrim(p_description), ''), p_event_date, p_start_time,
      p_end_time, nullif(btrim(p_location), ''), v_all, p_price_cents, p_capacity, p_rsvp_deadline, p_cover_path)
    returning id into v_id;
  else
    update public.academy_events set
      title = btrim(p_title), description = nullif(btrim(p_description), ''),
      event_date = p_event_date, start_time = p_start_time, end_time = p_end_time,
      location = nullif(btrim(p_location), ''), all_modalities = v_all, price_cents = p_price_cents,
      capacity = p_capacity, rsvp_deadline = p_rsvp_deadline, cover_path = p_cover_path
    where id = p_event_id and academy_id = p_academy_id
    returning id into v_id;
    if v_id is null then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    delete from public.academy_event_modalities where event_id = v_id;
  end if;

  if not v_all then
    insert into public.academy_event_modalities (event_id, modality_id, academy_id)
    select v_id, mid, p_academy_id from (select distinct unnest(p_modality_ids) as mid) s;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_academy_event(uuid, uuid, text, text, date, time, time,
  text, uuid[], integer, integer, date, text) from public, anon;
grant execute on function public.save_academy_event(uuid, uuid, text, text, date, time, time,
  text, uuid[], integer, integer, date, text) to authenticated;
