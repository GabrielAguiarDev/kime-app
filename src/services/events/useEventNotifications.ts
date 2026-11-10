import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useAcademyToday } from '@domain/Classes';
import {
  eventNotices,
  planEventReminders,
  useEventRsvps,
  useEvents,
  type EventNoticeState,
} from '@domain/Events';
import { keyValueStorage } from '@infra';
import {
  cancelScheduledNotifications,
  hasNotificationPermission,
  onNotificationOpened,
  presentNotification,
  replaceScheduledNotifications,
} from '@infra/notifications';
import { useRouteAccess } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/** Academy calendar (fixed time zone, see academies.timezone). */
const ACADEMY_TIME_ZONE = 'America/Sao_Paulo';

function readState(scope: string): EventNoticeState | null {
  try {
    const raw = keyValueStorage.getScoped('eventNotices', scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EventNoticeState;
    return Array.isArray(parsed.seen) && Array.isArray(parsed.cancelled) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Root: local notifications of the active academy's events (no push yet, user
 * decision 2026-11-10).
 *  - Reminder the day before at 18:00 for the events the person is going to
 *    (scheduled on the device, re-planned when the answers or events change).
 *  - "Novo evento" for the members of its modalities and "Evento cancelado"
 *    for whoever was going, shown when the app opens or comes back and finds
 *    the change (the first run only records what exists).
 * Nothing is asked here: the permission is requested when the person taps "Vou".
 * Tapping one of these notifications opens the event (`navigationReady`: the
 * root Stack is mounted).
 */
export function useEventNotifications(navigationReady: boolean) {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const { active } = useActiveGym();
  const academyId = level === 'member' && userId ? active?.gymId : undefined;
  const events = useEvents(academyId);
  const rsvps = useEventRsvps(academyId);
  const today = useAcademyToday(academyId);

  const goingIds = useMemo(
    () => new Set((rsvps.data ?? []).filter((r) => r.userId === userId && r.status === 'going').map((r) => r.eventId)),
    [rsvps.data, userId],
  );
  const ready = !!academyId && !!events.data && !!rsvps.data && !!today.data;

  // A tapped event notification opens the event (the route guards still apply).
  const canOpen = navigationReady && !!academyId;
  useEffect(() => {
    if (!canOpen) return;
    return onNotificationOpened((data) => {
      if (typeof data.eventId === 'string') router.push({ pathname: '/evento', params: { id: data.eventId } });
    });
  }, [canOpen]);

  // --------------------------------------------------------- reminders ---
  const plan = ready
    ? planEventReminders({ events: events.data!, goingIds, timeZone: ACADEMY_TIME_ZONE, now: new Date() })
    : null;
  const signature = plan ? plan.map((r) => `${r.key}@${r.at.getTime()}`).join('|') : null;

  useEffect(() => {
    const scope = userId ?? 'signed-out';
    if (!userId || level !== 'member') {
      if (userId === undefined || keyValueStorage.getScoped('eventRemindersPlan', scope) !== null) {
        void cancelScheduledNotifications('event-reminder').catch(() => undefined);
        if (userId) keyValueStorage.removeScoped('eventRemindersPlan', scope);
      }
      return;
    }
    if (!plan || signature === null) return;
    if (keyValueStorage.getScoped('eventRemindersPlan', scope) === signature) return;
    void (async () => {
      if (!(await hasNotificationPermission())) return;
      await replaceScheduledNotifications(
        plan.map((r) => ({ at: r.at, title: r.title, body: r.body, data: { key: r.key, eventId: r.eventId } })),
        'event-reminder',
      );
      keyValueStorage.setScoped('eventRemindersPlan', scope, signature);
    })().catch(() => undefined);
    // `plan` follows `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, level, signature]);

  // ------------------------------------------------- new / cancelled ---
  const noticeKey = ready ? `${events.dataUpdatedAt}:${rsvps.dataUpdatedAt}` : null;
  useEffect(() => {
    if (!ready || !userId || !academyId || noticeKey === null) return;
    const scope = `${userId}.${academyId}`;
    const { notices, next } = eventNotices({
      events: events.data!,
      previous: readState(scope),
      userId,
      goingIds,
      today: today.data!,
    });
    keyValueStorage.setScoped('eventNotices', scope, JSON.stringify(next));
    if (notices.length === 0) return;
    void (async () => {
      if (!(await hasNotificationPermission())) return;
      for (const notice of notices) {
        await presentNotification({ title: notice.title, body: notice.body, data: { eventId: notice.eventId } });
      }
    })().catch(() => undefined);
    // Runs once per fresh fetch of events / answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeKey]);
}
