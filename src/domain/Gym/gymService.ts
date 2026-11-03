import { toAppError } from '@infra/supabase';

import { gymAdapter } from './gymAdapter';
import { gymApi } from './gymApi';
import type { GymInvite, InvitePreview, InviteRole } from './gymTypes';

async function create(name: string): Promise<string> {
  try {
    return await gymApi.create(name.trim());
  } catch (e) {
    throw toAppError(e);
  }
}

async function listActiveInvites(gymId: string): Promise<GymInvite[]> {
  try {
    const rows = await gymApi.listActiveInvites(gymId);
    return rows.map(gymAdapter.toInvite);
  } catch (e) {
    throw toAppError(e);
  }
}

async function rotateInvite(gymId: string, role: InviteRole): Promise<void> {
  try {
    await gymApi.rotateInvite(gymId, role);
  } catch (e) {
    throw toAppError(e);
  }
}

async function invitePreview(token: string): Promise<InvitePreview | null> {
  try {
    const row = await gymApi.invitePreview(token);
    return row ? gymAdapter.toInvitePreview(row) : null;
  } catch (e) {
    throw toAppError(e);
  }
}

export const gymService = { create, listActiveInvites, rotateInvite, invitePreview };
