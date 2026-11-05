import { useState } from 'react';

import { useTrainingStreak, useWaterStreak, type Streak } from '@domain/Streaks';
import { keyValueStorage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useWaterSettings } from '@services/water';

/** Records below this are not celebrated (too common to be news). */
const MIN_RECORD = 3;

export interface StreakRecordNotice {
  kind: 'water' | 'training';
  count: number;
}

/** Stored record for a scope; the first read only sets the baseline (history is not celebrated). */
function newRecord(scope: string, streak: Streak | null): number | null {
  if (!streak) return null;
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

/**
 * "Conquistas por recorde": the first time the current streak passes the
 * longest one, once per new record (kv-store per user, and per academy for
 * training). Water first, then training.
 */
export function useStreakRecords() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { settings } = useWaterSettings();
  const water = useWaterStreak(userId, settings?.timeZone, settings?.goalMl ?? null, settings?.isLimit);
  const training = useTrainingStreak(isStaff ? undefined : active?.gymId, userId);
  const [, rerender] = useState(0);

  if (!userId) return { notice: null, dismiss: () => undefined };
  const waterScope = `${userId}.water`;
  const trainingScope = `${userId}.training.${active?.gymId ?? ''}`;

  const waterRecord = newRecord(waterScope, water.streak);
  const trainingRecord = isStaff || !active ? null : newRecord(trainingScope, training.streak);
  const notice: StreakRecordNotice | null =
    waterRecord !== null
      ? { kind: 'water', count: waterRecord }
      : trainingRecord !== null
        ? { kind: 'training', count: trainingRecord }
        : null;

  const dismiss = () => {
    if (!notice) return;
    keyValueStorage.setScoped('streakRecords', notice.kind === 'water' ? waterScope : trainingScope, String(notice.count));
    rerender((n) => n + 1);
  };
  return { notice, dismiss };
}
