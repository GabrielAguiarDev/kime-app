import { supabase } from '@infra/supabase';
import type { Json } from '@infra/supabase/database.types';

import type { CodeType } from './gymTypes';

async function create(name: string, modalities: string[]) {
  const { data, error } = await supabase.rpc('create_academy', { p_name: name, p_modalities: modalities });
  if (error) throw error;
  return data;
}

/** Sign-up: academy + owner + modalities + suggested belts + plan, in one call. */
async function createWithSetup(name: string, planTier: string | null, modalities: Json) {
  const { data, error } = await supabase.rpc('create_academy_with_setup', {
    p_name: name,
    // Null is valid for the RPC (no plan chosen); the generated type says string.
    p_plan_tier: planTier as string,
    p_modalities: modalities,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- codes ---
/** Anyone, signed in or not: academy name + logo + kind for a live code. */
async function lookupCode(code: string) {
  const { data, error } = await supabase.rpc('lookup_invite_code', { p_code: code });
  if (error) throw error;
  return data[0] ?? null;
}

async function joinWithCode(code: string) {
  const { data, error } = await supabase.rpc('join_with_code', { p_code: code });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('invite_invalid');
  return row;
}

/** Active codes of the academy (RLS: owner both, instructors the student one). */
async function listInviteCodes(gymId: string) {
  const { data, error } = await supabase
    .from('academy_invite_codes')
    .select('code_type, code')
    .eq('academy_id', gymId)
    .eq('status', 'active');
  if (error) throw error;
  return data;
}

/** Owner: replaces the active code of that kind; the old one stops working. */
async function regenerateInviteCode(gymId: string, codeType: CodeType) {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_academy_id: gymId, p_code_type: codeType });
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
    .select('id, name, timezone, logo_path, inactive_after_days')
    .eq('id', gymId)
    .single();
  if (error) throw error;
  return data;
}

async function updateSettings(gymId: string, patch: { name?: string; logo_path?: string | null; inactive_after_days?: number }) {
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

export const gymApi = {
  create,
  createWithSetup,
  lookupCode,
  joinWithCode,
  listInviteCodes,
  regenerateInviteCode,
  getSettings,
  updateSettings,
  uploadLogo,
  removeLogoFile,
};

export type CodeLookupApi = NonNullable<Awaited<ReturnType<typeof lookupCode>>>;
export type JoinResultApi = Awaited<ReturnType<typeof joinWithCode>>;
export type InviteCodeRowApi = Awaited<ReturnType<typeof listInviteCodes>>[number];
export type GymSettingsRowApi = Awaited<ReturnType<typeof getSettings>>;
