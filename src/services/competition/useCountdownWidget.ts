import { useEffect } from 'react';

import { countdownWidget, upcomingChampionships, useMyChampionships } from '@domain/Competition';
import { useMyProfile } from '@domain/Profile';
import { localDate } from '@domain/Water';
import { useRouteAccess } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/** At most this many championships go to the widget (it only shows the next one). */
const MAX_ITEMS = 10;

/**
 * Keeps `competition.championships` (countdown widget) in step with the
 * championships the user is entered in. Cleared when the user is signed out,
 * has no approved membership, or competes for no academy.
 */
export function useCountdownWidget() {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const { memberships, isLoading, isError } = useActiveGym();
  const competes = memberships.some((m) => m.status === 'active' && m.isCompetitor);
  const allowed = !!userId && level === 'member' && competes;
  const profile = useMyProfile(allowed ? userId : undefined);
  const championships = useMyChampionships(userId, allowed);
  const timeZone = profile.data?.timeZone;

  useEffect(() => {
    // Unknown yet (first load, or offline): keep what the widget has.
    if (userId && (isLoading || isError)) return;
    if (!allowed) {
      if (countdownWidget.read()) countdownWidget.publish(null);
      return;
    }
    if (!championships.data || !timeZone) return;
    const today = localDate(new Date(), timeZone);
    countdownWidget.publish({
      userId: userId!,
      timeZone,
      items: upcomingChampionships(championships.data, today)
        .slice(0, MAX_ITEMS)
        .map((c) => ({ name: c.name, date: c.eventDate, location: c.location })),
    });
  }, [allowed, userId, isLoading, isError, championships.data, timeZone]);
}
