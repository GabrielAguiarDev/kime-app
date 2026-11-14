-- =============================================================================
-- Kimi — Academy announcements ("Avisos", user request, 2026-11-12)
--
-- Short notices of the academy ("Sem aula no feriado"). Decisions of the user:
--   * owner and instructors publish; the author edits and deletes their own
--     notice, the owner deletes any;
--   * audience: everyone (modality_id null) or the students of one modality;
--   * pinned notices come first;
--   * optional last day (expires_on, academy calendar, inclusive): students
--     stop seeing it after that day, staff keep seeing it;
--   * a student blocked for an overdue fee STILL sees the notices (so the
--     helpers here never go through private.is_finance_blocked).
--
-- public.academy_announcements_feed(academy): the notices the caller sees,
-- with the author's name and photo (students cannot read staff profiles
-- directly). SECURITY INVOKER over the table: its RLS decides what comes back.
-- =============================================================================

create table public.academy_announcements (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  -- Null = every member; else only the students linked to that modality.
  modality_id uuid,
  pinned boolean not null default false,
  -- Last day it is shown to students (academy calendar); null = no end.
  expires_on date,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (modality_id, academy_id)
    references public.academy_modalities (id, academy_id) on delete cascade
);
create index academy_announcements_academy_idx on public.academy_announcements (academy_id, created_at desc);
create index academy_announcements_modality_idx on public.academy_announcements (modality_id, academy_id);
create index academy_announcements_created_by_idx on public.academy_announcements (created_by);

create trigger academy_announcements_set_updated_at
  before update on public.academy_announcements
  for each row execute function private.set_updated_at();

-- Keep the author and the academy; a new or changed last day cannot be in the past.
create function private.guard_academy_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
    new.academy_id := old.academy_id;
    new.created_at := old.created_at;
  end if;
  if new.expires_on is not null
     and (tg_op = 'INSERT' or new.expires_on is distinct from old.expires_on)
     and new.expires_on < private.academy_local_date(new.academy_id) then
    raise exception 'announcement_expires_in_past' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger academy_announcements_guard
  before insert or update on public.academy_announcements
  for each row execute function private.guard_academy_announcement();

-- The caller is an active student linked to the modality. Unlike
-- private.is_enrolled_in_modality, a fee block does NOT hide notices.
create function private.is_linked_to_modality(p_modality_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_modality_enrollments e
    join public.memberships m on m.id = e.membership_id
    where e.modality_id = p_modality_id
      and e.status = 'active'
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'student'
  );
$$;
revoke all on function private.is_linked_to_modality(uuid) from public, anon;
grant execute on function private.is_linked_to_modality(uuid) to authenticated;

alter table public.academy_announcements enable row level security;

create policy "academy_announcements: staff or audience reads"
  on public.academy_announcements for select to authenticated
  using (
    private.is_staff(academy_id)
    or (
      private.is_student(academy_id)
      and (expires_on is null or expires_on >= private.academy_local_date(academy_id))
      and (modality_id is null or private.is_linked_to_modality(modality_id))
    )
  );

create policy "academy_announcements: staff creates"
  on public.academy_announcements for insert to authenticated
  with check (private.is_staff(academy_id));

create policy "academy_announcements: author edits"
  on public.academy_announcements for update to authenticated
  using (private.is_staff(academy_id) and created_by = (select auth.uid()))
  with check (private.is_staff(academy_id) and created_by = (select auth.uid()));

create policy "academy_announcements: author or owner deletes"
  on public.academy_announcements for delete to authenticated
  using (private.is_staff(academy_id) and (created_by = (select auth.uid()) or private.is_owner(academy_id)));

grant select, delete on public.academy_announcements to authenticated;
grant insert (academy_id, body, modality_id, pinned, expires_on) on public.academy_announcements to authenticated;
grant update (body, modality_id, pinned, expires_on) on public.academy_announcements to authenticated;

-- Name and photo of an announcement's author, for someone who sees it.
create function private.announcement_author(p_announcement_id uuid)
returns table (full_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.avatar_path
  from public.academy_announcements an
  join public.profiles p on p.id = an.created_by
  where an.id = p_announcement_id
    and (
      private.is_staff(an.academy_id)
      or (
        private.is_student(an.academy_id)
        and (an.expires_on is null or an.expires_on >= private.academy_local_date(an.academy_id))
        and (an.modality_id is null or private.is_linked_to_modality(an.modality_id))
      )
    );
$$;
revoke all on function private.announcement_author(uuid) from public, anon;
grant execute on function private.announcement_author(uuid) to authenticated;

-- The notices the caller sees in the academy: pinned first, newest first.
create function public.academy_announcements_feed(p_academy_id uuid)
returns table (
  id uuid,
  academy_id uuid,
  body text,
  modality_id uuid,
  pinned boolean,
  expires_on date,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  author_avatar_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select an.id, an.academy_id, an.body, an.modality_id, an.pinned, an.expires_on,
         an.created_by, an.created_at, an.updated_at, au.full_name, au.avatar_path
  from public.academy_announcements an
  left join lateral private.announcement_author(an.id) au on true
  where an.academy_id = p_academy_id
  order by an.pinned desc, an.created_at desc;
$$;
revoke all on function public.academy_announcements_feed(uuid) from public, anon;
grant execute on function public.academy_announcements_feed(uuid) to authenticated;
