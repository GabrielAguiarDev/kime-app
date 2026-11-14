-- Disciplina: water goal met on every day of the week (7 of 7) from the week
-- of 2026-11-09 on. Earlier weeks keep the old rule (5 of 7), so recomputing
-- the history does not break streaks already earned.

do $$
declare v_def text := pg_get_functiondef('private.refresh_discipline(uuid, date)'::regprocedure);
begin
  v_def := replace(v_def,
    'v_done := v_w.classes >= 1 and v_w.water_days >= 5;',
    'v_done := v_w.classes >= 1 and v_w.water_days >= (case when v_w.ws >= date ''2026-11-09'' then 7 else 5 end);');
  if v_def not like '%date ''2026-11-09''%' then raise exception 'refresh_discipline: water rule not found'; end if;
  execute v_def;
end $$;
revoke all on function private.refresh_discipline(uuid, date) from public, anon, authenticated;
