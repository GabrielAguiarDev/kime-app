-- =============================================================================
-- Kimi — Academy ranking (backlog)
--
-- Monthly ranking of an academy's active students by CONFIRMED classes only,
-- overall or per modality, plus the champions of past months. Visible to
-- every active member of the academy (students and staff).
--
-- profiles.show_in_ranking: the user's choice (Perfil). Off = out of the
-- ranking and of the champions history, in every academy.
--
-- Profile photos (private bucket): a classmate shown in the ranking can see
-- the photo; before, only the user and staff could.
-- =============================================================================

alter table public.profiles add column show_in_ranking boolean not null default true;
grant select (show_in_ranking), update (show_in_ranking) on public.profiles to authenticated;

-- Caller and the user are active members of a same academy, the user is a
-- student there and shows in the ranking.
create function private.is_ranked_classmate(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.academy_id = viewer.academy_id
    join public.profiles p on p.id = target.user_id
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and target.user_id = p_user_id
      and target.status = 'active'
      and target.role = 'student'
      and p.show_in_ranking
  );
$$;
revoke all on function private.is_ranked_classmate(uuid) from public, anon;
grant execute on function private.is_ranked_classmate(uuid) to authenticated;

drop policy "avatars: own or staff of the member reads" on storage.objects;
create policy "avatars: own, staff of the member or ranked classmate reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      private.storage_folder_uuid(name) = (select auth.uid())
      or private.is_staff_of_member(private.storage_folder_uuid(name))
      or private.is_ranked_classmate(private.storage_folder_uuid(name))
    )
  );

-- Ranking of the month that contains p_month (academy calendar). Ties share the
-- position (rank). Students with no confirmed class that month are not listed.
create function public.academy_ranking(p_academy_id uuid, p_month date, p_modality_id uuid default null)
returns table (
  "position" integer,
  user_id uuid,
  full_name text,
  avatar_path text,
  classes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  if not private.is_member(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select (rank() over (order by count(c.id) desc))::integer,
           m.user_id, p.full_name, p.avatar_path, count(c.id)::integer
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join public.checkins c
      on c.user_id = m.user_id
     and c.academy_id = m.academy_id
     and c.status = 'confirmed'
     and c.class_date >= v_from and c.class_date < v_to
     and (p_modality_id is null or c.modality_id = p_modality_id)
    where m.academy_id = p_academy_id
      and m.status = 'active'
      and m.role = 'student'
      and p.show_in_ranking
    group by m.user_id, p.full_name, p.avatar_path
    order by 5 desc, 3;
end;
$$;

-- Champions (position 1, ties included) of every finished month, newest first.
create function public.academy_ranking_champions(p_academy_id uuid, p_modality_id uuid default null)
returns table (
  month date,
  user_id uuid,
  full_name text,
  avatar_path text,
  classes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current date := date_trunc('month', private.academy_local_date(p_academy_id))::date;
begin
  if not private.is_member(p_academy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    with monthly as (
      select date_trunc('month', c.class_date)::date as month,
             m.user_id, p.full_name, p.avatar_path, count(*)::integer as classes
      from public.memberships m
      join public.profiles p on p.id = m.user_id
      join public.checkins c
        on c.user_id = m.user_id
       and c.academy_id = m.academy_id
       and c.status = 'confirmed'
       and c.class_date < v_current
       and (p_modality_id is null or c.modality_id = p_modality_id)
      where m.academy_id = p_academy_id
        and m.status = 'active'
        and m.role = 'student'
        and p.show_in_ranking
      group by 1, 2, 3, 4
    ),
    ranked as (
      select monthly.*, rank() over (partition by monthly.month order by monthly.classes desc) as pos
      from monthly
    )
    select r.month, r.user_id, r.full_name, r.avatar_path, r.classes
    from ranked r
    where r.pos = 1
    order by r.month desc, r.full_name;
end;
$$;

revoke all on function
  public.academy_ranking(uuid, date, uuid),
  public.academy_ranking_champions(uuid, uuid)
from public, anon;
grant execute on function
  public.academy_ranking(uuid, date, uuid),
  public.academy_ranking_champions(uuid, uuid)
to authenticated;
