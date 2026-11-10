import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications (scheduled on the device, no server): class reminders,
 * event reminders and the "new / cancelled event" notices.
 * expo-notifications, SDK 58 (DATE trigger, NotificationBehavior with
 * shouldShowBanner/shouldShowList). The plugin is set with
 * enableRemoteNotifications: false — no push entitlement needed.
 *
 * Builds without the native module (a dev client built before the library was
 * added, Jest) do not load the library at all: reminders are just unavailable.
 */
const CHANNEL_ID = 'class-reminders';
const EVENTS_CHANNEL_ID = 'academy-events';

/** Each group replaces only its own scheduled notifications (`data.kind`). */
export type NotificationKind = 'class-reminder' | 'event-reminder';

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
    await N.setNotificationChannelAsync(EVENTS_CHANNEL_ID, {
      name: 'Eventos da academia',
      description: 'Novos eventos, cancelamentos e lembrete na véspera.',
      importance: N.AndroidImportance.DEFAULT,
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

/** Replaces the scheduled notifications of one kind with `items` (the other kinds stay). */
export async function replaceScheduledNotifications(items: LocalNotification[], kind: NotificationKind): Promise<void> {
  const N = lib();
  if (!N) return;
  await configureNotifications();
  await cancelScheduledNotifications(kind);
  const channelId = kind === 'class-reminder' ? CHANNEL_ID : EVENTS_CHANNEL_ID;
  for (const item of items) {
    await N.scheduleNotificationAsync({
      content: { title: item.title, body: item.body, data: { ...item.data, kind } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: item.at, channelId },
    });
  }
}

/** Cancels the scheduled notifications of one kind, or all of them. */
export async function cancelScheduledNotifications(kind?: NotificationKind): Promise<void> {
  const N = lib();
  if (!N) return;
  if (!kind) {
    await N.cancelAllScheduledNotificationsAsync();
    return;
  }
  const scheduled = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.kind === kind)
      .map((request) => N.cancelScheduledNotificationAsync(request.identifier)),
  );
}

/** Shows a notification right away (event notices). */
export async function presentNotification(item: Omit<LocalNotification, 'at'>): Promise<void> {
  const N = lib();
  if (!N) return;
  await configureNotifications();
  await N.scheduleNotificationAsync({
    content: { title: item.title, body: item.body, data: { ...item.data, kind: 'event-notice' } },
    trigger: Platform.OS === 'android' ? { channelId: EVENTS_CHANNEL_ID } : null,
  });
}

/**
 * Calls `onOpen` with the data of a notification the person tapped: the one
 * that opened the app (once) and any tapped while it runs. Returns the unsubscribe.
 */
export function onNotificationOpened(onOpen: (data: Record<string, unknown>) => void): () => void {
  const N = lib();
  if (!N) return () => undefined;
  const last = N.getLastNotificationResponse();
  if (last) {
    N.clearLastNotificationResponse();
    onOpen((last.notification.request.content.data ?? {}) as Record<string, unknown>);
  }
  const subscription = N.addNotificationResponseReceivedListener((response) => {
    onOpen((response.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  return () => subscription.remove();
}
