import { toAppError } from '@infra/supabase';

import { gymAdapter } from './gymAdapter';
import { gymApi } from './gymApi';
import { prepareLogo } from './gymLogo';
import type { CodePreview, GymInvite, GymSettings, InvitePreview, InviteRole } from './gymTypes';

async function create(name: string, modalities: string[]): Promise<string> {
  try {
    return await gymApi.create(name.trim(), modalities.map((m) => m.trim()).filter(Boolean));
  } catch (e) {
    throw toAppError(e);
  }
}

/** Short code typed by the student. Lands as a pending request. */
async function joinWithCode(code: string): Promise<string> {
  try {
    return await gymApi.joinWithCode(code.trim());
  } catch (e) {
    throw toAppError(e);
  }
}

async function getInviteCode(gymId: string): Promise<string> {
  try {
    return await gymApi.getInviteCode(gymId);
  } catch (e) {
    throw toAppError(e);
  }
}

async function listActiveInvites(gymId: string): Promise<GymInvite[]> {
  try {
    const rows = await gymApi.listActiveInvites(gymId);
    return rows.map(gymAdapter.toInvite);
  } catch (e) {
    throw toAppError(e);
  }
}

async function rotateInvite(gymId: string, role: InviteRole): Promise<void> {
  try {
    await gymApi.rotateInvite(gymId, role);
  } catch (e) {
    throw toAppError(e);
  }
}

async function invitePreview(token: string): Promise<InvitePreview | null> {
  try {
    const row = await gymApi.invitePreview(token);
    return row ? gymAdapter.toInvitePreview(row) : null;
  } catch (e) {
    throw toAppError(e);
  }
}

async function previewByCode(code: string): Promise<CodePreview | null> {
  try {
    const row = await gymApi.previewByCode(code.trim());
    return row ? gymAdapter.toCodePreview(row) : null;
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
  previewByCode,
  getSettings,
  updateSettings,
  changeLogo,
  removeLogo,
  create,
  joinWithCode,
  getInviteCode,
  listActiveInvites,
  rotateInvite,
  invitePreview,
};
