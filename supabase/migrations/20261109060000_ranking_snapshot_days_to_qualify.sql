-- "Em classificação" shows "faltam X dias" for every classmate, but
-- ranking_details is readable only by the student and staff. Copy the days
-- left onto the snapshot (readable by classmates) as the details are written.
-- The calculation is unchanged.

alter table public.ranking_snapshots add column days_to_qualify integer not null default 0;

create function private.copy_days_to_qualify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update public.ranking_snapshots set days_to_qualify=new.days_to_qualify
  where academy_id=new.academy_id and modality_id=new.modality_id and user_id=new.user_id;
 return null;
end; $$;
revoke all on function private.copy_days_to_qualify() from public,anon,authenticated;

create trigger ranking_details_copy_days_to_qualify
after insert or update of days_to_qualify on public.ranking_details
for each row execute function private.copy_days_to_qualify();

update public.ranking_snapshots r set days_to_qualify=d.days_to_qualify
from public.ranking_details d
where d.academy_id=r.academy_id and d.modality_id=r.modality_id and d.user_id=r.user_id;
