-- TV pairing and timer transport. Anonymous Supabase users have the authenticated role.
create table public.tv_displays (
  id uuid primary key default gen_random_uuid(),
  display_user_id uuid not null unique references auth.users(id) on delete cascade,
  academy_id uuid references public.academies(id) on delete set null,
  name text not null default 'TV',
  pairing_code text unique,
  pairing_expires_at timestamptz,
  paired_by uuid references auth.users(id) on delete set null,
  paired_at timestamptz,
  last_seen_at timestamptz,
  timer_state jsonb,
  state_version integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint tv_name_length check (char_length(name) between 1 and 80),
  constraint tv_code_format check (pairing_code is null or pairing_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  constraint tv_code_expiry check ((pairing_code is null) = (pairing_expires_at is null))
);
create index tv_displays_academy_idx on public.tv_displays(academy_id);
create trigger tv_displays_updated_at before update on public.tv_displays
  for each row execute function private.set_updated_at();
alter table public.tv_displays enable row level security;
revoke all on public.tv_displays from public, anon, authenticated;
grant select on public.tv_displays to authenticated;
create policy "tv: own display or academy staff" on public.tv_displays for select to authenticated
  using (display_user_id = (select auth.uid()) or (academy_id is not null and private.is_staff(academy_id)));

create function private.new_tv_code() returns text language sql volatile security definer set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (get_byte(extensions.gen_random_bytes(1), 0) % 31) + 1, 1), '')
  from generate_series(1, 6)
$$;
revoke all on function private.new_tv_code() from public, anon, authenticated;

create function public.server_now() returns timestamptz language sql volatile set search_path = '' as $$ select clock_timestamp() $$;
revoke all on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;

create function public.create_tv_pairing() returns public.tv_displays
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_row public.tv_displays; v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_row from public.tv_displays where display_user_id = v_uid for update;
  if v_row.academy_id is not null then return v_row; end if;
  for i in 1..10 loop
    v_code := private.new_tv_code();
    exit when not exists(select 1 from public.tv_displays where pairing_code = v_code);
  end loop;
  if exists(select 1 from public.tv_displays where pairing_code = v_code) then raise exception 'code_unavailable'; end if;
  insert into public.tv_displays(display_user_id, pairing_code, pairing_expires_at, last_seen_at)
    values(v_uid, v_code, clock_timestamp() + interval '10 minutes', clock_timestamp())
    on conflict(display_user_id) do update set pairing_code = excluded.pairing_code,
      pairing_expires_at = excluded.pairing_expires_at, last_seen_at = excluded.last_seen_at
    returning * into v_row;
  return v_row;
end $$;
revoke all on function public.create_tv_pairing() from public, anon;
grant execute on function public.create_tv_pairing() to authenticated;

create function public.pair_tv(p_code text, p_academy_id uuid, p_name text) returns public.tv_displays
language plpgsql security definer set search_path = '' as $$
declare v_row public.tv_displays;
begin
  if (select auth.uid()) is null or not private.is_staff(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'invalid_name'; end if;
  select * into v_row from public.tv_displays
    where pairing_code = upper(btrim(p_code)) for update;
  if not found or v_row.pairing_expires_at <= clock_timestamp() or v_row.academy_id is not null then
    raise exception 'invalid_or_expired_code' using errcode = '22023';
  end if;
  update public.tv_displays set academy_id = p_academy_id, name = btrim(p_name),
    pairing_code = null, pairing_expires_at = null, paired_by = auth.uid(), paired_at = clock_timestamp(),
    timer_state = null, state_version = state_version + 1 where id = v_row.id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.pair_tv(text, uuid, text) from public, anon;
grant execute on function public.pair_tv(text, uuid, text) to authenticated;

create function public.unpair_tv(p_display_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_academy_id uuid;
begin
  select academy_id into v_academy_id from public.tv_displays where id = p_display_id for update;
  if v_academy_id is null or not private.is_staff(v_academy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tv_displays set academy_id = null, name = 'TV', paired_by = null, paired_at = null,
    timer_state = null, state_version = state_version + 1 where id = p_display_id;
end $$;
revoke all on function public.unpair_tv(uuid) from public, anon;
grant execute on function public.unpair_tv(uuid) to authenticated;

create function public.update_tv_timer(p_display_id uuid, p_state jsonb, p_expected_version integer)
returns public.tv_displays language plpgsql security definer set search_path = '' as $$
declare v_row public.tv_displays;
begin
  select * into v_row from public.tv_displays where id = p_display_id for update;
  if v_row.academy_id is null or not private.is_staff(v_row.academy_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.state_version <> p_expected_version then raise exception 'stale_version' using errcode = '40001'; end if;
  if p_state is not null and (jsonb_typeof(p_state) <> 'object' or p_state->>'status' not in ('idle','running','paused','finished')) then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  update public.tv_displays set timer_state = p_state, state_version = state_version + 1
    where id = p_display_id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.update_tv_timer(uuid, jsonb, integer) from public, anon;
grant execute on function public.update_tv_timer(uuid, jsonb, integer) to authenticated;

create function public.tv_heartbeat() returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tv_displays set last_seen_at = clock_timestamp() where display_user_id = auth.uid();
end $$;
revoke all on function public.tv_heartbeat() from public, anon;
grant execute on function public.tv_heartbeat() to authenticated;

alter publication supabase_realtime add table public.tv_displays;

create function public.tv_academy_brand() returns table(name text, logo_path text)
language sql stable security definer set search_path = '' as $$
  select a.name, a.logo_path from public.tv_displays d
  join public.academies a on a.id = d.academy_id
  where d.display_user_id = (select auth.uid())
$$;
revoke all on function public.tv_academy_brand() from public, anon;
grant execute on function public.tv_academy_brand() to authenticated;
