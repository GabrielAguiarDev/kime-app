import { toAppError } from '@infra/supabase';

import { announcementsApi as api, type AnnouncementRowApi } from './announcementsApi';
import type { Announcement, AnnouncementInput } from './announcementsTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

function toAnnouncement(row: AnnouncementRowApi): Announcement {
  return {
    id: row.id,
    academyId: row.academy_id,
    body: row.body,
    modalityId: row.modality_id,
    pinned: row.pinned,
    expiresOn: row.expires_on,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName: row.author_name,
    authorAvatarPath: row.author_avatar_path,
  };
}

const toRow = (input: AnnouncementInput) => ({
  body: input.body.trim(),
  modality_id: input.modalityId,
  pinned: input.pinned,
  expires_on: input.expiresOn,
});

export const announcementsService = {
  list: (academyId: string) => call(async () => (await api.listFeed(academyId)).map(toAnnouncement)),
  save: (academyId: string, id: string | null, input: AnnouncementInput) =>
    call(() => (id ? api.update(id, toRow(input)) : api.create(academyId, toRow(input)))),
  remove: (id: string) => call(() => api.remove(id)),
};
