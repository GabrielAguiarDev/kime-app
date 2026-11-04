import { useEffect, useRef } from 'react';

import { useMyProfile } from '@domain/Profile';
import { dailyGoal, waterService } from '@domain/Water';
import { useSession } from '@services/session';

/**
 * Keeps `water.config` (read by the widgets) in step with the profile: user,
 * bottle, daily goal and time zone. Cleared on sign-out, so the widget asks to
 * open the app instead of logging for the previous account.
 *
 * Phase 4: pass the professor's plan for today as `plannedMl`.
 */
export function useWidgetConfig() {
  const { userId } = useSession();
  const { data: profile } = useMyProfile(userId);
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!userId) {
      if (wasSignedIn.current) waterService.publishConfig(null);
      wasSignedIn.current = false;
      return;
    }
    wasSignedIn.current = true;
    if (!profile) return;
    waterService.publishConfig({
      userId,
      bottleMl: profile.bottleMl,
      goalMl: dailyGoal({ weightKg: profile.weightKg }).goalMl,
      timeZone: profile.timeZone,
    });
  }, [userId, profile]);
}
