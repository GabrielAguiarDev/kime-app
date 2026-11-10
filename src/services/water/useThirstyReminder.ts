import { Asset } from 'expo-asset';
import { useEffect } from 'react';

import { planThirstyReminders, useWaterDay } from '@domain/Water';
import { keyValueStorage } from '@infra';
import {
  cancelScheduledNotifications,
  hasNotificationPermission,
  replaceScheduledNotifications,
} from '@infra/notifications';
import { useRouteAccess } from '@services/access';
import { useSession } from '@services/session';

import { PLANNED_DAYS_AHEAD, usePlannedWater } from './usePlannedWater';
import { useWaterSettings } from './useWaterSettings';

/** Same reduced bust as the widgets (targets/widgets kimiThirsty, Android kimi_thirsty). */
const THIRSTY_IMAGE = require('../../../assets/mascot/thirsty-widget.png') as number;

async function thirstyImageUri(): Promise<string | undefined> {
  try {
    const asset = await Asset.fromModule(THIRSTY_IMAGE).downloadAsync();
    return asset.localUri ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Root: "O Kimi está com sede. Você bebeu água hoje?" at 18:00 (profile time zone), same rules
 * as the widget's thirsty state (domain/Water/thirstyReminder): not once water was logged today,
 * never on a limit day of the water plan. Re-planned when the day's total or the plan changes;
 * logs made in the widget with the app closed are only seen when the app opens.
 * Nothing is asked here: scheduled only when notifications are already allowed.
 * Cancelled for anyone without access to the app, and on sign-out.
 */
export function useThirstyReminder() {
  const { userId } = useSession();
  const { level } = useRouteAccess();
  const wanted = !!userId && level === 'member';
  const { settings } = useWaterSettings();
  const timeZone = wanted ? settings?.timeZone : undefined;
  const planned = usePlannedWater(timeZone);
  const day = useWaterDay(wanted ? userId : undefined, timeZone);

  const plan =
    timeZone && day.data && !planned.isLoading
      ? planThirstyReminders({
          now: new Date(),
          timeZone,
          todayTotalMl: day.data.totalMl,
          limitsByDate: planned.limitsByDate,
          days: PLANNED_DAYS_AHEAD,
        })
      : null;
  const signature = plan ? plan.map((at) => at.getTime()).join('|') : null;

  useEffect(() => {
    const scope = userId ?? 'signed-out';
    if (!wanted) {
      if (userId === undefined || keyValueStorage.getScoped('thirstyRemindersPlan', scope) !== null) {
        void cancelScheduledNotifications('water-reminder').catch(() => undefined);
        if (userId) keyValueStorage.removeScoped('thirstyRemindersPlan', scope);
      }
      return;
    }
    if (!plan || signature === null) return;
    if (keyValueStorage.getScoped('thirstyRemindersPlan', scope) === signature) return;
    void (async () => {
      if (!(await hasNotificationPermission())) return;
      const imageUri = await thirstyImageUri();
      await replaceScheduledNotifications(
        plan.map((at) => ({ at, title: 'O Kimi está com sede.', body: 'Você bebeu água hoje?', imageUri })),
        'water-reminder',
      );
      keyValueStorage.setScoped('thirstyRemindersPlan', scope, signature);
    })().catch(() => undefined);
    // `plan` follows `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, userId, signature]);
}
