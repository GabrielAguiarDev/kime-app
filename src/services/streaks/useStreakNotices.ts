import { useState } from 'react';

import { useTrainingStreak, useWaterStreak, type Streak } from '@domain/Streaks';
import { keyValueStorage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useWaterSettings } from '@services/water';

/** Records below this are not celebrated (too common to be news). */
const MIN_RECORD = 3;

export interface StreakNotice {
  kind: 'water' | 'training';
  /** The running streak (on a record, also the new record). */
  count: number;
  /** A new longest streak ("Novo recorde."); otherwise the training streak just grew ("Nada mal."). */
  record: boolean;
}

/** Stored record for a scope; the first read only sets the baseline (history is not celebrated). */
function newRecord(scope: string, streak: Streak): number | null {
  const stored = keyValueStorage.getScoped('streakRecords', scope);
  if (stored === null) {
    keyValueStorage.setScoped('streakRecords', scope, String(streak.record));
    return null;
  }
  const previous = Number(stored);
  if (streak.record <= previous) return null;
  if (streak.current === streak.record && streak.record >= MIN_RECORD) return streak.record;
  keyValueStorage.setScoped('streakRecords', scope, String(streak.record));
  return null;
}

/** Running streak above the last one seen. The first read and a drop (broken streak) only store it. */
function grown(scope: string, streak: Streak): number | null {
  const stored = keyValueStorage.getScoped('streakCurrent', scope);
  if (stored === null || streak.current < Number(stored)) {
    keyValueStorage.setScoped('streakCurrent', scope, String(streak.current));
    return null;
  }
  return streak.current > Number(stored) ? streak.current : null;
}

function noticeFor(scope: string, streak: Streak | null, growth: boolean): Omit<StreakNotice, 'kind'> | null {
  if (!streak) return null;
  // Both run every time: each one keeps its own baseline.
  const record = newRecord(scope, streak);
  const current = growth ? grown(scope, streak) : null;
  if (record !== null) return { count: record, record: true };
  return current !== null ? { count: current, record: false } : null;
}

/**
 * Início: a streak passed the longest one ("Novo recorde.", water first, then
 * training) or the training streak grew ("Nada mal."), once per change
 * (kv-store per user, and per academy for training). Water growth is not a
 * notice: it happens when the day's goal is met, so "Meta do dia batida."
 * carries it (`waterCurrent`). Staff only have the water streak.
 */
export function useStreakNotices() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { settings } = useWaterSettings();
  const water = useWaterStreak(userId, settings?.timeZone, settings?.goalMl ?? null, settings?.isLimit);
  const training = useTrainingStreak(isStaff ? undefined : active?.gymId, userId);
  const [, rerender] = useState(0);

  if (!userId) return { notice: null, waterCurrent: null, dismiss: () => undefined };
  const waterScope = `${userId}.water`;
  const trainingScope = `${userId}.training.${active?.gymId ?? ''}`;

  const waterNotice = noticeFor(waterScope, water.streak, false);
  const trainingNotice = isStaff || !active ? null : noticeFor(trainingScope, training.streak, true);
  const notice: StreakNotice | null = waterNotice
    ? { kind: 'water', ...waterNotice }
    : trainingNotice
      ? { kind: 'training', ...trainingNotice }
      : null;

  const dismiss = () => {
    if (!notice) return;
    const scope = notice.kind === 'water' ? waterScope : trainingScope;
    if (notice.record) keyValueStorage.setScoped('streakRecords', scope, String(notice.count));
    // A record is also growth: never follow it with "Nada mal." for the same count.
    keyValueStorage.setScoped('streakCurrent', scope, String(notice.count));
    rerender((n) => n + 1);
  };
  return { notice, waterCurrent: water.streak?.current ?? null, dismiss };
}
