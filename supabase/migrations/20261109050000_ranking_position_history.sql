-- Daily history of ranking positions, for the trend arrow (up / down / same
-- vs the previous day's calculation). ranking_snapshots only keeps the latest
-- calculation (rebuild_rankings replaces it), so every time a position is
-- written there it is also recorded here under that calculation's period_to.
-- A same-day recalculation overwrites that day's row. The calculation itself
-- is unchanged.

create table public.ranking_position_history (
 academy_id uuid not null references public.academies(id) on delete cascade,
 modality_id uuid not null references public.academy_modalities(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 period_to date not null,
 position integer not null,
 primary key(academy_id,modality_id,period_to,user_id)
);
alter table public.ranking_position_history enable row level security;
grant select on public.ranking_position_history to authenticated;
create policy "ranking history: enrolled or staff reads" on public.ranking_position_history for select to authenticated
using (private.ranking_visible_user(user_id) and (private.is_staff(academy_id) or private.is_enrolled_in_modality(modality_id)));

create function private.record_ranking_position() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.position is null then
  -- Inserted unpositioned (positions come in a later update) or now qualifying.
  delete from public.ranking_position_history
   where academy_id=new.academy_id and modality_id=new.modality_id and user_id=new.user_id and period_to=new.period_to;
 else
  insert into public.ranking_position_history(academy_id,modality_id,user_id,period_to,position)
  values(new.academy_id,new.modality_id,new.user_id,new.period_to,new.position)
  on conflict(academy_id,modality_id,period_to,user_id) do update set position=excluded.position;
 end if;
 -- Only the last days are ever compared.
 delete from public.ranking_position_history
  where academy_id=new.academy_id and modality_id=new.modality_id and user_id=new.user_id and period_to<new.period_to-7;
 return null;
end; $$;
revoke all on function private.record_ranking_position() from public,anon,authenticated;

create trigger ranking_snapshots_record_position
after insert or update of position on public.ranking_snapshots
for each row execute function private.record_ranking_position();

-- Seed with the current calculation (the arrows start from the next one).
insert into public.ranking_position_history(academy_id,modality_id,user_id,period_to,position)
select academy_id,modality_id,user_id,period_to,position from public.ranking_snapshots where position is not null
on conflict do nothing;
