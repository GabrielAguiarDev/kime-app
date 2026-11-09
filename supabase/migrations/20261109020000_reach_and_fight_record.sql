-- =============================================================================
-- Kimi — Reach ("Alcance") on the profile and the fight record ("Cartel")
-- (user request, 2026-11-09)
--
-- 1. profiles.reach_cm: fingertip to fingertip, arms open. Same access as
--    weight and height: edited by the user only, read through
--    get_profile_details (the user, or staff of an academy where the user is
--    an active competitor). Classmates never read it.
-- 2. championship_entries.placement: gold | silver | bronze | none (optional).
-- 3. championship_fights: the fights of one entry (so of one athlete in one
--    championship, hence one modality): result, method, optional stage,
--    opponent and note, who recorded it and when.
--    Write rules (fights and placement): active staff (owner or instructor)
--    of the academy, only for an athlete entered in that championship (the
--    row hangs off the entry), and only from the championship day on
--    (academy-local date). Students never write.
--    Read: staff of the academy and the athlete themself.
-- 4. RPCs:
--    - athlete_fight_history(academy, athlete): entries of past/today
--      championships with placement and fights (the athlete or staff);
--    - fight_record_summary(academy, athlete): per modality wins / losses /
--      draws and medals. The athlete and staff get every modality; a
--      classmate gets only the modalities in common where the athlete
--      competes (no fights in detail);
--    - championship_competitors(): + placement and the athlete's tally in
--      that championship (students linked to the modality see the results).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reach
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column reach_cm numeric(5, 1) check (reach_cm > 0 and reach_cm < 300);

grant update (reach_cm) on public.profiles to authenticated;

