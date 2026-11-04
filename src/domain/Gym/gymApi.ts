import { supabase } from '@infra/supabase';

import type { InviteRole } from './gymTypes';

async function create(name: string, modalities: string[]) {
  const { data, error } = await supabase.rpc('create_academy', { p_name: name, p_modalities: modalities });
  if (error) throw error;
  return data;
}

async function joinWithCode(code: string) {
  const { data, error } = await supabase.rpc('join_academy', { p_invite_code: code });
  if (error) throw error;
  return data;
}

async function getInviteCode(gymId: string) {
  const { data, error } = await supabase
    .from('academies')
    .select('invite_code')
    .eq('id', gymId)
    .single();
  if (error) throw error;
  return data.invite_code;
}

async function listActiveInvites(gymId: string) {
  const { data, error } = await supabase
    .from('academy_invites')
    .select('id, role, token')
    .eq('academy_id', gymId)
    .is('revoked_at', null);
  if (error) throw error;
  return data;
}

async function rotateInvite(gymId: string, role: InviteRole) {
  const { data, error } = await supabase.rpc('rotate_invite', { p_academy_id: gymId, p_role: role });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------- settings ---
export const LOGO_BUCKET = 'academy-logos';

/** Logos live in a public bucket: the URL is enough to show them. */
export function logoUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

async function getSettings(gymId: string) {
  const { data, error } = await supabase
    .from('academies')
    .select('id, name, timezone, logo_path')
    .eq('id', gymId)
    .single();
  if (error) throw error;
  return data;
}

async function updateSettings(gymId: string, patch: { name?: string; timezone?: string; logo_path?: string | null }) {
  const { data, error } = await supabase.from('academies').update(patch).eq('id', gymId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
}

/** Uploads to a NEW path every time (no CDN staleness) and returns it. */
async function uploadLogo(gymId: string, bytes: ArrayBuffer, contentType: string, extension: string) {
  const path = `${gymId}/logo-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

async function removeLogoFile(path: string) {
  const { error } = await supabase.storage.from(LOGO_BUCKET).remove([path]);
  if (error) throw error;
}

async function previewByCode(code: string) {
  const { data, error } = await supabase.rpc('get_academy_preview_by_code', { p_invite_code: code });
  if (error) throw error;
  return data[0] ?? null;
}

async function invitePreview(token: string) {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });
  if (error) throw error;
  return data[0] ?? null;
}

export const gymApi = {
  create,
  joinWithCode,
  getInviteCode,
  listActiveInvites,
  rotateInvite,
  invitePreview,
  previewByCode,
  getSettings,
  updateSettings,
  uploadLogo,
  removeLogoFile,
};

export type GymInviteRowApi = Awaited<ReturnType<typeof listActiveInvites>>[number];
export type InvitePreviewApi = NonNullable<Awaited<ReturnType<typeof invitePreview>>>;
export type CodePreviewApi = NonNullable<Awaited<ReturnType<typeof previewByCode>>>;
export type GymSettingsRowApi = Awaited<ReturnType<typeof getSettings>>;
