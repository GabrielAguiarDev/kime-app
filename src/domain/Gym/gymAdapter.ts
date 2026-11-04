import { inviteUrl } from '@utils/deepLinks';

import { logoUrl, type CodePreviewApi, type GymInviteRowApi, type GymSettingsRowApi, type InvitePreviewApi } from './gymApi';
import type { CodePreview, GymInvite, GymSettings, InvitePreview } from './gymTypes';

function toInvite(row: GymInviteRowApi): GymInvite {
  return { id: row.id, role: row.role, token: row.token, url: inviteUrl(row.token) };
}

function toInvitePreview(row: InvitePreviewApi): InvitePreview {
  return { gymName: row.academy_name, role: row.role, logoUrl: logoUrl(row.logo_path) };
}

function toCodePreview(row: CodePreviewApi): CodePreview {
  return { gymName: row.academy_name, logoUrl: logoUrl(row.logo_path) };
}

function toSettings(row: GymSettingsRowApi): GymSettings {
  return { id: row.id, name: row.name, timezone: row.timezone, logoPath: row.logo_path, logoUrl: logoUrl(row.logo_path) };
}

export const gymAdapter = { toInvite, toInvitePreview, toCodePreview, toSettings };
