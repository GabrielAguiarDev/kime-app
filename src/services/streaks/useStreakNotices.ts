import { useState } from 'react';

import { useDiscipline, type Discipline } from '@domain/Streaks';
import { keyValueStorage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/** Records below this are not celebrated (too common to be news). */
const MIN_RECORD = 3;

export interface StreakNotice {
  /** Weeks in a row (on a record, also the new record). */
  count: number;
  /** A new longest streak ("Novo recorde."); otherwise a week was just done ("Nada mal."). */
  record: boolean;
}

/** Stored record; the first read only sets the baseline (history is not celebrated). */
function newRecord(scope: string, d: Discipline): number | null {
  const stored = keyValueStorage.getScoped('streakRecords', scope);
  if (stored === null) {
    keyValueStorage.setScoped('streakRecords', scope, String(d.record));
    return null;
  }
  const previous = Number(stored);
  if (d.record <= previous) return null;
  if (d.current === d.record && d.record >= MIN_RECORD) return d.record;
  keyValueStorage.setScoped('streakRecords', scope, String(d.record));
  return null;
}

/** Streak above the last one seen (a week was done). The first read and a drop only store it. */
function grown(scope: string, d: Discipline): number | null {
  const stored = keyValueStorage.getScoped('streakCurrent', scope);
  if (stored === null || d.current < Number(stored)) {
    keyValueStorage.setScoped('streakCurrent', scope, String(d.current));
    return null;
  }
  return d.current > Number(stored) ? d.current : null;
}

/**
 * Início: the Disciplina passed the longest streak ("Novo recorde.") or a
 * week was just done ("Nada mal."), once per change (kv-store per user).
 * Students only: staff have no classes to confirm.
 */
export function useStreakNotices() {
  const { userId } = useSession();
  const { isStaff } = useActiveGym();
  const discipline = useDiscipline(isStaff ? undefined : userId);
  const [, rerender] = useState(0);

  const d = discipline.data;
  if (!userId || isStaff || !d) return { notice: null, dismiss: () => undefined };
  const scope = `${userId}.discipline`;

  // Both run every time: each one keeps its own baseline.
  const record = newRecord(scope, d);
  const current = grown(scope, d);
  const notice: StreakNotice | null =
    record !== null ? { count: record, record: true } : current !== null ? { count: current, record: false } : null;

  const dismiss = () => {
    if (!notice) return;
    if (notice.record) keyValueStorage.setScoped('streakRecords', scope, String(notice.count));
    // A record is also growth: never follow it with "Nada mal." for the same count.
    keyValueStorage.setScoped('streakCurrent', scope, String(notice.count));
    rerender((n) => n + 1);
  };
  return { notice, dismiss };
}
