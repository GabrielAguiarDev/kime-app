-- =============================================================================
-- Kimi — Fight history before the app ("Histórico anterior")
-- (user request, 2026-11-09)
--
-- An athlete may have fought before using Kimi. Owner and instructor record it
-- on the competitor's page, in two ways:
--
-- 1. athlete_previous_records: a summarized record per modality (wins,
--    losses, draws, gold, silver, bronze — numbers only). Shown in the Cartel
--    as a line "Antes do Kimi" and added to the totals.
-- 2. Previous championships: championships flagged is_historical with
--    historical_athlete_id (individual). Date strictly in the past
--    (academy-local). Exactly one entry, the athlete's, created with the
--    championship by create_previous_championship(); placement and fights
--    are recorded as in any championship. They belong to that athlete's
--    history only: no student reads them through the table (Início, list of
--    the academy's championships, other students), and entries of other
--    athletes can never be added.
--
-- Rules: only staff (owner / instructor) create, edit and delete; the athlete
-- only reads (athlete_fight_history / their own previous record).
-- fight_record_summary adds the three sources: previous record + previous
-- championships + championships recorded in the app.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: the user is an active student of the academy.
-- -----------------------------------------------------------------------------
create function private.is_active_student_of(p_user_id uuid, p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy_id and m.user_id = p_user_id
      and m.status = 'active' and m.role = 'student'
  );
$$;
revoke all on function private.is_active_student_of(uuid, uuid) from public, anon;
grant execute on function private.is_active_student_of(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Previous championships
-- -----------------------------------------------------------------------------
alter table public.championships
  add column is_historical boolean not null default false,
  add column historical_athlete_id uuid references public.profiles (id) on delete cascade,
  add constraint championships_historical_athlete_check
    check ((historical_athlete_id is not null) = is_historical);
create index championships_historical_athlete_idx
  on public.championships (historical_athlete_id) where historical_athlete_id is not null;

-- The flag and the athlete are set only by create_previous_championship():
-- the API writes the event columns only.
revoke insert, update on public.championships from authenticated;
grant insert (id, academy_id, modality_id, name, event_date, location) on public.championships to authenticated;
grant update (modality_id, name, event_date, location) on public.championships to authenticated;

-- A previous championship is always in the past (academy-local date).
create function private.guard_previous_championship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_historical and new.event_date >= private.academy_local_date(new.academy_id) then
    raise exception 'previous_championship_not_past' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_previous_championship() from public, anon;
create trigger championships_guard_previous before insert or update of event_date on public.championships
  for each row execute function private.guard_previous_championship();

-- Read past RLS (entries never read championships under RLS).
create function private.championship_is_historical(p_championship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.is_historical from public.championships c where c.id = p_championship_id), false);
$$;
revoke all on function private.championship_is_historical(uuid) from public, anon;
grant execute on function private.championship_is_historical(uuid) to authenticated;

-- Students never read previous championships through the table: they stay
-- out of the Início, the academy's list and other students' views. The
-- athlete reads their own through athlete_fight_history().
drop policy "championships: staff, entered competitor or linked student reads" on public.championships;
create policy "championships: staff, entered competitor or linked student reads team events"
  on public.championships for select to authenticated
  using (
    private.is_staff(academy_id)
    or (
      not is_historical
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

-- The single entry of a previous championship is fixed: no other athlete is
-- entered and it is not removed (it goes with the championship).
drop policy "championship_entries: staff enters competitors of the modality" on public.championship_entries;
create policy "championship_entries: staff enters competitors of the modality"
  on public.championship_entries for insert to authenticated
  with check (
    private.is_staff(academy_id)
    and not private.championship_is_historical(championship_id)
    and private.competes_in_modality(athlete_id, private.championship_modality(championship_id))
  );
drop policy "championship_entries: staff deletes" on public.championship_entries;
create policy "championship_entries: staff deletes"
  on public.championship_entries for delete to authenticated
  using (private.is_staff(academy_id) and not private.championship_is_historical(championship_id));

-- Staff: a previous championship of one athlete (active student of the
-- academy), with their entry. Returns the championship id.
create function public.create_previous_championship(
  p_academy_id uuid,
  p_athlete_id uuid,
  p_modality_id uuid,
  p_name text,
  p_event_date date,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.is_staff(p_academy_id) or not private.is_active_student_of(p_athlete_id, p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.championships
    (academy_id, modality_id, name, event_date, location, is_historical, historical_athlete_id)
  values
    (p_academy_id, p_modality_id, btrim(p_name), p_event_date, coalesce(btrim(p_location), ''), true, p_athlete_id)
  returning id into v_id;
  insert into public.championship_entries (championship_id, academy_id, athlete_id)
  values (v_id, p_academy_id, p_athlete_id);
  return v_id;
end;
$$;
revoke all on function public.create_previous_championship(uuid, uuid, uuid, text, date, text) from public, anon;
grant execute on function public.create_previous_championship(uuid, uuid, uuid, text, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Summarized previous record
-- -----------------------------------------------------------------------------
create table public.athlete_previous_records (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  modality_id uuid not null,
  wins integer not null default 0 check (wins between 0 and 9999),
  losses integer not null default 0 check (losses between 0 and 9999),
  draws integer not null default 0 check (draws between 0 and 9999),
  gold integer not null default 0 check (gold between 0 and 9999),
  silver integer not null default 0 check (silver between 0 and 9999),
  bronze integer not null default 0 check (bronze between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, athlete_id, modality_id),
  -- Same rule as championships: a modality with history is not removed.
  foreign key (modality_id, academy_id)
    references public.academy_modalities (id, academy_id) on delete restrict
);
create index athlete_previous_records_athlete_idx on public.athlete_previous_records (athlete_id);
create index athlete_previous_records_modality_idx on public.athlete_previous_records (modality_id, academy_id);

create trigger athlete_previous_records_set_updated_at before update on public.athlete_previous_records
  for each row execute function private.set_updated_at();

alter table public.athlete_previous_records enable row level security;

grant select, delete on public.athlete_previous_records to authenticated;
grant insert (academy_id, athlete_id, modality_id, wins, losses, draws, gold, silver, bronze)
  on public.athlete_previous_records to authenticated;
grant update (wins, losses, draws, gold, silver, bronze) on public.athlete_previous_records to authenticated;

create policy "athlete_previous_records: staff or the athlete reads"
  on public.athlete_previous_records for select to authenticated
  using (private.is_staff(academy_id) or athlete_id = (select auth.uid()));
create policy "athlete_previous_records: staff record for a student"
  on public.athlete_previous_records for insert to authenticated
  with check (private.is_staff(academy_id) and private.is_active_student_of(athlete_id, academy_id));
create policy "athlete_previous_records: staff edit"
  on public.athlete_previous_records for update to authenticated
  using (private.is_staff(academy_id))
  with check (private.is_staff(academy_id));
create policy "athlete_previous_records: staff delete"
  on public.athlete_previous_records for delete to authenticated
  using (private.is_staff(academy_id));

-- Staff: sets the previous record of a modality (all zeros removes it).
-- SECURITY INVOKER: the policies decide.
create function public.set_previous_record(
  p_academy_id uuid,
  p_athlete_id uuid,
  p_modality_id uuid,
  p_wins integer,
  p_losses integer,
  p_draws integer,
  p_gold integer,
  p_silver integer,
  p_bronze integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_staff(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_wins, 0) + coalesce(p_losses, 0) + coalesce(p_draws, 0)
     + coalesce(p_gold, 0) + coalesce(p_silver, 0) + coalesce(p_bronze, 0) = 0 then
    delete from public.athlete_previous_records
    where academy_id = p_academy_id and athlete_id = p_athlete_id and modality_id = p_modality_id;
    return;
  end if;
  insert into public.athlete_previous_records
    (academy_id, athlete_id, modality_id, wins, losses, draws, gold, silver, bronze)
  values
    (p_academy_id, p_athlete_id, p_modality_id, coalesce(p_wins, 0), coalesce(p_losses, 0), coalesce(p_draws, 0),
     coalesce(p_gold, 0), coalesce(p_silver, 0), coalesce(p_bronze, 0))
  on conflict (academy_id, athlete_id, modality_id) do update
  set wins = excluded.wins, losses = excluded.losses, draws = excluded.draws,
      gold = excluded.gold, silver = excluded.silver, bronze = excluded.bronze;
end;
$$;
revoke all on function public.set_previous_record(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer)
  from public, anon;
grant execute on function public.set_previous_record(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RPCs
-- -----------------------------------------------------------------------------
-- + is_historical ("Registro anterior"). Same rules otherwise.
drop function public.athlete_fight_history(uuid, uuid);
create function public.athlete_fight_history(p_academy_id uuid, p_athlete_id uuid)
returns table (
  entry_id uuid,
  championship_id uuid,
  modality_id uuid,
  name text,
  event_date date,
  location text,
  placement text,
  is_historical boolean,
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
$$;
revoke all on function public.athlete_fight_history(uuid, uuid) from public, anon;
grant execute on function public.athlete_fight_history(uuid, uuid) to authenticated;

-- Totals = previous record + previous championships + championships in the app.
create or replace function public.fight_record_summary(p_academy_id uuid, p_athlete_id uuid)
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
$$;

-- A previous championship is not a team event: only staff list its competitor.
create or replace function public.championship_competitors(p_championship_id uuid)
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
     or not (
       private.is_staff(v_championship.academy_id)
       or (not v_championship.is_historical and private.is_enrolled_in_modality(v_championship.modality_id))
     ) then
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
