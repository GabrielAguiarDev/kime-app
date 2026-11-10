-- =============================================================================
-- Kimi — Academy events (user request, 2026-11-10)
--
-- Social events of the academy (confraternização, seminário, torneio interno,
-- aula especial, outro) with RSVP. Events are NOT classes: they live in their
-- own tables, so they never reach check-ins, belt counts, streaks or ranking.
--
-- 1. academy_events: title, kind, description, local date + start time
--    (optional end time) in the academy calendar, place (null = "Na
--    academia"), all modalities or some (academy_event_modalities), price in
--    cents (null = free), capacity, RSVP deadline (local date), cover image
--    (public bucket `academy-event-covers`, same rules as the logo) and
--    cancellation. Owner and professors create, edit and cancel (no delete).
-- 2. academy_event_rsvps: the member's own answer (going / not going), only
--    while the event is open (not cancelled, academy-local today ≤ deadline,
--    or ≤ the event day without one) and, for "going", while there are spots
--    (checked under a lock on the event row).
-- 3. academy_event_attendance / academy_event_payments: marked by staff only
--    (who and when); attendance from the event day on; payment only on paid
--    events. Members read only their own rows.
-- 4. Visibility: staff read every event of the academy; a student reads the
--    events for all modalities and those of their active modalities. The
--    "going" list is visible to whoever sees the event (social event: the
--    "show my check-in" preference does not apply), and so are the photos.
-- 5. academy_event_people(event): audience with name, photo, role, belt and
--    answer; staff also get "no answer", attendance and payment.
-- =============================================================================

create type public.academy_event_kind as enum ('social', 'seminar', 'internal_tournament', 'special_class', 'other');
create type public.academy_event_rsvp_status as enum ('going', 'not_going');

-- -----------------------------------------------------------------------------
-- 1. Events
-- -----------------------------------------------------------------------------
create table public.academy_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  kind public.academy_event_kind not null,
  description text check (description is null or char_length(description) <= 2000),
  -- Academy calendar (fixed time zone, academies.timezone).
  event_date date not null,
  start_time time not null,
  -- Optional; an end before the start means past midnight.
  end_time time,
  -- Null = "Na academia".
  location text check (location is null or char_length(btrim(location)) between 1 and 200),
  all_modalities boolean not null default true,
  -- Null = free. Paid directly to the academy (the app does not charge).
  price_cents integer check (price_cents is null or price_cents between 1 and 10000000),
  capacity integer check (capacity is null or capacity between 1 and 10000),
  -- Last day to answer (academy calendar); null = until the event day.
  rsvp_deadline date,
  cover_path text check (
    cover_path is null
    or (cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' and split_part(cover_path, '/', 1) = academy_id::text)
  ),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_events_deadline_before_event check (rsvp_deadline is null or rsvp_deadline <= event_date),
  unique (id, academy_id)
);
create index academy_events_academy_date_idx on public.academy_events (academy_id, event_date);
create index academy_events_created_by_idx on public.academy_events (created_by);
create index academy_events_cancelled_by_idx on public.academy_events (cancelled_by);

create trigger academy_events_set_updated_at
  before update on public.academy_events
  for each row execute function private.set_updated_at();

create table public.academy_event_modalities (
  event_id uuid not null,
  modality_id uuid not null,
  academy_id uuid not null,
  primary key (event_id, modality_id),
  foreign key (event_id, academy_id) references public.academy_events (id, academy_id) on delete cascade,
  foreign key (modality_id, academy_id) references public.academy_modalities (id, academy_id) on delete cascade
);
create index academy_event_modalities_modality_idx on public.academy_event_modalities (modality_id, academy_id);
create index academy_event_modalities_event_academy_idx on public.academy_event_modalities (event_id, academy_id);

-- Stamp who cancelled, keep the creator, freeze a cancelled event.
create function private.guard_academy_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.cancelled_at := null;
    new.cancelled_by := null;
    return new;
  end if;
  new.created_by := old.created_by;
  new.academy_id := old.academy_id;
  if old.cancelled_at is not null then
    raise exception 'event_cancelled' using errcode = 'P0001';
  end if;
  if new.cancelled_at is not null then
    new.cancelled_at := now();
    new.cancelled_by := (select auth.uid());
  else
    new.cancelled_by := null;
  end if;
  return new;
end;
$$;

create trigger academy_events_guard
  before insert or update on public.academy_events
  for each row execute function private.guard_academy_event();

-- The caller sees the event: staff of the academy, or an active student for
-- whom it is meant (all modalities, or one of their active modalities).
create function private.can_see_academy_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_events e
    where e.id = p_event_id
      and (
        private.is_staff(e.academy_id)
        or (
          private.is_student(e.academy_id)
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
$$;
revoke all on function private.can_see_academy_event(uuid) from public, anon;
grant execute on function private.can_see_academy_event(uuid) to authenticated;

-- The user is in the event's audience: active staff of the academy, or an
-- active student linked to one of its modalities (any modality for "all").
create function private.in_academy_event_audience(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_events e
    join public.memberships m on m.academy_id = e.academy_id and m.user_id = p_user_id and m.status = 'active'
    where e.id = p_event_id
      and (
        m.role in ('owner', 'instructor')
        or (
          m.role = 'student'
          and exists (
            select 1 from public.student_modality_enrollments sme
            where sme.membership_id = m.id and sme.status = 'active'
              and (
                e.all_modalities
                or exists (
                  select 1 from public.academy_event_modalities em
                  where em.event_id = e.id and em.modality_id = sme.modality_id
                )
              )
          )
        )
      )
  );
$$;
revoke all on function private.in_academy_event_audience(uuid, uuid) from public, anon;
grant execute on function private.in_academy_event_audience(uuid, uuid) to authenticated;

alter table public.academy_events enable row level security;
alter table public.academy_event_modalities enable row level security;

create policy "academy_events: staff or audience reads"
  on public.academy_events for select to authenticated
  using (
    private.is_staff(academy_id)
    or (
      private.is_student(academy_id)
      and (
        all_modalities
        or exists (
          select 1 from public.academy_event_modalities em
          where em.event_id = academy_events.id and private.is_enrolled_in_modality(em.modality_id)
        )
      )
    )
  );

create policy "academy_events: staff creates"
  on public.academy_events for insert to authenticated
  with check (private.is_staff(academy_id));

create policy "academy_events: staff updates"
  on public.academy_events for update to authenticated
  using (private.is_staff(academy_id))
  with check (private.is_staff(academy_id));

grant select on public.academy_events to authenticated;
grant insert (academy_id, title, kind, description, event_date, start_time, end_time, location,
              all_modalities, price_cents, capacity, rsvp_deadline, cover_path)
  on public.academy_events to authenticated;
grant update (title, kind, description, event_date, start_time, end_time, location,
              all_modalities, price_cents, capacity, rsvp_deadline, cover_path, cancelled_at)
  on public.academy_events to authenticated;

create policy "academy_event_modalities: staff or linked student reads"
  on public.academy_event_modalities for select to authenticated
  using (private.is_staff(academy_id) or private.is_enrolled_in_modality(modality_id));

create policy "academy_event_modalities: staff adds"
  on public.academy_event_modalities for insert to authenticated
  with check (private.is_staff(academy_id));

create policy "academy_event_modalities: staff removes"
  on public.academy_event_modalities for delete to authenticated
  using (private.is_staff(academy_id));

grant select, insert, delete on public.academy_event_modalities to authenticated;

-- -----------------------------------------------------------------------------
-- 2. RSVPs (the member's own answer)
-- -----------------------------------------------------------------------------
create table public.academy_event_rsvps (
  event_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid not null,
  status public.academy_event_rsvp_status not null,
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (event_id, academy_id) references public.academy_events (id, academy_id) on delete cascade
);
create index academy_event_rsvps_user_idx on public.academy_event_rsvps (user_id);
create index academy_event_rsvps_academy_idx on public.academy_event_rsvps (academy_id, status);
create index academy_event_rsvps_event_academy_idx on public.academy_event_rsvps (event_id, academy_id);

-- Fills academy and time; refuses answers outside the window and "going"
-- without spots. The event row is locked so two last answers cannot both
-- take the last spot.
create function private.guard_academy_event_rsvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.academy_events%rowtype;
  v_going integer;
begin
  select * into v_event from public.academy_events where id = new.event_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  new.academy_id := v_event.academy_id;
  new.responded_at := now();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.event_id := old.event_id;
  end if;
  if v_event.cancelled_at is not null then
    raise exception 'event_cancelled' using errcode = 'P0001';
  end if;
  if private.academy_local_date(v_event.academy_id) > coalesce(v_event.rsvp_deadline, v_event.event_date) then
    raise exception 'event_rsvp_closed' using errcode = 'P0001';
  end if;
  if new.status = 'going' and v_event.capacity is not null
     and (tg_op = 'INSERT' or old.status <> 'going') then
    select count(*) into v_going
    from public.academy_event_rsvps r
    where r.event_id = new.event_id and r.status = 'going' and r.user_id <> new.user_id;
    if v_going >= v_event.capacity then
      raise exception 'event_full' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger academy_event_rsvps_guard
  before insert or update on public.academy_event_rsvps
  for each row execute function private.guard_academy_event_rsvp();

alter table public.academy_event_rsvps enable row level security;

-- Staff read all; anyone who sees the event reads who is going; everyone their own.
create policy "academy_event_rsvps: own, staff, or going to a visible event"
  on public.academy_event_rsvps for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_staff(academy_id)
    or (status = 'going' and private.can_see_academy_event(event_id))
  );

create policy "academy_event_rsvps: audience answers for themself"
  on public.academy_event_rsvps for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_see_academy_event(event_id)
    and private.in_academy_event_audience(event_id, (select auth.uid()))
  );

create policy "academy_event_rsvps: audience changes own answer"
  on public.academy_event_rsvps for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.in_academy_event_audience(event_id, (select auth.uid()))
  );

grant select on public.academy_event_rsvps to authenticated;
grant insert (event_id, user_id, status) on public.academy_event_rsvps to authenticated;
grant update (status) on public.academy_event_rsvps to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Attendance and payment (staff)
-- -----------------------------------------------------------------------------
create table public.academy_event_attendance (
  event_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid not null,
  marked_by uuid default auth.uid() references public.profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (event_id, academy_id) references public.academy_events (id, academy_id) on delete cascade
);
create index academy_event_attendance_user_idx on public.academy_event_attendance (user_id);
create index academy_event_attendance_marked_by_idx on public.academy_event_attendance (marked_by);
create index academy_event_attendance_event_academy_idx on public.academy_event_attendance (event_id, academy_id);

create table public.academy_event_payments (
  event_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid not null,
  marked_by uuid default auth.uid() references public.profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (event_id, academy_id) references public.academy_events (id, academy_id) on delete cascade
);
create index academy_event_payments_user_idx on public.academy_event_payments (user_id);
create index academy_event_payments_marked_by_idx on public.academy_event_payments (marked_by);
create index academy_event_payments_event_academy_idx on public.academy_event_payments (event_id, academy_id);

-- Who and when come from the caller and the clock, never from the client.
create function private.stamp_academy_event_mark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.marked_by := (select auth.uid());
  new.marked_at := now();
  select e.academy_id into new.academy_id from public.academy_events e where e.id = new.event_id;
  return new;
end;
$$;

create trigger academy_event_attendance_stamp
  before insert on public.academy_event_attendance
  for each row execute function private.stamp_academy_event_mark();
create trigger academy_event_payments_stamp
  before insert on public.academy_event_payments
  for each row execute function private.stamp_academy_event_mark();

-- Attendance: from the event day on, not cancelled, person in the audience.
create function private.can_mark_academy_event_attendance(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_events e
    where e.id = p_event_id
      and private.is_staff(e.academy_id)
      and e.cancelled_at is null
      and e.event_date <= private.academy_local_date(e.academy_id)
  ) and private.in_academy_event_audience(p_event_id, p_user_id);
$$;
revoke all on function private.can_mark_academy_event_attendance(uuid, uuid) from public, anon;
grant execute on function private.can_mark_academy_event_attendance(uuid, uuid) to authenticated;

-- Payment: paid event, person in the audience.
create function private.can_mark_academy_event_payment(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_events e
    where e.id = p_event_id
      and private.is_staff(e.academy_id)
      and e.price_cents is not null
  ) and private.in_academy_event_audience(p_event_id, p_user_id);
$$;
revoke all on function private.can_mark_academy_event_payment(uuid, uuid) from public, anon;
grant execute on function private.can_mark_academy_event_payment(uuid, uuid) to authenticated;

alter table public.academy_event_attendance enable row level security;
alter table public.academy_event_payments enable row level security;

create policy "academy_event_attendance: staff or own reads"
  on public.academy_event_attendance for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(academy_id));
