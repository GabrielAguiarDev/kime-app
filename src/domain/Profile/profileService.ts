import { toAppError } from '@infra/supabase';

import { prepareSquareImage } from '@utils/squareImage';

import { profileApi, type ProfileRowApi } from './profileApi';
import type { BodyAndBottle, BodyData, PersonalData, Profile, Sex } from './profileTypes';

const toNumber = (value: number | string | null): number | null => (value === null ? null : Number(value));

const toProfile = (row: ProfileRowApi): Profile => ({
  id: row.id,
  fullName: row.full_name,
  weightKg: toNumber(row.weight_kg),
  heightCm: toNumber(row.height_cm),
  reachCm: toNumber(row.reach_cm),
  bottleMl: row.bottle_ml,
  personalWaterGoalMl: row.personal_water_goal_ml,
  timeZone: row.timezone,
  avatarPath: row.avatar_path,
  sex: (row.sex as Sex | null) ?? null,
  birthDate: row.birth_date,
  showInRanking: row.show_in_ranking,
});

async function getById(userId: string): Promise<Profile> {
  try {
    return toProfile(await profileApi.getById(userId));
  } catch (e) {
    throw toAppError(e);
  }
}

/** Null when the caller may not read them (RLS rule of get_profile_details). */
async function getBodyData(userId: string): Promise<BodyData | null> {
  try {
    const row = await profileApi.getBodyData(userId);
    if (!row) return null;
    return { weightKg: toNumber(row.weight_kg), heightCm: toNumber(row.height_cm), reachCm: toNumber(row.reach_cm) };
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
      bottle_ml: input.bottleMl,
      personal_water_goal_ml: input.personalWaterGoalMl,
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
      reach_cm: input.reachCm,
    });
  } catch (e) {
    throw toAppError(e);
  }
}

/** Signed URLs last an hour; the query refreshes them before that. */
export const AVATAR_URL_TTL_SECONDS = 60 * 60;

/** New photo: resize/compress, upload, point the profile at it, then drop the old file (best effort). */
async function changeAvatar(userId: string, uri: string, previousPath: string | null, mirror = false): Promise<void> {
  try {
    const { bytes, contentType, extension } = await prepareSquareImage(uri, undefined, mirror);
    const path = await profileApi.uploadAvatar(userId, bytes, contentType, extension);
    const thumb = await prepareSquareImage(uri, 128, mirror);
    const thumbPath = path.replace('/avatar-', '/thumb-');
    try { await profileApi.uploadAvatar(userId, thumb.bytes, thumb.contentType, thumb.extension, thumbPath); }
    catch (e) { await profileApi.removeAvatarFile(path).catch(() => undefined); throw e; }
    try {
      await profileApi.setAvatarPath(userId, path);
    } catch (e) {
      await Promise.all([profileApi.removeAvatarFile(path), profileApi.removeAvatarFile(thumbPath)]).catch(() => undefined);
      throw e;
    }
    if (previousPath) await Promise.all([profileApi.removeAvatarFile(previousPath), profileApi.removeAvatarFile(previousPath.replace('/avatar-', '/thumb-'))]).catch(() => undefined);
  } catch (e) {
    throw toAppError(e);
  }
}

async function removeAvatar(userId: string, path: string): Promise<void> {
  try {
    await profileApi.setAvatarPath(userId, null);
    await Promise.all([profileApi.removeAvatarFile(path), profileApi.removeAvatarFile(path.replace('/avatar-', '/thumb-'))]).catch(() => undefined);
  } catch (e) {
    throw toAppError(e);
  }
}

async function setShowInRanking(userId: string, show: boolean): Promise<void> {
  try {
    await profileApi.setShowInRanking(userId, show);
  } catch (e) {
    throw toAppError(e);
  }
}

async function avatarUrls(paths: string[]): Promise<Map<string, string>> {
  try {
    const signed = await profileApi.signedAvatarUrls(paths, AVATAR_URL_TTL_SECONDS);
    return new Map(signed.filter((item): item is typeof item & { path: string; signedUrl: string } => !!item.path && !!item.signedUrl).map((item) => [item.path, item.signedUrl]));
  } catch (e) { throw toAppError(e); }
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
  getBodyData,
  updateName,
  updateBodyAndBottle,
  updatePersonalData,
  changeAvatar,
  removeAvatar,
  avatarUrl,
  avatarUrls,
  setShowInRanking,
};
