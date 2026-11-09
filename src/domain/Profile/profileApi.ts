import { supabase } from '@infra/supabase';

/**
 * Body data (weight, height, reach, sex, birth date) is not readable from the table:
 * get_profile_details returns it for the user themselves or for staff of an
 * academy where the user is a competitor (null otherwise).
 */
async function getById(userId: string) {
  const [profile, details] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, bottle_ml, personal_water_goal_ml, timezone, avatar_path, show_in_ranking')
      .eq('id', userId)
      .single(),
    supabase.rpc('get_profile_details', { p_user_id: userId }).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (details.error) throw details.error;
  return {
    ...profile.data,
    weight_kg: details.data?.weight_kg ?? null,
    height_cm: details.data?.height_cm ?? null,
    reach_cm: details.data?.reach_cm ?? null,
    sex: details.data?.sex ?? null,
    birth_date: details.data?.birth_date ?? null,
  };
}

/** Weight, height and reach of a member (zero rows when the caller may not read them). */
async function getBodyData(userId: string) {
  const { data, error } = await supabase.rpc('get_profile_details', { p_user_id: userId }).maybeSingle();
  if (error) throw error;
  return data;
}

async function updateName(userId: string, fullName: string) {
  const { data, error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

/** "Meus dados": name, sex, birth date, weight, height and reach (own profile only, RLS). */
async function updatePersonalData(
  userId: string,
  patch: {
    full_name: string;
    sex: 'female' | 'male' | 'unspecified' | null;
    birth_date: string | null;
    weight_kg: number | null;
    height_cm: number | null;
    reach_cm: number | null;
  },
) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

// ---------------------------------------------------------------- avatar ---
/** PRIVATE bucket, one folder per user (`<user_id>/avatar-<ts>.jpg`). */
export const AVATAR_BUCKET = 'avatars';

/** A new file on every change: no stale cached image under the same name. */
async function uploadAvatar(userId: string, bytes: ArrayBuffer, contentType: string, extension: string, path?: string) {
  path ??= `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

async function setShowInRanking(userId: string, show: boolean) {
  const { data, error } = await supabase.from('profiles').update({ show_in_ranking: show }).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function setAvatarPath(userId: string, path: string | null) {
  const { data, error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

async function removeAvatarFile(path: string) {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}

/** Signed URL (RLS: own photo, or staff of an academy where the user has a membership). */
async function signedAvatarUrls(paths: string[], expiresInSeconds: number) {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(paths, expiresInSeconds);
  if (error) throw error;
  return data;
}

async function signedAvatarUrl(path: string, expiresInSeconds: number) {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

async function updateBodyAndBottle(
  userId: string,
  patch: { bottle_ml: number | null; personal_water_goal_ml?: number | null },
) {
  // RLS: own profile only. Zero rows means it did not apply.
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

export const profileApi = {
  getById,
  getBodyData,
  updateName,
  updateBodyAndBottle,
  updatePersonalData,
  uploadAvatar,
  setAvatarPath,
  removeAvatarFile,
  setShowInRanking,
  signedAvatarUrl,
  signedAvatarUrls,
};
export type ProfileRowApi = Awaited<ReturnType<typeof getById>>;
