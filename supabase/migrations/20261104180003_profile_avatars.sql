-- =============================================================================
-- Kimi — Profile photos
-- PRIVATE bucket `avatars`, one folder per user: `<user_id>/avatar-<ts>.jpg`
-- (a new file on every change, the old one is deleted by the app).
--   write (insert / update / delete): only inside the user's own folder
--   read: the user, plus the owner and instructors of academies where the user
--         has a membership (private.is_staff_of_member: the same rule that
--         lets staff read the profile). The app reads through signed URLs.
-- The app crops to a square, resizes to 512×512 and compresses (JPEG) first.
-- =============================================================================

alter table public.profiles
  add column avatar_path text
    check (
      avatar_path is null
      or (avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' and split_part(avatar_path, '/', 1) = id::text)
    );

grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- First folder of a storage path as a uuid (null when it is not one).
create function private.storage_folder_uuid(p_name text)
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

revoke all on function private.storage_folder_uuid(text) from public, anon;
grant execute on function private.storage_folder_uuid(text) to authenticated;

create policy "avatars: own or staff of the member reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      private.storage_folder_uuid(name) = (select auth.uid())
      or private.is_staff_of_member(private.storage_folder_uuid(name))
    )
  );

create policy "avatars: user uploads own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and private.storage_folder_uuid(name) = (select auth.uid()));

create policy "avatars: user replaces own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and private.storage_folder_uuid(name) = (select auth.uid()))
  with check (bucket_id = 'avatars' and private.storage_folder_uuid(name) = (select auth.uid()));

create policy "avatars: user deletes own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and private.storage_folder_uuid(name) = (select auth.uid()));