create policy "academy_event_attendance: staff marks"
  on public.academy_event_attendance for insert to authenticated
  with check (private.can_mark_academy_event_attendance(event_id, user_id));
create policy "academy_event_attendance: staff unmarks"
  on public.academy_event_attendance for delete to authenticated
  using (private.is_staff(academy_id));

create policy "academy_event_payments: staff or own reads"
  on public.academy_event_payments for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff(academy_id));
create policy "academy_event_payments: staff marks"
  on public.academy_event_payments for insert to authenticated
  with check (private.can_mark_academy_event_payment(event_id, user_id));
create policy "academy_event_payments: staff unmarks"
  on public.academy_event_payments for delete to authenticated
  using (private.is_staff(academy_id));

grant select, delete on public.academy_event_attendance, public.academy_event_payments to authenticated;
grant insert (event_id, user_id) on public.academy_event_attendance, public.academy_event_payments to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Save an event with its modalities in one call (INVOKER: the policies above apply)
-- -----------------------------------------------------------------------------
create function public.save_academy_event(
  p_event_id uuid,
  p_academy_id uuid,
  p_title text,
  p_kind public.academy_event_kind,
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
    insert into public.academy_events (academy_id, title, kind, description, event_date, start_time, end_time,
      location, all_modalities, price_cents, capacity, rsvp_deadline, cover_path)
    values (p_academy_id, btrim(p_title), p_kind, nullif(btrim(p_description), ''), p_event_date, p_start_time,
      p_end_time, nullif(btrim(p_location), ''), v_all, p_price_cents, p_capacity, p_rsvp_deadline, p_cover_path)
    returning id into v_id;
  else
    update public.academy_events set
      title = btrim(p_title), kind = p_kind, description = nullif(btrim(p_description), ''),
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
revoke all on function public.save_academy_event(uuid, uuid, text, public.academy_event_kind, text, date, time, time,
  text, uuid[], integer, integer, date, text) from public, anon;
grant execute on function public.save_academy_event(uuid, uuid, text, public.academy_event_kind, text, date, time, time,
  text, uuid[], integer, integer, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. People of an event
-- -----------------------------------------------------------------------------
-- Staff: the whole audience (going, not going, no answer) with attendance and
-- payment. Anyone else who sees the event: who is going, plus their own row.
-- The belt is the latest one in the event's modalities (any modality for "all").
create function public.academy_event_people(p_event_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  role public.membership_role,
  belt_primary text,
  belt_tip text,
  status public.academy_event_rsvp_status,
  responded_at timestamptz,
  attended boolean,
  paid boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.academy_events%rowtype;
  v_staff boolean;
  v_me uuid := (select auth.uid());
begin
  select * into v_event from public.academy_events where id = p_event_id;
  if not found or not private.can_see_academy_event(p_event_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_staff := private.is_staff(v_event.academy_id);

  return query
  with audience as (
    -- Current audience, plus anyone who answered or was marked (left later, kept as history).
    select m.user_id, m.id as membership_id, m.role
    from public.memberships m
    where m.academy_id = v_event.academy_id and m.status = 'active'
      and private.in_academy_event_audience(p_event_id, m.user_id)
    union
    select m.user_id, m.id, m.role
    from public.memberships m
    where m.academy_id = v_event.academy_id
      and m.user_id in (
        select r.user_id from public.academy_event_rsvps r where r.event_id = p_event_id
        union select a.user_id from public.academy_event_attendance a where a.event_id = p_event_id
        union select pm.user_id from public.academy_event_payments pm where pm.event_id = p_event_id
      )
  )
  select au.user_id, p.full_name, p.avatar_path, au.role, b.primary_color::text, b.tip_color::text,
    r.status, r.responded_at,
    case when v_staff or au.user_id = v_me then a.user_id is not null else null end,
    case when v_staff or au.user_id = v_me then pm.user_id is not null else null end
  from audience au
  join public.profiles p on p.id = au.user_id
  left join public.academy_event_rsvps r on r.event_id = p_event_id and r.user_id = au.user_id
  left join public.academy_event_attendance a on a.event_id = p_event_id and a.user_id = au.user_id
  left join public.academy_event_payments pm on pm.event_id = p_event_id and pm.user_id = au.user_id
  left join lateral (
    select mb.primary_color, mb.tip_color
    from public.belt_history bh
    join public.modality_belts mb on mb.id = bh.belt_id
    where bh.membership_id = au.membership_id
      and (
        v_event.all_modalities
        or bh.modality_id in (select em.modality_id from public.academy_event_modalities em where em.event_id = p_event_id)
      )
    order by bh.awarded_at desc
    limit 1
  ) b on true
  where v_staff or r.status = 'going' or au.user_id = v_me
  order by p.full_name;
end;
$$;
revoke all on function public.academy_event_people(uuid) from public, anon;
grant execute on function public.academy_event_people(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Photos: whoever sees an event reads the photos of who is going
-- -----------------------------------------------------------------------------
create function private.goes_to_my_visible_event(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_event_rsvps r
    where r.user_id = p_user_id and r.status = 'going'
      and private.can_see_academy_event(r.event_id)
  );
$$;
revoke all on function private.goes_to_my_visible_event(uuid) from public, anon;
grant execute on function private.goes_to_my_visible_event(uuid) to authenticated;

drop policy "avatars: own, staff, classmates or the academy's staff" on storage.objects;
create policy "avatars: own, staff, classmates, the academy's staff or event goers" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (
  private.storage_folder_uuid(name) = (select auth.uid())
  or private.is_staff_of_member(private.storage_folder_uuid(name))
  or private.shares_active_modality(private.storage_folder_uuid(name))
  or private.is_staff_of_my_academy(private.storage_folder_uuid(name))
  or private.goes_to_my_visible_event(private.storage_folder_uuid(name))
));

-- -----------------------------------------------------------------------------
-- 7. Cover images: public bucket, same rules as the logo (2 MB, JPEG/PNG/WebP,
--    `<academy_id>/<file>`), written by the academy's staff
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-event-covers', 'academy-event-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "academy-event-covers: staff reads own academy objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'academy-event-covers' and private.is_staff(private.academy_id_from_storage_path(name)));
create policy "academy-event-covers: staff uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'academy-event-covers' and private.is_staff(private.academy_id_from_storage_path(name)));
create policy "academy-event-covers: staff replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'academy-event-covers' and private.is_staff(private.academy_id_from_storage_path(name)))
  with check (bucket_id = 'academy-event-covers' and private.is_staff(private.academy_id_from_storage_path(name)));
create policy "academy-event-covers: staff deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'academy-event-covers' and private.is_staff(private.academy_id_from_storage_path(name)));
