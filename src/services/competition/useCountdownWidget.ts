import { useEffect } from 'react';

import { countdownWidget, upcomingChampionships, useMyChampionships } from '@domain/Competition';
import { useMyProfile } from '@domain/Profile';
import { localDate } from '@domain/Water';
import { useRouteAccess } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';

/** At most this many championships per modality go to the widget (it only shows the next one). */
const MAX_ITEMS = 10;

/**
 * Keeps `competition.championships` (countdown widget) in step with the
 * championships the user is entered in, and `competition.selectedModality`
 * with the modality picked in the Início header (the widget counts down only
 * to that modality). Cleared when the user is signed out, has no approved
 * membership, or competes for no academy.
 */
export function useCountdownWidget() {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const { memberships, isLoading, isError } = useActiveGym();
  const { selected, isLoading: modalitiesLoading } = useActiveModality();
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
      // Up to MAX_ITEMS per modality: the widget filters by the selected one.
      items: upcomingChampionships(championships.data, today)
        .filter((c, _i, all) => all.filter((o) => o.modalityId === c.modalityId).indexOf(c) < MAX_ITEMS)
        .map((c) => ({ name: c.name, date: c.eventDate, location: c.location, modalityId: c.modalityId })),
    });
  }, [allowed, userId, isLoading, isError, championships.data, timeZone]);

  const selectedId = selected?.id;
  const selectedName = selected?.name;
  const competesInSelected = !!selected?.link.isCompetitor;
  useEffect(() => {
    if (userId && (isLoading || isError)) return;
    // Academy modalities still loading (no name yet): keep what the widget has.
    if (allowed && modalitiesLoading) return;
    if (!allowed || !selectedId || !selectedName) {
      countdownWidget.publishModality(null);
      return;
    }
    countdownWidget.publishModality({ modalityId: selectedId, name: selectedName, competes: competesInSelected });
  }, [allowed, userId, isLoading, isError, modalitiesLoading, selectedId, selectedName, competesInSelected]);
}
