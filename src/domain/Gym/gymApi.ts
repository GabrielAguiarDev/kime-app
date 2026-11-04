import { supabase } from '@infra/supabase';

async function create(name: string, modalities: string[]) {
  const { data, error } = await supabase.rpc('create_academy', { p_name: name, p_modalities: modalities });
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

async function getStudentCode(gymId: string) {
  const { data, error } = await supabase.from('academies').select('invite_code').eq('id', gymId).single();
  if (error) throw error;
  return data.invite_code;
}

async function regenerateStudentCode(gymId: string) {
  const { data, error } = await supabase.rpc('regenerate_student_code', { p_academy_id: gymId });
  if (error) throw error;
  return data;
}

/** Live codes only (RLS: owner). */
async function listProfessorCodes(gymId: string) {
  const { data, error } = await supabase
    .from('professor_codes')
    .select('id, code, expires_at')
    .eq('academy_id', gymId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function createProfessorCode(gymId: string) {
  const { data, error } = await supabase.rpc('create_professor_code', { p_academy_id: gymId });
  if (error) throw error;
  return data[0];
}

async function revokeProfessorCode(codeId: string) {
  const { data, error } = await supabase
    .from('professor_codes')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', codeId)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('forbidden');
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

async function updateSettings(gymId: string, patch: { name?: string; logo_path?: string | null }) {
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
  lookupCode,
  joinWithCode,
  getStudentCode,
  regenerateStudentCode,
  listProfessorCodes,
  createProfessorCode,
  revokeProfessorCode,
  getSettings,
  updateSettings,
  uploadLogo,
  removeLogoFile,
};

export type CodeLookupApi = NonNullable<Awaited<ReturnType<typeof lookupCode>>>;
export type JoinResultApi = Awaited<ReturnType<typeof joinWithCode>>;
export type ProfessorCodeRowApi = Awaited<ReturnType<typeof listProfessorCodes>>[number];
export type GymSettingsRowApi = Awaited<ReturnType<typeof getSettings>>;
