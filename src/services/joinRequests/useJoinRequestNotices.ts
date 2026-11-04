import { useEffect, useSyncExternalStore } from 'react';

import type { Membership } from '@domain/Membership';
import { keyValueStorage } from '@infra';

/**
 * Join requests as the user sees them in Perfil:
 *  - pending  → listed with "Aguardando aprovação" (cancel; never selectable);
 *  - rejected → gone from the list, with a notice shown ONCE.
 *
 * A rejected academy is no longer readable (RLS), so its name is remembered
 * on this device while the request is pending: membership id → name, plus the
 * decision already shown. Scoped per user. Rejections decided before this
 * device first ran the hook (reinstall, new phone) are not announced.
 */
interface Seen {
  /** First run on this device for the user (ISO). */
  since?: string;
  items: { [membershipId: string]: { gymName: string; noticedAt?: string } };
}

const listeners = new Set<() => void>();
let version = 0;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getVersion = () => version;
const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

function read(userId: string): Seen {
  try {
    const raw = JSON.parse(keyValueStorage.getScoped('joinRequests', userId) ?? '{}') as Partial<Seen>;
    return { since: raw.since, items: raw.items ?? {} };
  } catch {
    return { items: {} };
  }
}

function write(userId: string, seen: Seen) {
  keyValueStorage.setScoped('joinRequests', userId, JSON.stringify(seen));
  notify();
}

export interface RejectionNotice {
  membershipId: string;
  /** Null when this device never saw the request pending. */
  gymName: string | null;
}

export function useJoinRequestNotices(userId: string | undefined, memberships: Membership[]) {
  useSyncExternalStore(subscribe, getVersion);

  // Remember the names of pending requests (rejected ones lose access to it).
  useEffect(() => {
    if (!userId) return;
    const seen = read(userId);
    let changed = false;
    if (!seen.since) {
      seen.since = new Date().toISOString();
      changed = true;
    }
    for (const m of memberships) {
      if (m.status === 'pending' && m.gymName && seen.items[m.id]?.gymName !== m.gymName) {
        seen.items[m.id] = { gymName: m.gymName };
        changed = true;
      }
    }
    if (changed) write(userId, seen);
  }, [userId, memberships]);

  const seen = userId ? read(userId) : { items: {} };
  const unnoticed = memberships.filter(
    (m) =>
      m.status === 'rejected' &&
      !!seen.since &&
      !!m.decidedAt &&
      m.decidedAt > seen.since &&
      // A re-request rejected again has a new decision time: notice again.
      seen.items[m.id]?.noticedAt !== m.decidedAt,
  );
  const rejected = unnoticed[0];
  const notice: RejectionNotice | null = rejected
    ? { membershipId: rejected.id, gymName: seen.items[rejected.id]?.gymName ?? (rejected.gymName || null) }
    : null;

  const markNoticed = (list: Membership[]) => {
    if (!userId || list.length === 0) return;
    const next = read(userId);
    for (const m of list) {
      next.items[m.id] = { gymName: next.items[m.id]?.gymName ?? m.gymName, noticedAt: m.decidedAt ?? undefined };
    }
    write(userId, next);
  };

  return {
    notice,
    dismiss: () => rejected && markNoticed([rejected]),
    /** The waiting screen already tells about the rejection: do not repeat it later. */
    dismissAll: () => markNoticed(unnoticed),
  };
}
