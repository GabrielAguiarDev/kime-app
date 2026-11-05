import { useEffect, useRef } from 'react';

import { useMyProfile } from '@domain/Profile';
import { dailyGoal, waterService } from '@domain/Water';
import { useRouteAccess } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

import { usePlannedWater } from './usePlannedWater';

/**
 * Keeps `water.config` (read by the widgets) in step with the profile: user,
 * bottle, daily goal and time zone.
 *
 * Published ONLY when the app itself is open to the user (signed in + at least
 * one approved membership, services/access). Otherwise it is cleared and the
 * widget shows "Entre no Kimi para registrar sua água." without the add
 * button; a tap opens kimi:// → the entry flow / waiting screen.
 *
 * Competitors: `goalsByDate` carries the professor's plan for the next days,
 * so the widget's goal follows the plan after midnight without the app.
 */
export function useWidgetConfig() {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const { isLoading: membershipsLoading, isError: membershipsError } = useActiveGym();
  const allowed = !!userId && level === 'member';
  const { data: profile } = useMyProfile(allowed ? userId : undefined);
  const planned = usePlannedWater(profile?.timeZone);
  const goalsKey = JSON.stringify(planned.byDate);
  const limitsKey = JSON.stringify(planned.limitsByDate);
  const published = useRef(false);

  useEffect(() => {
    // Unknown yet (first load, or offline): keep what the widget has.
    if (userId && (membershipsLoading || membershipsError)) return;
    if (!allowed) {
      // Also clears a config left by an older build or a previous session.
      if (published.current || waterService.readConfig()) waterService.publishConfig(null);
      published.current = false;
      return;
    }
    if (!profile || planned.isLoading) return;
    published.current = true;
    const goalsByDate = JSON.parse(goalsKey) as Record<string, number>;
    const limitsByDate = JSON.parse(limitsKey) as Record<string, boolean>;
    waterService.publishConfig({
      userId: userId!,
      bottleMl: profile.bottleMl,
      goalMl: dailyGoal({ weightKg: profile.weightKg }).goalMl,
      timeZone: profile.timeZone,
      ...(Object.keys(goalsByDate).length > 0 ? { goalsByDate } : {}),
      ...(Object.keys(limitsByDate).length > 0 ? { limitsByDate } : {}),
    });
  }, [allowed, userId, profile, membershipsLoading, membershipsError, planned.isLoading, goalsKey, limitsKey]);
}
