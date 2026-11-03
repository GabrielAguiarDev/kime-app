import { toAppError } from '@infra/supabase';

import { profileApi, type ProfileRowApi } from './profileApi';
import type { Profile } from './profileTypes';

const toProfile = (row: ProfileRowApi): Profile => ({ id: row.id, fullName: row.full_name });

async function getById(userId: string): Promise<Profile> {
  try {
    return toProfile(await profileApi.getById(userId));
  } catch (e) {
    throw toAppError(e);
  }
}

async function updateName(userId: string, fullName: string): Promise<void> {
  try {
    await profileApi.updateName(userId, fullName.trim());
  } catch (e) {
    throw toAppError(e);
  }
}

export const profileService = { getById, updateName };
