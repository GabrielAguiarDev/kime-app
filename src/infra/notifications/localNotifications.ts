import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications (scheduled on the device, no server): class reminders.
 * expo-notifications, SDK 58 (DATE trigger, NotificationBehavior with
 * shouldShowBanner/shouldShowList). The plugin is set with
 * enableRemoteNotifications: false — no push entitlement needed.
 *
 * Builds without the native module (a dev client built before the library was
 * added, Jest) do not load the library at all: reminders are just unavailable.
 */
const CHANNEL_ID = 'class-reminders';
/** Round timer fallback on Android (bells while the app is in the background). */
const TIMER_CHANNEL_ID = 'round-timer';

const available = !!requireOptionalNativeModule('ExpoNotificationScheduler');

function lib(): typeof NotificationsModule | null {
  // Loaded lazily: importing it without its native modules throws.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return available ? (require('expo-notifications') as typeof NotificationsModule) : null;
}

/** False on a build without the native module (needs a new build). */
export const notificationsAvailable = available;

let configured = false;

/** Foreground presentation + the Android channel. Idempotent. */
export async function configureNotifications(): Promise<void> {
  const N = lib();
  if (!N || configured) return;
  configured = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Lembretes de aula',
      description: 'Aviso 1 hora antes das aulas.',
      importance: N.AndroidImportance.DEFAULT,
    });
    await N.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
      name: 'Timer de rounds',
      description: 'Início e fim dos rounds com o app em segundo plano.',
      importance: N.AndroidImportance.HIGH,
    });
  }
}

function granted(N: typeof NotificationsModule, status: NotificationsModule.NotificationPermissionsStatus): boolean {
  if (Platform.OS === 'ios') {
    const ios = status.ios?.status;
    return (
      ios === N.IosAuthorizationStatus.AUTHORIZED ||
      ios === N.IosAuthorizationStatus.PROVISIONAL ||
      ios === N.IosAuthorizationStatus.EPHEMERAL
    );
  }
  return status.granted;
}

export async function hasNotificationPermission(): Promise<boolean> {
  const N = lib();
  return !!N && granted(N, await N.getPermissionsAsync());
}

/** Asks only when it was never answered; true when notifications may be shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = lib();
  if (!N) return false;
  await configureNotifications();
  const current = await N.getPermissionsAsync();
  if (granted(N, current)) return true;
  if (!current.canAskAgain) return false;
  return granted(N, await N.requestPermissionsAsync());
}

export interface LocalNotification {
  at: Date;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Replaces every scheduled notification of the app with `items`. */
export async function replaceScheduledNotifications(items: LocalNotification[]): Promise<void> {
  const N = lib();
  if (!N) return;
  await configureNotifications();
  await N.cancelAllScheduledNotificationsAsync();
  for (const item of items) {
    await N.scheduleNotificationAsync({
      content: { title: item.title, body: item.body, data: item.data ?? {} },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL_ID },
    });
  }
}

export async function cancelScheduledNotifications(): Promise<void> {
  await lib()?.cancelAllScheduledNotificationsAsync();
}

/** Schedules one notification on the timer channel; null when unavailable. */
export async function scheduleTimerNotification(item: LocalNotification): Promise<string | null> {
  const N = lib();
  if (!N || !(await hasNotificationPermission())) return null;
  await configureNotifications();
  return N.scheduleNotificationAsync({
    content: { title: item.title, body: item.body, data: item.data ?? {}, sound: true },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: TIMER_CHANNEL_ID },
  });
}

/** Cancels the given scheduled notifications (leaves the others, e.g. class reminders). */
export async function cancelNotifications(ids: string[]): Promise<void> {
  const N = lib();
  if (!N) return;
  await Promise.all(ids.map((id) => N.cancelScheduledNotificationAsync(id)));
}
