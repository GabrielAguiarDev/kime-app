-- =============================================================================
-- Kimi — Belts as color keys, with an optional tip
--
-- modality_belts.primary_color / tip_color: keys of the design-system palette
-- (2.4): white, gray, yellow, orange, green, blue, purple, brown, black, red.
-- The name and the displayed colors are DERIVED in the app ("Vermelha",
-- "Vermelha/ponta preta"); the free `name` and hex `color` columns are gone.
-- One combination per modality (primary + tip).
--
-- classes_required becomes optional: the first belt of a sequence is the entry
-- belt and needs no classes ("classes in the previous belt to receive this
-- one" — the same meaning as before for every other belt).
--
-- Existing belts: each hex color becomes the nearest palette key not yet used
-- in that modality (in belt order), without a tip.
-- =============================================================================

create function private.is_belt_color(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_key in ('white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black', 'red');
$$;

revoke all on function private.is_belt_color(text) from public, anon;
grant execute on function private.is_belt_color(text) to authenticated;

alter table public.modality_belts
  add column primary_color text,
  add column tip_color text;

-- Nearest free key per belt (squared RGB distance to the palette hex).
do $$
declare
  b record;
  v_key text;
begin
  create temp table belt_palette_rgb (key text primary key, r int, g int, b int) on commit drop;
  insert into belt_palette_rgb values
    ('white', 242, 242, 242), ('gray', 142, 145, 150), ('yellow', 242, 196, 24), ('orange', 240, 122, 26),
    ('green', 46, 158, 79), ('blue', 31, 95, 209), ('purple', 110, 63, 201), ('brown', 122, 74, 42),
    ('black', 21, 21, 21), ('red', 200, 36, 47);

  for b in select id, modality_id, color from public.modality_belts order by modality_id, position loop
    select p.key into v_key
    from belt_palette_rgb p
    where not exists (
      select 1 from public.modality_belts o
      where o.modality_id = b.modality_id and o.primary_color = p.key and o.tip_color is null
    )
    order by
      power(p.r - ('x' || substr(b.color, 2, 2))::bit(8)::int, 2)
      + power(p.g - ('x' || substr(b.color, 4, 2))::bit(8)::int, 2)
      + power(p.b - ('x' || substr(b.color, 6, 2))::bit(8)::int, 2)
    limit 1;
    if v_key is null then
      raise exception 'belt migration: modality % has more belts than palette colors', b.modality_id;
    end if;
    update public.modality_belts set primary_color = v_key where id = b.id;
  end loop;
end;
$$;

alter table public.modality_belts
  alter column primary_color set not null,
  add constraint modality_belts_primary_color_check check (private.is_belt_color(primary_color)),
  add constraint modality_belts_tip_color_check
    check (tip_color is null or (private.is_belt_color(tip_color) and tip_color <> primary_color));

-- Same combination once per modality (no tip = '').
create unique index modality_belts_combination_idx
  on public.modality_belts (modality_id, primary_color, coalesce(tip_color, ''));

-- Free name / hex color are derived now.
drop trigger modality_belts_normalize on public.modality_belts;
drop function private.normalize_modality_belt();
drop index public.modality_belts_name_idx;
alter table public.modality_belts drop column name, drop column color;

-- Entry belt: no classes needed (the first of each sequence loses its number).
alter table public.modality_belts alter column classes_required drop not null;
update public.modality_belts set classes_required = null where position = 0;

-- Column grants follow the new columns (dropped columns lost theirs).
revoke insert, update on public.modality_belts from authenticated;
grant insert (academy_id, modality_id, primary_color, tip_color, position, classes_required)
  on public.modality_belts to authenticated;
grant update (primary_color, tip_color, position, classes_required) on public.modality_belts to authenticated;
