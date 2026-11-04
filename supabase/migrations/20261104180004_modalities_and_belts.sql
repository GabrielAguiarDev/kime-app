-- =============================================================================
-- Kimi — Modalities with their own belt sequences
--
--   academy_modalities.uses_belts   the modality has a belt sequence (or only
--                                   counts classes)
--   class_schedules.modality_id     schedules point at a registered modality
--                                   (the free-text column is gone; existing
--                                   texts became modalities)
--   checkins.modality_id            copied from the schedule at check-in time
--                                   (survives the schedule being deleted or
--                                   moved to another modality)
--   modality_belts                  per-modality sequence written by the owner:
--                                   name, color (#RRGGBB), position, classes
--   belt_history.modality_id/belt_id the student's belt is PER MODALITY; the
--                                   current belt is the latest award in it
--
-- memberships.belt, belt_goals and the palette-key check are dropped: belts
-- are now rows with a free name and color. Existing data is kept: each
-- academy's belt_goals and belt history move to its first modality.
--
-- Stats (security_invoker views, students only):
--   membership_class_stats  confirmed classes in the academy (every modality)
--   modality_class_stats    per student × modality: current belt, confirmed
--                           classes in that modality and confirmed classes in
--                           it AFTER the day of the last graduation in it
-- =============================================================================

-- ---------------------------------------------------------------- modalities ---
alter table public.academy_modalities
  add column uses_belts boolean not null default true;

-- Target of the composite FKs below (a schedule/belt and its modality are
-- always in the same academy).
alter table public.academy_modalities
  add constraint academy_modalities_id_academy_id_key unique (id, academy_id);

grant insert (uses_belts), update (uses_belts) on public.academy_modalities to authenticated;

-- -------------------------------------------------- schedules → modality_id ---
-- Texts used by schedules that are not registered yet become modalities,
-- without belts (the owner turns belts on in settings; the modality that
-- receives the old belt goals below is switched on).
insert into public.academy_modalities (academy_id, name, position, uses_belts)
select s.academy_id, s.name,
       (coalesce((select max(m.position) from public.academy_modalities m where m.academy_id = s.academy_id), -1)
        + row_number() over (partition by s.academy_id order by s.name))::smallint,
       false
from (
  select distinct on (cs.academy_id, lower(btrim(cs.modality))) cs.academy_id, btrim(cs.modality) as name
  from public.class_schedules cs
  where not exists (
    select 1 from public.academy_modalities m
    where m.academy_id = cs.academy_id and lower(btrim(m.name)) = lower(btrim(cs.modality))
  )
  order by cs.academy_id, lower(btrim(cs.modality)), cs.created_at
) s;

alter table public.class_schedules add column modality_id uuid;

update public.class_schedules cs
set modality_id = m.id
from public.academy_modalities m
where m.academy_id = cs.academy_id and lower(btrim(m.name)) = lower(btrim(cs.modality));

alter table public.class_schedules alter column modality_id set not null;

-- A modality with schedules cannot be deleted (the app asks to remove them first).
alter table public.class_schedules
  add constraint class_schedules_modality_fkey
  foreign key (modality_id, academy_id)
  references public.academy_modalities (id, academy_id) on delete restrict;
create index class_schedules_modality_idx on public.class_schedules (modality_id, academy_id);

alter table public.class_schedules drop column modality;

-- ---------------------------------------------------- checkins → modality_id ---
alter table public.checkins add column modality_id uuid;

update public.checkins c
set modality_id = s.modality_id
from public.class_schedules s
where s.id = c.schedule_id;

-- Deleting a modality keeps the check-ins (they still count in the total).
alter table public.checkins
  add constraint checkins_modality_fkey
  foreign key (modality_id) references public.academy_modalities (id) on delete set null;
create index checkins_user_academy_modality_idx on public.checkins (user_id, academy_id, modality_id, status);
create index checkins_modality_idx on public.checkins (modality_id);

-- SECURITY INVOKER: the student inserting can read the academy's schedules
-- (members read); for anyone else the insert policy rejects the row anyway.
-- Not in the insert column grant: the client never sets it.
create function private.stamp_checkin_modality()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modality_id := (select s.modality_id from public.class_schedules s where s.id = new.schedule_id);
  return new;
end;
$$;

revoke all on function private.stamp_checkin_modality() from public, anon;
grant execute on function private.stamp_checkin_modality() to authenticated;

create trigger checkins_stamp_modality before insert on public.checkins
  for each row execute function private.stamp_checkin_modality();

-- ------------------------------------------------------------ modality_belts ---
create table public.modality_belts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  modality_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-F]{6}$'),
  position smallint not null check (position >= 0),
  -- Confirmed classes in the modality, counted since the previous graduation.
  classes_required integer not null check (classes_required between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (modality_id, academy_id)
    references public.academy_modalities (id, academy_id) on delete cascade,
  -- Reorders swap positions: checked at commit.
  constraint modality_belts_position_key unique (modality_id, position) deferrable initially deferred,
  -- Target of belt_history's composite FK.
  constraint modality_belts_id_modality_id_key unique (id, modality_id)
);
create unique index modality_belts_name_idx on public.modality_belts (modality_id, lower(btrim(name)));
create index modality_belts_academy_idx on public.modality_belts (academy_id);

