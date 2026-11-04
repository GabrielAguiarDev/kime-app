import { supabase } from '@infra/supabase';

import type { CheckinStatus, ScheduleInput, Weekday } from './classesTypes';

const SCHEDULE_COLUMNS = 'id, academy_id, weekday, start_time, modality, active';
const CHECKIN_COLUMNS = 'id, user_id, schedule_id, class_date, status, reviewed_at';

async function academyToday(academyId: string) {
  const { data, error } = await supabase.rpc('academy_today', { p_academy_id: academyId });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------ schedules ---
async function listSchedules(academyId: string) {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('academy_id', academyId)
    .order('weekday')
    .order('start_time');
  if (error) throw error;
  return data;
}

async function createSchedule(academyId: string, input: ScheduleInput) {
  const { error } = await supabase.from('class_schedules').insert({
    academy_id: academyId,
    weekday: input.weekday,
    start_time: input.startTime,
    modality: input.modality,
  });
  if (error) throw error;
}

async function updateSchedule(id: string, input: ScheduleInput) {
  const { error } = await supabase
    .from('class_schedules')
    .update({ weekday: input.weekday, start_time: input.startTime, modality: input.modality })
    .eq('id', id);
  if (error) throw error;
}

async function createSchedules(academyId: string, rows: ScheduleInput[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from('class_schedules').insert(
    rows.map((r) => ({ academy_id: academyId, weekday: r.weekday, start_time: r.startTime, modality: r.modality })),
  );
  if (error) throw error;
}

async function updateSchedules(
  ids: string[],
  patch: { active?: boolean; start_time?: string; modality?: string },
) {
  if (ids.length === 0) return;
  const { error } = await supabase.from('class_schedules').update(patch).in('id', ids);
  if (error) throw error;
}

async function setScheduleActive(id: string, active: boolean) {
  const { error } = await supabase.from('class_schedules').update({ active }).eq('id', id);
  if (error) throw error;
}

async function deleteSchedules(ids: string[]) {
  if (ids.length === 0) return;
  // Check-ins survive: their schedule link is set to null by the database.
  const { error } = await supabase.from('class_schedules').delete().in('id', ids);
  if (error) throw error;
}

// ----------------------------------------------------------- modalities ---
async function listModalities(academyId: string) {
  const { data, error } = await supabase
    .from('academy_modalities')
    .select('id, name, position')
    .eq('academy_id', academyId)
    .order('position');
  if (error) throw error;
  return data;
}

async function createModality(academyId: string, name: string, position: number) {
  const { error } = await supabase.from('academy_modalities').insert({ academy_id: academyId, name, position });
  // 23505: the academy already has it (case-insensitive) — that is fine.
  if (error && error.code !== '23505') throw error;
}

async function renameModality(id: string, name: string) {
  const { error } = await supabase.from('academy_modalities').update({ name }).eq('id', id);
  if (error) throw error;
}

async function deleteModality(id: string) {
  const { error } = await supabase.from('academy_modalities').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------------------------------------------- belt goals ---
async function listBeltGoals(academyId: string) {
  const { data, error } = await supabase
    .from('belt_goals')
    .select('id, belt, position, classes_required')
    .eq('academy_id', academyId)
    .order('position');
  if (error) throw error;
  return data;
}

async function createBeltGoal(academyId: string, belt: string, position: number, classesRequired: number) {
  const { error } = await supabase
    .from('belt_goals')
    .insert({ academy_id: academyId, belt, position, classes_required: classesRequired });
  if (error) throw error;
}

async function updateBeltGoal(id: string, classesRequired: number) {
  const { error } = await supabase.from('belt_goals').update({ classes_required: classesRequired }).eq('id', id);
  if (error) throw error;
}

async function deleteBeltGoal(id: string) {
  const { error } = await supabase.from('belt_goals').delete().eq('id', id);
  if (error) throw error;
}

async function reorderBeltGoals(academyId: string, orderedIds: string[]) {
  const { error } = await supabase.rpc('reorder_belt_goals', { p_academy_id: academyId, p_goal_ids: orderedIds });
  if (error) throw error;
}

// ------------------------------------------------------------- check-ins ---
/** Every check-in of the signed-in user in the academy (RLS: own rows). */
async function listMyCheckins(academyId: string, userId: string) {
  const { data, error } = await supabase
    .from('checkins')
    .select(CHECKIN_COLUMNS)
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .order('class_date', { ascending: false });
  if (error) throw error;
  return data;
}

/** Professor: check-ins of the academy on a date, with the student's name. */
async function listCheckinsOn(academyId: string, date: string) {
  const { data, error } = await supabase
    .from('checkins')
    .select(`${CHECKIN_COLUMNS}, profile:profiles!checkins_user_id_fkey(full_name)`)
    .eq('academy_id', academyId)
    .eq('class_date', date)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function createCheckin(academyId: string, userId: string, scheduleId: string, date: string) {
  const { error } = await supabase
    .from('checkins')
    .insert({ academy_id: academyId, user_id: userId, schedule_id: scheduleId, class_date: date });
  if (error) throw error;
}

async function cancelCheckin(id: string) {
  const { error } = await supabase.from('checkins').delete().eq('id', id).eq('status', 'pending');
  if (error) throw error;
}

async function decideCheckin(id: string, status: Exclude<CheckinStatus, 'pending'>) {
  const { data, error } = await supabase.from('checkins').update({ status }).eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

/** Professor: confirm every pending check-in of one class on a date. */
async function confirmAll(scheduleId: string, date: string) {
  const { error } = await supabase
    .from('checkins')
    .update({ status: 'confirmed' })
    .eq('schedule_id', scheduleId)
    .eq('class_date', date)
    .eq('status', 'pending');
  if (error) throw error;
}

// ---------------------------------------------------------- stats / belts ---
async function listMemberStats(academyId: string) {
  const { data, error } = await supabase
    .from('membership_class_stats')
    .select('membership_id, user_id, belt, belt_awarded_at, confirmed_total, confirmed_since_belt')
    .eq('academy_id', academyId);
  if (error) throw error;
  return data;
}

async function listBeltHistory(membershipId: string) {
  const { data, error } = await supabase
    .from('belt_history')
    .select('id, belt, awarded_at')
    .eq('membership_id', membershipId)
    .order('awarded_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function awardBelt(membershipId: string, belt: string) {
  const { error } = await supabase.from('belt_history').insert({ membership_id: membershipId, belt });
  if (error) throw error;
}

export const classesApi = {
  academyToday,
  listSchedules,
  createSchedule,
  createSchedules,
  updateSchedule,
  updateSchedules,
  setScheduleActive,
  deleteSchedules,
  listModalities,
  createModality,
  renameModality,
  deleteModality,
  listBeltGoals,
  createBeltGoal,
  updateBeltGoal,
  deleteBeltGoal,
  reorderBeltGoals,
  listMyCheckins,
  listCheckinsOn,
  createCheckin,
  cancelCheckin,
  decideCheckin,
  confirmAll,
  listMemberStats,
  listBeltHistory,
  awardBelt,
};

export type ScheduleRowApi = Awaited<ReturnType<typeof listSchedules>>[number];
export type CheckinRowApi = Awaited<ReturnType<typeof listMyCheckins>>[number];
export type AcademyCheckinRowApi = Awaited<ReturnType<typeof listCheckinsOn>>[number];
export type BeltGoalRowApi = Awaited<ReturnType<typeof listBeltGoals>>[number];
export type MemberStatsRowApi = Awaited<ReturnType<typeof listMemberStats>>[number];
export type ModalityRowApi = Awaited<ReturnType<typeof listModalities>>[number];
export type BeltAwardRowApi = Awaited<ReturnType<typeof listBeltHistory>>[number];
export type { Weekday };
