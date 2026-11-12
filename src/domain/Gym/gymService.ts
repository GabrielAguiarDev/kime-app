import { toAppError } from '@infra/supabase';
import type { Json } from '@infra/supabase/database.types';

import { gymAdapter } from './gymAdapter';
import { gymApi } from './gymApi';
import { prepareLogo } from './gymLogo';
import { normalizeCode } from './gymRules';
import type { CodeLookup, CodeType, GymSettings, InviteCodes, JoinResult } from './gymTypes';
import type { PlanTier } from './plans';
import { toSetupModalities, type SignupModality } from './signupRules';

async function create(name: string, modalities: string[]): Promise<string> {
  try {
    return await gymApi.create(name.trim(), modalities.map((m) => m.trim()).filter(Boolean));
  } catch (e) {
    throw toAppError(e);
  }
}

/**
 * Sign-up (step 4): creates everything in one call; then the logo picked in
 * step 3, best effort (the academy exists; the owner can set it later).
 * Returns the academy id and whether the logo made it.
 */
async function createWithSetup(input: {
  name: string;
  planTier: PlanTier | null;
  modalities: SignupModality[];
  logoUri: string | null;
}): Promise<{ gymId: string; logoSaved: boolean }> {
  let gymId: string;
  try {
    gymId = await gymApi.createWithSetup(
      input.name.trim(),
      input.planTier,
      toSetupModalities(input.modalities) as unknown as Json,
    );
  } catch (e) {
    throw toAppError(e);
  }
  if (!input.logoUri) return { gymId, logoSaved: true };
  try {
    await changeLogo(gymId, input.logoUri, null);
    return { gymId, logoSaved: true };
  } catch {
    return { gymId, logoSaved: false };
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

async function listInviteCodes(gymId: string): Promise<InviteCodes> {
  try {
    return gymAdapter.toInviteCodes(await gymApi.listInviteCodes(gymId));
  } catch (e) {
    throw toAppError(e);
  }
}

async function regenerateInviteCode(gymId: string, codeType: CodeType): Promise<string> {
  try {
    return await gymApi.regenerateInviteCode(gymId, codeType);
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

/** The time zone is fixed (America/Sao_Paulo): only the name is editable here. */
async function updateSettings(gymId: string, patch: { name?: string; inactiveAfterDays?: number }): Promise<void> {
  try {
    await gymApi.updateSettings(gymId, { name: patch.name?.trim(), inactive_after_days: patch.inactiveAfterDays });
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


export const gymService = {
  create,
  createWithSetup,
  lookupCode,
  joinWithCode,
  listInviteCodes,
  regenerateInviteCode,
  getSettings,
  updateSettings,
  changeLogo,
};
