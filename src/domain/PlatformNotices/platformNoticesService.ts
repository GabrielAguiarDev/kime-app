import { toAppError } from '@infra/supabase';

import { platformNoticesApi as api, type PlatformNoticeRowApi } from './platformNoticesApi';
import type { PlatformNotice, PlatformNoticeAudience } from './platformNoticesTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

const AUDIENCES: readonly PlatformNoticeAudience[] = ['owners', 'staff', 'everyone'];

function toNotice(row: PlatformNoticeRowApi): PlatformNotice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: AUDIENCES.find((a) => a === row.audience) ?? 'everyone',
    endsOn: row.ends_on ?? null,
    createdAt: row.created_at,
  };
}

export const platformNoticesService = {
  list: () => call(async () => (await api.listFeed()).map(toNotice)),
  dismiss: (id: string) => call(() => api.dismiss(id)),
};
