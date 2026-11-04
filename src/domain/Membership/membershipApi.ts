import { supabase } from '@infra/supabase';

async function listMine(userId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, academy_id, role, status, is_competitor, belt, academies(name)')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function listByGym(gymId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, is_competitor, belt, created_at, profile:profiles!memberships_user_id_fkey(full_name)')
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
  // RLS: professor of the academy; never themselves nor the owner.
  const { data, error } = await supabase.from('memberships').delete().eq('id', membershipId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('cannot_remove_member');
}

async function request(token: string) {
  const { data, error } = await supabase.rpc('request_membership', { p_token: token });
  if (error) throw error;
  return data;
}

async function decide(membershipId: string, approve: boolean) {
  // RLS: professor of the academy. A trigger accepts only pending → decided
  // and stamps decided_by / decided_at.
  const { data, error } = await supabase
    .from('memberships')
    .update({ status: approve ? 'active' : 'rejected' })
    .eq('id', membershipId)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('membership_not_found');
}

export const membershipApi = { listMine, listByGym, listPending, remove, request, decide };

export type MembershipRowApi = Awaited<ReturnType<typeof listMine>>[number];
export type GymMemberRowApi = Awaited<ReturnType<typeof listByGym>>[number];
export type PendingRequestRowApi = Awaited<ReturnType<typeof listPending>>[number];