-- The return type changes: drop and recreate (same rule as before).
drop function public.get_profile_details(uuid);
create function public.get_profile_details(p_user_id uuid)
returns table (weight_kg numeric, height_cm numeric, reach_cm numeric, sex text, birth_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.weight_kg, p.height_cm, p.reach_cm, p.sex, p.birth_date
  from public.profiles p
  where p.id = p_user_id
    and (p.id = (select auth.uid()) or private.is_staff_of_competitor(p.id));
$$;
revoke all on function public.get_profile_details(uuid) from public, anon;
grant execute on function public.get_profile_details(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Placement on the entry
-- -----------------------------------------------------------------------------
alter table public.championship_entries
  add column placement text check (placement in ('gold', 'silver', 'bronze', 'none')),
  add constraint championship_entries_id_academy_athlete_key unique (id, academy_id, athlete_id);

-- Entering an athlete never sets a placement: insert only the entry columns.
revoke insert on public.championship_entries from authenticated;
grant insert (championship_id, academy_id, athlete_id) on public.championship_entries to authenticated;
grant update (placement) on public.championship_entries to authenticated;

-- Caller may record results for the entry: active staff of its academy and
-- the championship day has come (academy-local date).
create function private.can_record_results(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.championship_entries e
    join public.championships c on c.id = e.championship_id
    where e.id = p_entry_id
      and private.is_staff(e.academy_id)
      and c.event_date <= private.academy_local_date(e.academy_id)
  );
$$;
revoke all on function private.can_record_results(uuid) from public, anon;
grant execute on function private.can_record_results(uuid) to authenticated;

create policy "championship_entries: staff record the placement after the event"
  on public.championship_entries for update to authenticated
  using (private.can_record_results(id))
  with check (private.can_record_results(id));

-- -----------------------------------------------------------------------------
-- 3. Fights
-- -----------------------------------------------------------------------------
create table public.championship_fights (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  -- Filled from the entry (trigger); kept consistent by the composite FK.
  academy_id uuid not null,
  athlete_id uuid not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  method text not null check (method in ('points', 'ko', 'tko', 'submission', 'dq', 'other')),
  stage text check (stage in ('elimination', 'quarterfinal', 'semifinal', 'final', 'other')),
  opponent_name text check (char_length(btrim(opponent_name)) between 1 and 120),
  note text check (char_length(btrim(note)) between 1 and 500),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (entry_id, academy_id, athlete_id)
    references public.championship_entries (id, academy_id, athlete_id) on delete cascade
);
create index championship_fights_entry_idx on public.championship_fights (entry_id, academy_id, athlete_id);
create index championship_fights_academy_idx on public.championship_fights (academy_id);
create index championship_fights_athlete_idx on public.championship_fights (athlete_id);
create index championship_fights_recorded_by_idx on public.championship_fights (recorded_by);

create trigger championship_fights_set_updated_at before update on public.championship_fights
  for each row execute function private.set_updated_at();

-- academy / athlete come from the entry; recorded_by is always the caller.
create function private.championship_fight_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select e.academy_id, e.athlete_id into new.academy_id, new.athlete_id
    from public.championship_entries e where e.id = new.entry_id;
    new.recorded_by := (select auth.uid());
  else
    new.entry_id := old.entry_id;
    new.academy_id := old.academy_id;
    new.athlete_id := old.athlete_id;
    new.recorded_by := old.recorded_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function private.championship_fight_fill() from public, anon;
create trigger championship_fights_fill before insert or update on public.championship_fights
  for each row execute function private.championship_fight_fill();

alter table public.championship_fights enable row level security;

grant select, delete on public.championship_fights to authenticated;
grant insert (entry_id, result, method, stage, opponent_name, note) on public.championship_fights to authenticated;
grant update (result, method, stage, opponent_name, note) on public.championship_fights to authenticated;

create policy "championship_fights: staff or the athlete reads"
  on public.championship_fights for select to authenticated
  using (private.is_staff(academy_id) or athlete_id = (select auth.uid()));
create policy "championship_fights: staff record after the event"
  on public.championship_fights for insert to authenticated
  with check (private.can_record_results(entry_id));
create policy "championship_fights: staff edit after the event"
  on public.championship_fights for update to authenticated
  using (private.can_record_results(entry_id))
  with check (private.can_record_results(entry_id));
create policy "championship_fights: staff delete after the event"
  on public.championship_fights for delete to authenticated
  using (private.can_record_results(entry_id));

-- -----------------------------------------------------------------------------
-- 4. RPCs
-- -----------------------------------------------------------------------------
-- Championships (held or today) of an athlete in an academy, newest first:
-- placement and the fights. The athlete themself or staff of the academy.
create function public.athlete_fight_history(p_academy_id uuid, p_athlete_id uuid)
returns table (
  entry_id uuid,
  championship_id uuid,
  modality_id uuid,
  name text,
  event_date date,
  location text,
  placement text,
  -- [{id, result, method, stage, opponent_name, note, created_at}] in recording order.
  fights jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (p_athlete_id = (select auth.uid()) or private.is_staff(p_academy_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select e.id, c.id, c.modality_id, c.name, c.event_date, c.location, e.placement,
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
$$;
revoke all on function public.athlete_fight_history(uuid, uuid) from public, anon;
grant execute on function public.athlete_fight_history(uuid, uuid) to authenticated;

-- Record per modality where the athlete competes (or has results).
-- Athlete / staff: every such modality. A classmate (active student): only
-- the modalities both are linked to where the athlete competes now.
create function public.fight_record_summary(p_academy_id uuid, p_athlete_id uuid)
returns table (
  modality_id uuid,
  wins integer,
  losses integer,
  draws integer,
  gold integer,
  silver integer,
  bronze integer,
  championships integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_full boolean := p_athlete_id = (select auth.uid()) or private.is_staff(p_academy_id);
  v_viewer uuid;
begin
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
  ),
  entries as (
    select en.id, c.modality_id, en.placement
    from public.championship_entries en
    join public.championships c on c.id = en.championship_id
    where en.academy_id = p_academy_id and en.athlete_id = p_athlete_id
      and c.event_date <= private.academy_local_date(p_academy_id)
  )
  select mo.modality_id,
    (select count(*)::int from public.championship_fights f join entries en on en.id = f.entry_id
      where en.modality_id = mo.modality_id and f.result = 'win'),
    (select count(*)::int from public.championship_fights f join entries en on en.id = f.entry_id
      where en.modality_id = mo.modality_id and f.result = 'loss'),
    (select count(*)::int from public.championship_fights f join entries en on en.id = f.entry_id
      where en.modality_id = mo.modality_id and f.result = 'draw'),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id and en.placement = 'gold'),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id and en.placement = 'silver'),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id and en.placement = 'bronze'),
    (select count(*)::int from entries en where en.modality_id = mo.modality_id)
  from modalities mo
  where exists (select 1 from athlete);
end;
$$;
revoke all on function public.fight_record_summary(uuid, uuid) from public, anon;
grant execute on function public.fight_record_summary(uuid, uuid) to authenticated;

-- Competitors entered in a championship, now with the placement and the tally
-- of that championship (staff, or a student linked to its modality).
drop function public.championship_competitors(uuid);
create function public.championship_competitors(p_championship_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  belt_primary text,
  belt_tip text,
  placement text,
  wins integer,
  losses integer,
  draws integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_championship public.championships%rowtype;
begin
  select * into v_championship from public.championships where id = p_championship_id;
  if not found
     or not (private.is_staff(v_championship.academy_id) or private.is_enrolled_in_modality(v_championship.modality_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.avatar_path, b.primary_color, b.tip_color, e.placement,
    (select count(*)::int from public.championship_fights f where f.entry_id = e.id and f.result = 'win'),
    (select count(*)::int from public.championship_fights f where f.entry_id = e.id and f.result = 'loss'),
    (select count(*)::int from public.championship_fights f where f.entry_id = e.id and f.result = 'draw')
  from public.championship_entries e
  join public.profiles p on p.id = e.athlete_id
  join public.memberships m on m.user_id = e.athlete_id and m.academy_id = v_championship.academy_id
  left join lateral private.modality_belt(m.id, v_championship.modality_id) b on true
  where e.championship_id = p_championship_id
  order by case e.placement when 'gold' then 0 when 'silver' then 1 when 'bronze' then 2 else 3 end, p.full_name;
end;
$$;
revoke all on function public.championship_competitors(uuid) from public, anon;
grant execute on function public.championship_competitors(uuid) to authenticated;
