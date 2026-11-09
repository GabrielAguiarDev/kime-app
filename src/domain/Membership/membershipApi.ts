import { supabase } from '@infra/supabase';

const ENROLLMENTS =
  'student_modality_enrollments(id, modality_id, status, started_at, weekly_class_goal, is_competitor, competitor_invited_at, competitor_since)';

async function listMine(userId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select(`id, academy_id, role, status, is_competitor, competitor_invited_at, competitor_since, decided_at, academies(name, logo_path), ${ENROLLMENTS}`)
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function listByGym(gymId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select(`id, user_id, role, status, is_competitor, competitor_invited_at, competitor_since, created_at, profile:profiles!memberships_user_id_fkey(full_name, avatar_path), ${ENROLLMENTS}`)
    .eq('academy_id', gymId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function listPending(gymId: string) {
  const { data, error } = await supabase.rpc('list_pending_requests', { p_academy_id: gymId });
  if (error) throw error;
  return data;
}

async function remove(membershipId: string) {
  // RLS: the owner removes others; anyone but the owner removes themselves (leaves).
  const { data, error } = await supabase.from('memberships').delete().eq('id', membershipId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('cannot_remove_member');
}

async function transferOwnership(gymId: string, membershipId: string) {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_academy_id: gymId,
    p_membership_id: membershipId,
  });
  if (error) throw error;
}

/** Professor requests (owner) and rejections. A student is approved with approveStudent. */
async function decide(membershipId: string, approve: boolean) {
  // RLS: staff decide student requests; only the owner decides professor ones. A trigger accepts only pending → decided
  // and stamps decided_by / decided_at.
  const { data, error } = await supabase
    .from('memberships')
    .update({ status: approve ? 'active' : 'rejected' })
    .eq('id', membershipId)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('membership_not_found');
}

/** Staff: approve a student request with their modalities (at least one), in one call. */
async function approveStudent(membershipId: string, modalityIds: string[]) {
  const { error } = await supabase.rpc('approve_student', { p_membership_id: membershipId, p_modality_ids: modalityIds });
  if (error) throw error;
}

/** Staff: the whole set of modalities of an active student (at least one). */
async function setStudentModalities(membershipId: string, modalityIds: string[]) {
  const { error } = await supabase.rpc('set_student_modalities', { p_membership_id: membershipId, p_modality_ids: modalityIds });
  if (error) throw error;
}

/** Staff: weekly class goal of one student in one modality (null = the modality's goal). */
async function setStudentWeeklyGoal(membershipId: string, modalityId: string, goal: number | null) {
  const { error } = await supabase.rpc('set_student_weekly_goal', {
    p_membership_id: membershipId,
    p_modality_id: modalityId,
    // Null is valid for the RPC (back to the modality's goal); the generated type says number.
    p_goal: goal as number,
  });
  if (error) throw error;
}

export const membershipApi = {
  listMine,
  listByGym,
  listPending,
  remove,
  decide,
  approveStudent,
  setStudentModalities,
  setStudentWeeklyGoal,
  transferOwnership,
};

export type MembershipRowApi = Awaited<ReturnType<typeof listMine>>[number];
export type GymMemberRowApi = Awaited<ReturnType<typeof listByGym>>[number];
export type PendingRequestRowApi = Awaited<ReturnType<typeof listPending>>[number];