create trigger modality_belts_set_updated_at before update on public.modality_belts
  for each row execute function private.set_updated_at();

-- Normalized on write: trimmed name, upper-case hex.
create function private.normalize_modality_belt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.color := upper(new.color);
  return new;
end;
$$;

revoke all on function private.normalize_modality_belt() from public, anon;
grant execute on function private.normalize_modality_belt() to authenticated;

create trigger modality_belts_normalize before insert or update on public.modality_belts
  for each row execute function private.normalize_modality_belt();

alter table public.modality_belts enable row level security;

grant select, delete on public.modality_belts to authenticated;
grant insert (academy_id, modality_id, name, color, position, classes_required) on public.modality_belts to authenticated;
grant update (name, color, position, classes_required) on public.modality_belts to authenticated;

create policy "modality_belts: members read"
  on public.modality_belts for select to authenticated
  using (private.is_member(academy_id));
create policy "modality_belts: owner inserts on modalities with belts"
  on public.modality_belts for insert to authenticated
  with check (
    private.is_owner(academy_id)
    and exists (
      select 1 from public.academy_modalities m
      where m.id = modality_id and m.academy_id = modality_belts.academy_id and m.uses_belts
    )
  );
create policy "modality_belts: owner updates"
  on public.modality_belts for update to authenticated
  using (private.is_owner(academy_id))
  with check (private.is_owner(academy_id));
create policy "modality_belts: owner deletes"
  on public.modality_belts for delete to authenticated
  using (private.is_owner(academy_id));

-- SECURITY INVOKER: plain RLS (owner-only update). Rewrites the order of one
-- modality's belts in a single transaction.
create function public.reorder_modality_belts(p_modality_id uuid, p_belt_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.modality_belts where modality_id = p_modality_id)
     <> coalesce(array_length(p_belt_ids, 1), 0) then
    raise exception 'belt_order_incomplete' using errcode = '22023';
  end if;

  update public.modality_belts b
  set position = o.ordinality - 1
  from unnest(p_belt_ids) with ordinality as o (id, ordinality)
  where b.id = o.id and b.modality_id = p_modality_id;
end;
$$;

revoke all on function public.reorder_modality_belts(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_modality_belts(uuid, uuid[]) to authenticated;

-- --------------------------------------------- existing belts → first modality ---
-- Belt keys of the old palette (DESIGN-SYSTEM.md 2.4) → name and color.
create temp table belt_palette (key text primary key, name text, color text, ord int) on commit drop;
insert into belt_palette values
  ('white', 'Branca', '#F2F2F2', 0), ('gray', 'Cinza', '#8E9196', 1), ('yellow', 'Amarela', '#F2C418', 2),
  ('orange', 'Laranja', '#F07A1A', 3), ('green', 'Verde', '#2E9E4F', 4), ('blue', 'Azul', '#1F5FD1', 5),
  ('purple', 'Roxa', '#6E3FC9', 6), ('brown', 'Marrom', '#7A4A2A', 7), ('black', 'Preta', '#151515', 8),
  ('red', 'Coral / Vermelha', '#C8242F', 9);

-- Belts set on memberships before the history existed have no history row:
-- give them one (dated when the membership was decided/created) so the
-- conversion below keeps them. Triggers stamp now(); the date is fixed after.
create temp table belt_backfill on commit drop as
select m.id as membership_id, m.belt, coalesce(m.decided_at, m.created_at) as awarded_at
from public.memberships m
where m.belt is not null
  and not exists (select 1 from public.belt_history h where h.membership_id = m.id);

insert into public.belt_history (membership_id, belt)
select membership_id, belt from belt_backfill;

update public.belt_history h
set awarded_at = b.awarded_at, awarded_by = null
from belt_backfill b
where h.membership_id = b.membership_id and h.belt = b.belt;

alter table public.belt_history add column modality_id uuid, add column belt_id uuid;

do $$
declare
  r record;
  v_modality uuid;
begin
  for r in
    select a.id as academy_id from public.academies a
    where exists (select 1 from public.belt_goals g where g.academy_id = a.id)
       or exists (select 1 from public.belt_history h join public.memberships m on m.id = h.membership_id
                  where m.academy_id = a.id)
  loop
    select m.id into v_modality
    from public.academy_modalities m
    where m.academy_id = r.academy_id
    order by m.position, m.created_at
    limit 1;
    if v_modality is null then
      -- Belts but no modality (all were removed in settings): keep the belts
      -- under a generic modality instead of failing the migration.
      insert into public.academy_modalities (academy_id, name, position, uses_belts)
      values (r.academy_id, 'Geral', 0, true)
      returning id into v_modality;
    end if;
    update public.academy_modalities set uses_belts = true where id = v_modality;

    -- The academy's goals in their order, then belts only seen in the history.
    insert into public.modality_belts (academy_id, modality_id, name, color, position, classes_required)
    select r.academy_id, v_modality, p.name, p.color, (row_number() over (order by k.sort1, k.sort2) - 1)::smallint, k.required
    from (
      select g.belt as key, 0 as sort1, g.position as sort2, g.classes_required as required
      from public.belt_goals g where g.academy_id = r.academy_id
      union all
      select distinct h.belt, 1, bp.ord, 1
      from public.belt_history h
      join public.memberships m on m.id = h.membership_id
      join belt_palette bp on bp.key = h.belt
      where m.academy_id = r.academy_id
        and not exists (select 1 from public.belt_goals g where g.academy_id = r.academy_id and g.belt = h.belt)
    ) k
    join belt_palette p on p.key = k.key;

    update public.belt_history h
    set modality_id = v_modality,
        belt_id = (select b.id from public.modality_belts b join belt_palette p on p.name = b.name
                   where b.modality_id = v_modality and p.key = h.belt)
    from public.memberships m
    where m.id = h.membership_id and m.academy_id = r.academy_id;
  end loop;
end;
$$;

-- Check-ins whose schedule was deleted before this migration have no modality
-- to copy: they go to the academy's first modality (the same one that got the
-- belts), so progress toward the next belt does not drop after the deploy.
update public.checkins c
set modality_id = (
  select m.id from public.academy_modalities m
  where m.academy_id = c.academy_id
  order by m.uses_belts desc, m.position, m.created_at
  limit 1
)
where c.modality_id is null;

