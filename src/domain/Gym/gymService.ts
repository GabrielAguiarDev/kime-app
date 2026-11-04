import { toAppError } from '@infra/supabase';

import { gymAdapter } from './gymAdapter';
import { gymApi } from './gymApi';
import { prepareLogo } from './gymLogo';
import { normalizeCode } from './gymRules';
import type { CodeLookup, GymSettings, JoinResult, ProfessorCode } from './gymTypes';

async function create(name: string, modalities: string[]): Promise<string> {
  try {
    return await gymApi.create(name.trim(), modalities.map((m) => m.trim()).filter(Boolean));
  } catch (e) {
    throw toAppError(e);
  }
}

/** Name, logo and kind of a live code; null for anything else (no hint why). */
async function lookupCode(code: string): Promise<CodeLookup | null> {
  try {
    const row = await gymApi.lookupCode(normalizeCode(code));
    return row ? gymAdapter.toCodeLookup(row) : null;
  } catch (e) {
    throw toAppError(e);
  }
}

/** Student or professor code → pending request (or the existing membership). */
async function joinWithCode(code: string): Promise<JoinResult> {
  try {
    return gymAdapter.toJoinResult(await gymApi.joinWithCode(normalizeCode(code)));
  } catch (e) {
    throw toAppError(e);
  }
}

async function getStudentCode(gymId: string): Promise<string> {
  try {
    return await gymApi.getStudentCode(gymId);
  } catch (e) {
    throw toAppError(e);
  }
}

async function regenerateStudentCode(gymId: string): Promise<string> {
  try {
    return await gymApi.regenerateStudentCode(gymId);
  } catch (e) {
    throw toAppError(e);
  }
}

async function listProfessorCodes(gymId: string): Promise<ProfessorCode[]> {
  try {
    return (await gymApi.listProfessorCodes(gymId)).map(gymAdapter.toProfessorCode);
  } catch (e) {
    throw toAppError(e);
  }
}

async function createProfessorCode(gymId: string): Promise<ProfessorCode> {
  try {
    const row = await gymApi.createProfessorCode(gymId);
    if (!row) throw new Error('unknown');
    return gymAdapter.toProfessorCode(row);
  } catch (e) {
    throw toAppError(e);
  }
}

async function revokeProfessorCode(codeId: string): Promise<void> {
  try {
    await gymApi.revokeProfessorCode(codeId);
  } catch (e) {
    throw toAppError(e);
  }
}

async function getSettings(gymId: string): Promise<GymSettings> {
  try {
    return gymAdapter.toSettings(await gymApi.getSettings(gymId));
  } catch (e) {
    throw toAppError(e);
  }
}

async function updateSettings(gymId: string, patch: { name?: string; timezone?: string }): Promise<void> {
  try {
    await gymApi.updateSettings(gymId, { ...patch, name: patch.name?.trim() });
  } catch (e) {
    throw toAppError(e);
  }
}

/** New logo: upload, point the academy at it, then drop the old file (best effort). */
async function changeLogo(gymId: string, uri: string, previousPath: string | null): Promise<void> {
  try {
    const { bytes, contentType, extension } = await prepareLogo(uri);
    const path = await gymApi.uploadLogo(gymId, bytes, contentType, extension);
    try {
      await gymApi.updateSettings(gymId, { logo_path: path });
    } catch (e) {
      await gymApi.removeLogoFile(path).catch(() => undefined);
      throw e;
    }
    if (previousPath) await gymApi.removeLogoFile(previousPath).catch(() => undefined);
  } catch (e) {
    throw toAppError(e);
  }
}

async function removeLogo(gymId: string, path: string): Promise<void> {
  try {
    await gymApi.updateSettings(gymId, { logo_path: null });
    await gymApi.removeLogoFile(path).catch(() => undefined);
  } catch (e) {
    throw toAppError(e);
  }
}

export const gymService = {
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
  changeLogo,
  removeLogo,
};
