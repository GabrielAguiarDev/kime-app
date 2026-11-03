import { supabase } from '@infra/supabase';

async function listMine(userId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, gym_id, role, status, gyms(name)')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function listByGym(gymId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, created_at, profile:profiles!memberships_user_id_fkey(full_name)')
    .eq('gym_id', gymId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function listPending(gymId: string) {
  const { data, error } = await supabase.rpc('list_pending_requests', { p_gym_id: gymId });
  if (error) throw error;
  return data;
}

async function remove(membershipId: string) {
  const { error } = await supabase.rpc('remove_membership', { p_membership_id: membershipId });
  if (error) throw error;
}

async function request(token: string) {
  const { data, error } = await supabase.rpc('request_membership', { p_token: token });
  if (error) throw error;
  return data;
}

async function decide(membershipId: string, approve: boolean) {
  const { error } = await supabase.rpc('decide_membership', {
    p_membership_id: membershipId,
    p_approve: approve,
  });
  if (error) throw error;
}

export const membershipApi = { listMine, listByGym, listPending, remove, request, decide };

export type MembershipRowApi = Awaited<ReturnType<typeof listMine>>[number];
export type GymMemberRowApi = Awaited<ReturnType<typeof listByGym>>[number];
export type PendingRequestRowApi = Awaited<ReturnType<typeof listPending>>[number];