-- -------------------------------------------------------------- belt_history ---
drop view public.membership_class_stats;

drop trigger belt_history_apply on public.belt_history;
drop function private.apply_belt_award();
drop trigger memberships_guard_belt on public.memberships;
drop function private.guard_belt_update();

alter table public.belt_history drop column belt;
alter table public.belt_history alter column modality_id set not null, alter column belt_id set not null;
alter table public.belt_history
  add constraint belt_history_belt_fkey
  foreign key (belt_id, modality_id) references public.modality_belts (id, modality_id) on delete restrict;
create index belt_history_membership_modality_idx on public.belt_history (membership_id, modality_id, awarded_at desc);
create index belt_history_belt_modality_idx on public.belt_history (belt_id, modality_id);

alter table public.memberships drop column belt;

drop function public.reorder_belt_goals(uuid, uuid[]);
drop table public.belt_goals;
drop function private.is_belt_key(text);

-- Session sets who and when; the belt sets the modality.
-- SECURITY INVOKER: staff of the academy read its belts (members read).
create or replace function private.stamp_belt_award()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.awarded_by := (select auth.uid());
  new.awarded_at := now();
  new.modality_id := (select b.modality_id from public.modality_belts b where b.id = new.belt_id);
  return new;
end;
$$;

revoke insert on public.belt_history from authenticated;
grant insert (membership_id, belt_id) on public.belt_history to authenticated;

-- Only students have belts (owners and instructors do not train in the app),
-- and only in modalities that use belts.
drop policy "belt_history: staff awards students, owner awards anyone" on public.belt_history;
create policy "belt_history: staff awards active students"
  on public.belt_history for insert to authenticated
  with check (exists (
    select 1
    from public.memberships m
    join public.modality_belts b on b.id = belt_id and b.academy_id = m.academy_id
    join public.academy_modalities mo on mo.id = b.modality_id and mo.uses_belts
    where m.id = membership_id
      and m.status = 'active'
      and m.role = 'student'
      and private.is_staff(m.academy_id)
  ));

-- ---------------------------------------------------------------------- stats ---
create view public.membership_class_stats
with (security_invoker = true)
as
select
  m.id as membership_id,
  m.academy_id,
  m.user_id,
  count(c.id) filter (where c.status = 'confirmed')::int as confirmed_total
from public.memberships m
left join public.checkins c on c.user_id = m.user_id and c.academy_id = m.academy_id
where m.role = 'student'
group by m.id, m.academy_id, m.user_id;

create view public.modality_class_stats
with (security_invoker = true)
as
select
  m.id as membership_id,
  m.academy_id,
  m.user_id,
  mo.id as modality_id,
  lb.belt_id,
  lb.awarded_at as belt_awarded_at,
  count(c.id) filter (where c.status = 'confirmed')::int as confirmed_total,
  count(c.id) filter (
    where c.status = 'confirmed' and (lb.awarded_on is null or c.class_date > lb.awarded_on)
  )::int as confirmed_since_belt
from public.memberships m
join public.academy_modalities mo on mo.academy_id = m.academy_id
left join lateral (
  select bh.belt_id, bh.awarded_at, (bh.awarded_at at time zone a.timezone)::date as awarded_on
  from public.belt_history bh
  join public.academies a on a.id = m.academy_id
  where bh.membership_id = m.id and bh.modality_id = mo.id
  order by bh.awarded_at desc
  limit 1
) lb on true
left join public.checkins c
  on c.user_id = m.user_id and c.academy_id = m.academy_id and c.modality_id = mo.id
where m.role = 'student'
group by m.id, m.academy_id, m.user_id, mo.id, lb.belt_id, lb.awarded_at, lb.awarded_on;

revoke all on public.membership_class_stats, public.modality_class_stats from anon, authenticated;
grant select on public.membership_class_stats, public.modality_class_stats to authenticated;
