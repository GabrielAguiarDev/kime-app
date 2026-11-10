-- The ranking snapshot copies name and photo once a day; follow profile
-- changes right away so a new photo shows in the ranking without waiting
-- for the next calculation. Scores are unchanged.

create function private.sync_ranking_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update public.ranking_snapshots set full_name=new.full_name, avatar_path=new.avatar_path
  where user_id=new.id;
 return null;
end; $$;
revoke all on function private.sync_ranking_profile() from public,anon,authenticated;

create trigger profiles_sync_ranking
after update of full_name, avatar_path on public.profiles
for each row when (old.full_name is distinct from new.full_name or old.avatar_path is distinct from new.avatar_path)
execute function private.sync_ranking_profile();

update public.ranking_snapshots r set full_name=p.full_name, avatar_path=p.avatar_path
from public.profiles p where p.id=r.user_id
 and (r.full_name is distinct from p.full_name or r.avatar_path is distinct from p.avatar_path);
