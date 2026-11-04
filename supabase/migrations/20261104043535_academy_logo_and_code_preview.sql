-- =============================================================================
-- Kimi — Academy logo + preview before joining
--
-- Logos live in the PUBLIC Storage bucket `academy-logos` (user decision:
-- a logo is branding, meant to be seen — including by a student who typed
-- the invite code and is not a member yet). Public means anyone with the URL
-- can read the image; paths are `<academy_id>/<random>.<ext>`, nothing is
-- listable. Only professors of the academy write, replace or delete.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Column
-- -----------------------------------------------------------------------------
alter table public.academies
  add column logo_path text
    check (
      logo_path is null
      or (logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' and split_part(logo_path, '/', 1) = id::text)
    );

-- Professors set it through the existing "academies: professor updates" policy.
grant update (logo_path) on public.academies to authenticated;

-- -----------------------------------------------------------------------------
-- Bucket (2 MB, images only)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-logos', 'academy-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- First folder of an object path as the academy id; null when it is not a uuid.
create function private.academy_id_from_storage_path(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.academy_id_from_storage_path(text) to authenticated;

-- Reads go through the public URL (no policy needed). These policies cover the
-- API operations: upload (insert), replace (update) and remove (select + delete).
create policy "academy-logos: professor reads own academy objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'academy-logos' and private.is_professor(private.academy_id_from_storage_path(name)));

create policy "academy-logos: professor uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'academy-logos' and private.is_professor(private.academy_id_from_storage_path(name)));

create policy "academy-logos: professor replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'academy-logos' and private.is_professor(private.academy_id_from_storage_path(name)))
  with check (bucket_id = 'academy-logos' and private.is_professor(private.academy_id_from_storage_path(name)));

create policy "academy-logos: professor deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'academy-logos' and private.is_professor(private.academy_id_from_storage_path(name)));

-- -----------------------------------------------------------------------------
-- Previews (name + logo) before joining
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: the student is not a member yet, so RLS hides the academy
-- whose code they typed. Returns only the name and logo path for a valid code.
-- Authenticated callers only.
create function public.get_academy_preview_by_code(p_invite_code text)
returns table (academy_name text, logo_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return query
    select a.name, a.logo_path
    from public.academies a
    where a.invite_code = upper(btrim(coalesce(p_invite_code, '')));
end;
$$;

-- The link preview also carries the logo (return type changes: recreate).
drop function public.get_invite_preview(text);

-- SECURITY DEFINER: the invitee cannot read the academy yet. Reveals only the
-- name, logo path and invite role for a valid, unguessable token.
create function public.get_invite_preview(p_token text)
returns table (academy_name text, role public.membership_role, logo_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return query
    select a.name, i.role, a.logo_path
    from public.academy_invites i
    join public.academies a on a.id = i.academy_id
    where i.token = p_token and i.revoked_at is null;
end;
$$;

revoke all on function
  public.get_academy_preview_by_code(text),
  public.get_invite_preview(text)
from public, anon;

grant execute on function
  public.get_academy_preview_by_code(text),
  public.get_invite_preview(text)
to authenticated;
