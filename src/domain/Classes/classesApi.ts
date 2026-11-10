import { supabase, type TablesInsert } from '@infra/supabase';

import type { CheckinStatus, ScheduleInput, Weekday } from './classesTypes';

const SCHEDULE_COLUMNS = 'id, academy_id, weekday, start_time, modality_id, active, instructor_id, modality:academy_modalities(name)';
const CHECKIN_COLUMNS = 'id, user_id, schedule_id, modality_id, class_date, status, reviewed_at';

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
    modality_id: input.modalityId,
  });
  if (error) throw error;
}

async function updateSchedule(id: string, input: ScheduleInput) {
  const { error } = await supabase
    .from('class_schedules')
    .update({ weekday: input.weekday, start_time: input.startTime, modality_id: input.modalityId })
    .eq('id', id);
  if (error) throw error;
}

async function createSchedules(academyId: string, rows: ScheduleInput[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from('class_schedules').insert(
    rows.map((r) => ({ academy_id: academyId, weekday: r.weekday, start_time: r.startTime, modality_id: r.modalityId })),
  );
  if (error) throw error;
}

async function updateSchedules(
  ids: string[],
  patch: { active?: boolean; start_time?: string; modality_id?: string },
) {
  if (ids.length === 0) return;
  const { error } = await supabase.from('class_schedules').update(patch).in('id', ids);
  if (error) throw error;
}

/** Sets who gives the class on every active row of a group (time + modality). */
async function setGroupInstructor(academyId: string, startTime: string, modalityId: string, instructorId: string | null) {
  const { error } = await supabase
    .from('class_schedules')
    .update({ instructor_id: instructorId })
    .eq('academy_id', academyId)
    .eq('start_time', startTime)
    .eq('modality_id', modalityId)
    .eq('active', true);
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
    .select('id, name, position, uses_belts')
    .eq('academy_id', academyId)
    .order('position');
  if (error) throw error;
  return data;
}

async function createModality(academyId: string, name: string, position: number, usesBelts: boolean) {
  const { error } = await supabase
    .from('academy_modalities')
    .insert({ academy_id: academyId, name, position, uses_belts: usesBelts });
  if (error) throw error;
}

async function updateModality(id: string, patch: { name: string; uses_belts: boolean }) {
  const { error } = await supabase.from('academy_modalities').update(patch).eq('id', id);
  if (error) throw error;
}


async function deleteModality(id: string) {
  const { error } = await supabase.from('academy_modalities').delete().eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------- modality belts ---
const BELT_COLUMNS = 'id, modality_id, primary_color, tip_color, position, classes_required';

/** Every belt of the academy, every modality (ordered per modality). */
async function listBelts(academyId: string) {
  const { data, error } = await supabase
    .from('modality_belts')
    .select(BELT_COLUMNS)
    .eq('academy_id', academyId)
    .order('modality_id')
    .order('position');
  if (error) throw error;
  return data;
}

async function createBelt(
  academyId: string,
  modalityId: string,
  input: { primary: string; tip: string | null; classesRequired: number | null },
  position: number,
) {
  const { error } = await supabase.from('modality_belts').insert({
    academy_id: academyId,
    modality_id: modalityId,
    primary_color: input.primary,
    tip_color: input.tip,
    classes_required: input.classesRequired,
    position,
  });
  if (error) throw error;
}

async function updateBelt(id: string, input: { primary: string; tip: string | null; classesRequired: number | null }) {
  const { error } = await supabase
    .from('modality_belts')
    .update({ primary_color: input.primary, tip_color: input.tip, classes_required: input.classesRequired })
    .eq('id', id);
  if (error) throw error;
}

async function deleteBelt(id: string) {
  const { error } = await supabase.from('modality_belts').delete().eq('id', id);
  if (error) throw error;
}

async function reorderBelts(modalityId: string, orderedIds: string[]) {
  const { error } = await supabase.rpc('reorder_modality_belts', { p_modality_id: modalityId, p_belt_ids: orderedIds });
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
    .select(`${CHECKIN_COLUMNS}, profile:profiles!checkins_user_id_fkey(full_name, avatar_path)`)
    .eq('academy_id', academyId)
    .eq('class_date', date)
    .order('created_at');
  if (error) throw error;
  return data;
}

/** Staff: check-ins of the academy between two dates (week summary). */
async function listCheckinsBetween(academyId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('checkins')
    .select(`${CHECKIN_COLUMNS}, profile:profiles!checkins_user_id_fkey(full_name, avatar_path)`)
    .eq('academy_id', academyId)
    .gte('class_date', from)
    .lte('class_date', to);
  if (error) throw error;
  return data;
}

/** Staff: an attendance already confirmed, for a student who forgot the check-in (RLS: staff, own academy). */
async function markAttendance(academyId: string, scheduleId: string, date: string, userId: string, markedBy: string) {
  const { error } = await supabase.from('checkins').insert({
    academy_id: academyId,
    schedule_id: scheduleId,
    class_date: date,
    user_id: userId,
    status: 'confirmed',
    marked_by: markedBy,
  });
  if (error) throw error;
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
/** Students only (owners and instructors have no class count). */
async function listMemberStats(academyId: string) {
  const { data, error } = await supabase
    .from('membership_class_stats')
    .select('membership_id, user_id, confirmed_total')
    .eq('academy_id', academyId);
  if (error) throw error;
  return data;
}

async function listModalityStats(academyId: string) {
  const { data, error } = await supabase
    .from('modality_class_stats')
    .select('membership_id, user_id, modality_id, belt_id, belt_awarded_at, confirmed_total, confirmed_since_belt')
    .eq('academy_id', academyId);
  if (error) throw error;
  return data;
}

async function listBeltHistory(membershipId: string) {
  const { data, error } = await supabase
    .from('belt_history')
    .select('id, modality_id, belt_id, awarded_at, belt:modality_belts!belt_history_belt_fkey(primary_color, tip_color)')
    .eq('membership_id', membershipId)
    .order('awarded_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Training report of a student: the student themself or staff (RPC class_report). */
async function getClassReport(academyId: string, userId: string) {
  const { data, error } = await supabase.rpc('class_report', { p_academy_id: academyId, p_user_id: userId });
  if (error) throw error;
  return data;
}

async function awardBelt(membershipId: string, beltId: string) {
  // modality_id is set by a trigger from the belt (the client has no grant on it).
  const row = { membership_id: membershipId, belt_id: beltId } as TablesInsert<'belt_history'>;
  const { error } = await supabase.from('belt_history').insert(row);
  if (error) throw error;
}

// --------------------------------------------------------------- sessions ---
/** Staff: classes given on a date (one per schedule), with their instructor. */
async function listSessionsOn(academyId: string, date: string) {
  const { data, error } = await supabase
    .from('class_sessions')
    .select('id, schedule_id, class_date, instructor_id')
    .eq('academy_id', academyId)
    .eq('class_date', date);
  if (error) throw error;
  return data;
}

async function setSessionInstructor(sessionId: string, instructorId: string) {
  const { data, error } = await supabase
    .from('class_sessions')
    .update({ instructor_id: instructorId })
    .eq('id', sessionId)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function listSessionsBetween(academyId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('class_sessions')
    .select('id, schedule_id, class_date, instructor_id')
    .eq('academy_id', academyId)
    .gte('class_date', from)
    .lte('class_date', to);
  if (error) throw error;
  return data;
}

async function listInstructorStats(academyId: string) {
  const { data, error } = await supabase
    .from('instructor_class_stats')
    .select('membership_id, user_id, classes_taught')
    .eq('academy_id', academyId);
  if (error) throw error;
  return data;
}

export const classesApi = {
  listSessionsOn,
  setSessionInstructor,
  listInstructorStats,
  listSessionsBetween,
  academyToday,
  listSchedules,
  createSchedule,
  createSchedules,
  updateSchedule,
  updateSchedules,
  setGroupInstructor,
  setScheduleActive,
  deleteSchedules,
  listModalities,
  createModality,
  updateModality,
  deleteModality,
  listBelts,
  createBelt,
  updateBelt,
  deleteBelt,
  reorderBelts,
  listMyCheckins,
  listCheckinsOn,
  listCheckinsBetween,
  markAttendance,
  createCheckin,
  cancelCheckin,
  decideCheckin,
  confirmAll,
  listMemberStats,
  listModalityStats,
  listBeltHistory,
  getClassReport,
  awardBelt,
};

export type ScheduleRowApi = Awaited<ReturnType<typeof listSchedules>>[number];
export type CheckinRowApi = Awaited<ReturnType<typeof listMyCheckins>>[number];
export type AcademyCheckinRowApi = Awaited<ReturnType<typeof listCheckinsOn>>[number];
export type BeltRowApi = Awaited<ReturnType<typeof listBelts>>[number];
export type ModalityStatsRowApi = Awaited<ReturnType<typeof listModalityStats>>[number];
export type MemberStatsRowApi = Awaited<ReturnType<typeof listMemberStats>>[number];
export type ModalityRowApi = Awaited<ReturnType<typeof listModalities>>[number];
export type BeltAwardRowApi = Awaited<ReturnType<typeof listBeltHistory>>[number];
export type { Weekday };
