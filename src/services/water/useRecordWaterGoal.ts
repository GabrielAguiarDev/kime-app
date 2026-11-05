import { useEffect } from 'react';

import { streakApi } from '@domain/Streaks';
import { localDate } from '@domain/Water';
import { keyValueStorage } from '@infra';
import { useRouteAccess } from '@services/access';

import { useWaterSettings } from './useWaterSettings';

/**
 * Sends today's goal (plan or automatic) to water_goal_days, so the water
 * streak judges each past day by the goal it had then. Once per user, day and
 * goal value (kv-store); retried on the next render after a failure.
 */
export function useRecordWaterGoal() {
  const { level } = useRouteAccess();
  const { userId, settings } = useWaterSettings();
  const goalMl = settings?.goalMl ?? null;
  const timeZone = settings?.timeZone;

  useEffect(() => {
    if (level !== 'member' || !userId || !timeZone || goalMl === null) return;
    const day = localDate(new Date(), timeZone);
    const value = `${day}:${goalMl}`;
    if (keyValueStorage.getScoped('waterGoalRecorded', userId) === value) return;
    streakApi
      .recordWaterGoal()
      .then(() => keyValueStorage.setScoped('waterGoalRecorded', userId, value))
      .catch(() => undefined);
  }, [level, userId, timeZone, goalMl]);
}
