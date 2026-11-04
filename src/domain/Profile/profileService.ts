import { toAppError } from '@infra/supabase';

import { prepareSquareImage } from '@utils/squareImage';

import { profileApi, type ProfileRowApi } from './profileApi';
import type { BodyAndBottle, PersonalData, Profile, Sex } from './profileTypes';

const toNumber = (value: number | string | null): number | null => (value === null ? null : Number(value));

const toProfile = (row: ProfileRowApi): Profile => ({
  id: row.id,
  fullName: row.full_name,
  weightKg: toNumber(row.weight_kg),
  heightCm: toNumber(row.height_cm),
  bottleMl: row.bottle_ml,
  timeZone: row.timezone,
  avatarPath: row.avatar_path,
  sex: (row.sex as Sex | null) ?? null,
  birthDate: row.birth_date,
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

async function updatePersonalData(userId: string, input: PersonalData): Promise<void> {
  try {
    await profileApi.updatePersonalData(userId, {
      full_name: input.fullName.trim(),
      sex: input.sex,
      birth_date: input.birthDate,
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
    });
  } catch (e) {
    throw toAppError(e);
  }
}

/** Signed URLs last an hour; the query refreshes them before that. */
export const AVATAR_URL_TTL_SECONDS = 60 * 60;

/** New photo: resize/compress, upload, point the profile at it, then drop the old file (best effort). */
async function changeAvatar(userId: string, uri: string, previousPath: string | null): Promise<void> {
  try {
    const { bytes, contentType, extension } = await prepareSquareImage(uri);
    const path = await profileApi.uploadAvatar(userId, bytes, contentType, extension);
    try {
      await profileApi.setAvatarPath(userId, path);
    } catch (e) {
      await profileApi.removeAvatarFile(path).catch(() => undefined);
      throw e;
    }
    if (previousPath) await profileApi.removeAvatarFile(previousPath).catch(() => undefined);
  } catch (e) {
    throw toAppError(e);
  }
}

async function removeAvatar(userId: string, path: string): Promise<void> {
  try {
    await profileApi.setAvatarPath(userId, null);
    await profileApi.removeAvatarFile(path).catch(() => undefined);
  } catch (e) {
    throw toAppError(e);
  }
}

async function avatarUrl(path: string): Promise<string> {
  try {
    return await profileApi.signedAvatarUrl(path, AVATAR_URL_TTL_SECONDS);
  } catch (e) {
    throw toAppError(e);
  }
}

export const profileService = {
  getById,
  updateName,
  updateBodyAndBottle,
  updatePersonalData,
  changeAvatar,
  removeAvatar,
  avatarUrl,
};
