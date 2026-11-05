import { useEffect, useSyncExternalStore } from 'react';

import {
  trainedModalities,
  useAcademyToday,
  useModalities,
  useModalityStats,
  useSchedules,
} from '@domain/Classes';
import { planClassReminders, planSignature } from '@domain/Reminders/reminderRules';
import { keyValueStorage } from '@infra';
import {
  cancelScheduledNotifications,
  hasNotificationPermission,
  replaceScheduledNotifications,
  requestNotificationPermission,
} from '@infra/notifications';
import { useRouteAccess } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';

/** Academy calendar (fixed time zone, see academies.timezone). */
const ACADEMY_TIME_ZONE = 'America/Sao_Paulo';

// The switch (Perfil) and the root scheduler share this state.
const listeners = new Set<() => void>();
let version = 0;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getVersion = () => version;
const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

function isOn(userId: string | undefined): boolean {
  return !!userId && keyValueStorage.getScoped('classReminders', userId) === 'on';
}

/**
 * Perfil switch "Lembrete das aulas" (students). Turning it on asks for the
 * notification permission; denied → stays off and `denied` tells the screen.
 */
export function useClassReminderSetting() {
  const { userId } = useSession();
  useSyncExternalStore(subscribe, getVersion);
  const enabled = isOn(userId);

  const setEnabled = async (on: boolean): Promise<'ok' | 'denied'> => {
    if (!userId) return 'ok';
    if (on && !(await requestNotificationPermission())) return 'denied';
    if (on) keyValueStorage.setScoped('classReminders', userId, 'on');
    else keyValueStorage.removeScoped('classReminders', userId);
    notify();
    return 'ok';
  };
  return { enabled, setEnabled };
}

/**
 * Root: keeps the scheduled reminders in step with the active academy's
 * classes — 1 h before each class of the modalities the student trains, the
 * next 7 days, re-planned when the data changes (React Query refetches the
 * academy's "today" and schedules when the app comes back to the foreground).
 * Everything is cancelled when the switch is off, for staff, or signed out.
 */
export function useClassReminders() {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const { active, isStaff } = useActiveGym();
  useSyncExternalStore(subscribe, getVersion);
  const wanted = level === 'member' && !isStaff && !!active && isOn(userId);
  const academyId = wanted ? active?.gymId : undefined;

  const today = useAcademyToday(academyId);
  const schedules = useSchedules(academyId);
  const modalities = useModalities(academyId);
  const stats = useModalityStats(academyId);

  const ready = !!today.data && !!schedules.data && !!modalities.data && !!stats.data;
  const own = (stats.data ?? []).filter((s) => s.userId === userId);
  const modalityIds = ready ? new Set(trainedModalities(modalities.data!, own).map((m) => m.id)) : null;
  const plan =
    wanted && ready && active
      ? planClassReminders({
          schedules: schedules.data!,
          today: today.data!,
          timeZone: ACADEMY_TIME_ZONE,
          academyName: active.gymName,
          modalityIds,
          now: new Date(),
        })
      : null;
  const signature = plan ? planSignature(plan) : null;

  useEffect(() => {
    // Signed out: forget the plan of whoever was signed in.
    const scope = userId ?? 'signed-out';
    if (!wanted) {
      if (userId === undefined || keyValueStorage.getScoped('classRemindersPlan', scope) !== null) {
        void cancelScheduledNotifications().catch(() => undefined);
        if (userId) keyValueStorage.removeScoped('classRemindersPlan', scope);
      }
      return;
    }
    if (!plan || signature === null) return;
    if (keyValueStorage.getScoped('classRemindersPlan', scope) === signature) return;
    void (async () => {
      // Permission revoked in the system settings: nothing to schedule.
      if (!(await hasNotificationPermission())) return;
      await replaceScheduledNotifications(
        plan.map((r) => ({ at: r.at, title: r.title, body: r.body, data: { kind: 'class-reminder', key: r.key } })),
      );
      keyValueStorage.setScoped('classRemindersPlan', scope, signature);
    })().catch(() => undefined);
    // `plan` follows `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, userId, signature]);
}
