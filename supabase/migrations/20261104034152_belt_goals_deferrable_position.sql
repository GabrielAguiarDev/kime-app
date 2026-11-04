-- =============================================================================
-- Kimi — belt_goals position checked at commit
-- Reordering belts swaps positions (A: 1→2, B: 2→1). With an immediate unique
-- constraint the first update collides; deferred to the end of the
-- transaction, a reorder sent in one request (or one RPC) goes through.
-- =============================================================================

alter table public.belt_goals drop constraint belt_goals_academy_id_position_key;

alter table public.belt_goals
  add constraint belt_goals_academy_id_position_key
  unique (academy_id, position) deferrable initially deferred;

-- SECURITY INVOKER: plain RLS (professor-only update on belt_goals).
-- Rewrites the order of the academy's belts in one transaction.
create function public.reorder_belt_goals(p_academy_id uuid, p_goal_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.belt_goals where academy_id = p_academy_id)
     <> coalesce(array_length(p_goal_ids, 1), 0) then
    raise exception 'belt_order_incomplete' using errcode = '22023';
  end if;

  update public.belt_goals g
  set position = o.ordinality - 1
  from unnest(p_goal_ids) with ordinality as o (id, ordinality)
  where g.id = o.id and g.academy_id = p_academy_id;
end;
$$;

revoke all on function public.reorder_belt_goals(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_belt_goals(uuid, uuid[]) to authenticated;
