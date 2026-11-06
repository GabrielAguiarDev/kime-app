-- Check-ins are always visible to classmates of the same modality (user decision,
-- 2026-11-06): the "Mostrar meu check-in para colegas" opt-out is removed.
-- class_attendees keeps its access checks (staff, or a student enrolled in the
-- modality, today or later); only the per-profile filter goes away.
create or replace function public.class_attendees(p_schedule_id uuid, p_class_date date)
returns table(user_id uuid, full_name text, avatar_path text, status public.checkin_status, belt_primary text, belt_tip text)
language plpgsql stable security definer set search_path = '' as $$
declare v_schedule public.class_schedules%rowtype; v_staff boolean;
begin
 select * into v_schedule from public.class_schedules where id=p_schedule_id;
 if not found or p_class_date < private.academy_local_date(v_schedule.academy_id) then
   raise exception 'forbidden' using errcode='42501';
 end if;
 v_staff := private.is_staff(v_schedule.academy_id);
 if not v_staff and not private.is_enrolled_in_modality(v_schedule.modality_id) then
   raise exception 'forbidden' using errcode='42501';
 end if;
 return query
 select c.user_id,p.full_name,p.avatar_path,c.status,b.primary_color::text,b.tip_color::text
 from public.checkins c join public.profiles p on p.id=c.user_id
 left join lateral (select mb.primary_color,mb.tip_color from public.belt_history bh
   join public.memberships m on m.id=bh.membership_id
   join public.modality_belts mb on mb.id=bh.belt_id
   where m.user_id=c.user_id and bh.modality_id=v_schedule.modality_id
   order by bh.awarded_at desc limit 1) b on true
 where c.schedule_id=p_schedule_id and c.class_date=p_class_date
   and c.status in ('pending','confirmed')
 order by case when c.status='confirmed' then 0 else 1 end,p.full_name;
end; $$;
revoke all on function public.class_attendees(uuid,date) from public, anon;
grant execute on function public.class_attendees(uuid,date) to authenticated;

alter table public.profiles drop column show_checkins_to_peers;
