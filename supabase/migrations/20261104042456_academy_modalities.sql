-- =============================================================================
-- Kimi — Academy modalities
-- The academy declares the modalities it teaches when it is created; class
-- schedules pick from that list. A table (not a text[] column) so modalities
-- get their own RLS, can be renamed/reordered and, later, carry belt goals
-- per modality (DESIGN-SYSTEM.md 2.4).
-- =============================================================================

create table public.academy_modalities (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One name per academy, case-insensitive. Also serves the academy_id FK lookups.
create unique index academy_modalities_academy_name_idx
  on public.academy_modalities (academy_id, lower(btrim(name)));

create trigger academy_modalities_set_updated_at before update on public.academy_modalities
  for each row execute function private.set_updated_at();

-- Existing academies: keep the modalities already used by their schedules.
insert into public.academy_modalities (academy_id, name, position)
select academy_id, modality, (row_number() over (partition by academy_id order by modality) - 1)::smallint
from (select distinct on (academy_id, lower(btrim(modality))) academy_id, btrim(modality) as modality
      from public.class_schedules
      order by academy_id, lower(btrim(modality)), created_at) s;

-- -----------------------------------------------------------------------------
-- Access: members read; professors manage.
-- -----------------------------------------------------------------------------
alter table public.academy_modalities enable row level security;

grant select, delete on public.academy_modalities to authenticated;
grant insert (academy_id, name, position) on public.academy_modalities to authenticated;
grant update (name, position) on public.academy_modalities to authenticated;

create policy "academy_modalities: members read"
  on public.academy_modalities for select to authenticated
  using (private.is_member(academy_id));
create policy "academy_modalities: professor inserts"
  on public.academy_modalities for insert to authenticated
  with check (private.is_professor(academy_id));
create policy "academy_modalities: professor updates"
  on public.academy_modalities for update to authenticated
  using (private.is_professor(academy_id))
  with check (private.is_professor(academy_id));
create policy "academy_modalities: professor deletes"
  on public.academy_modalities for delete to authenticated
  using (private.is_professor(academy_id));

-- -----------------------------------------------------------------------------
-- create_academy now also takes the modalities (same transaction).
-- SECURITY DEFINER for the same reason as before: the creator's first
-- professor membership cannot be granted by a policy.
-- -----------------------------------------------------------------------------
drop function public.create_academy(text);

create function public.create_academy(p_name text, p_modalities text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_academy_id uuid;
  v_modalities text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_academy_name' using errcode = '22023';
  end if;

  -- Trimmed, non-empty, deduplicated case-insensitively, first spelling wins, order kept.
  select coalesce(array_agg(m.name order by m.first_ord), '{}')
  into v_modalities
  from (
    select distinct on (lower(btrim(u.name))) btrim(u.name) as name, u.ord as first_ord
    from unnest(coalesce(p_modalities, '{}')) with ordinality as u (name, ord)
    where btrim(u.name) <> ''
    order by lower(btrim(u.name)), u.ord
  ) m;

  if cardinality(v_modalities) not between 1 and 20
     or exists (select 1 from unnest(v_modalities) n where char_length(n) > 60) then
    raise exception 'invalid_modalities' using errcode = '22023';
  end if;

  insert into public.academies (name, created_by)
  values (v_name, v_uid)
  returning id into v_academy_id;

  insert into public.memberships (academy_id, user_id, role, status, decided_by, decided_at)
  values (v_academy_id, v_uid, 'professor', 'active', v_uid, now());

  insert into public.academy_invites (academy_id, role, created_by)
  values (v_academy_id, 'student', v_uid), (v_academy_id, 'professor', v_uid);

  insert into public.academy_modalities (academy_id, name, position)
  select v_academy_id, n, (ord - 1)::smallint
  from unnest(v_modalities) with ordinality as t (n, ord);

  return v_academy_id;
end;
$$;

revoke all on function public.create_academy(text, text[]) from public, anon;
grant execute on function public.create_academy(text, text[]) to authenticated;
