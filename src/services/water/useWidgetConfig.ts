import { useEffect, useRef } from 'react';

import { useMyProfile } from '@domain/Profile';
import { dailyGoal, waterService } from '@domain/Water';
import { useRouteAccess } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/**
 * Keeps `water.config` (read by the widgets) in step with the profile: user,
 * bottle, daily goal and time zone.
 *
 * Published ONLY when the app itself is open to the user (signed in + at least
 * one approved membership, services/access). Otherwise it is cleared and the
 * widget shows "Entre no Kimi para registrar sua água." without the add
 * button; a tap opens kimi:// → the entry flow / waiting screen.
 *
 * Phase 4: pass the professor's plan for today as `plannedMl`.
 */
export function useWidgetConfig() {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const { isLoading: membershipsLoading, isError: membershipsError } = useActiveGym();
  const allowed = !!userId && level === 'member';
  const { data: profile } = useMyProfile(allowed ? userId : undefined);
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
    if (!profile) return;
    published.current = true;
    waterService.publishConfig({
      userId: userId!,
      bottleMl: profile.bottleMl,
      goalMl: dailyGoal({ weightKg: profile.weightKg }).goalMl,
      timeZone: profile.timeZone,
    });
  }, [allowed, userId, profile, membershipsLoading, membershipsError]);
}
