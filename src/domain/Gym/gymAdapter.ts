import { inviteUrl } from '@utils/deepLinks';

import type { GymInviteRowApi, InvitePreviewApi } from './gymApi';
import type { GymInvite, InvitePreview } from './gymTypes';

function toInvite(row: GymInviteRowApi): GymInvite {
  return { id: row.id, role: row.role, token: row.token, url: inviteUrl(row.token) };
}

function toInvitePreview(row: InvitePreviewApi): InvitePreview {
  return { gymName: row.gym_name, role: row.role };
}

export const gymAdapter = { toInvite, toInvitePreview };
