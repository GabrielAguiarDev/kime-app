import { toAppError } from '@infra/supabase';

import { profileApi, type ProfileRowApi } from './profileApi';
import type { BodyAndBottle, Profile } from './profileTypes';

const toNumber = (value: number | string | null): number | null => (value === null ? null : Number(value));

const toProfile = (row: ProfileRowApi): Profile => ({
  id: row.id,
  fullName: row.full_name,
  weightKg: toNumber(row.weight_kg),
  heightCm: toNumber(row.height_cm),
  bottleMl: row.bottle_ml,
  timeZone: row.timezone,
});

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

async function updateBodyAndBottle(userId: string, input: BodyAndBottle): Promise<void> {
  try {
    await profileApi.updateBodyAndBottle(userId, {
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      bottle_ml: input.bottleMl,
    });
  } catch (e) {
    throw toAppError(e);
  }
}

export const profileService = { getById, updateName, updateBodyAndBottle };
