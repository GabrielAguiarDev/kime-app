import { supabase } from '@infra/supabase';

import type { InviteRole } from './gymTypes';

async function create(name: string) {
  const { data, error } = await supabase.rpc('create_gym', { p_name: name });
  if (error) throw error;
  return data;
}

async function listActiveInvites(gymId: string) {
  const { data, error } = await supabase
    .from('gym_invites')
    .select('id, role, token')
    .eq('gym_id', gymId)
    .is('revoked_at', null);
  if (error) throw error;
  return data;
}

async function rotateInvite(gymId: string, role: InviteRole) {
  const { data, error } = await supabase.rpc('rotate_invite', { p_gym_id: gymId, p_role: role });
  if (error) throw error;
  return data;
}

async function invitePreview(token: string) {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });
  if (error) throw error;
  return data[0] ?? null;
}

export const gymApi = { create, listActiveInvites, rotateInvite, invitePreview };

export type GymInviteRowApi = Awaited<ReturnType<typeof listActiveInvites>>[number];
export type InvitePreviewApi = NonNullable<Awaited<ReturnType<typeof invitePreview>>>;
