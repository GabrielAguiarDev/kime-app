import { supabase } from '@infra/supabase';

async function getById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, weight_kg, height_cm, bottle_ml, timezone, avatar_path, sex, birth_date')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function updateName(userId: string, fullName: string) {
  const { data, error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

/** "Meus dados": name, sex, birth date, weight and height (own profile only, RLS). */
async function updatePersonalData(
  userId: string,
  patch: {
    full_name: string;
    sex: 'female' | 'male' | 'unspecified' | null;
    birth_date: string | null;
    weight_kg: number | null;
    height_cm: number | null;
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
async function uploadAvatar(userId: string, bytes: ArrayBuffer, contentType: string, extension: string) {
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
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
async function signedAvatarUrl(path: string, expiresInSeconds: number) {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

async function updateBodyAndBottle(
  userId: string,
  patch: { weight_kg: number | null; height_cm: number | null; bottle_ml: number | null },
) {
  // RLS: own profile only. Zero rows means it did not apply.
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

export const profileApi = {
  getById,
  updateName,
  updateBodyAndBottle,
  updatePersonalData,
  uploadAvatar,
  setAvatarPath,
  removeAvatarFile,
  signedAvatarUrl,
};
export type ProfileRowApi = Awaited<ReturnType<typeof getById>>;
