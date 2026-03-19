/**
 * Native push notifications (APNs) and local notifications via Capacitor.
 * Handles registration, permission, and scheduling.
 */
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

// ── APNs (Remote Push) ──

/** Request permission and register for APNs */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative()) return null;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return null;

  await PushNotifications.register();

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      resolve(token.value);
    });

    PushNotifications.addListener('registrationError', () => {
      resolve(null);
    });
  });
}

/** Listen for incoming push notifications */
export function onPushReceived(
  callback: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
) {
  if (!isNative()) return;

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    callback({
      title: notification.title ?? undefined,
      body: notification.body ?? undefined,
      data: notification.data as Record<string, unknown> | undefined,
    });
  });
}

/** Listen for push notification taps (deep link handling) */
export function onPushActionPerformed(
  callback: (data: Record<string, unknown>) => void
) {
  if (!isNative()) return;

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    callback(action.notification.data as Record<string, unknown>);
  });
}

// ── Local Notifications ──

/** Request local notification permissions */
export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;

  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

/** Schedule a daily reminder (e.g., check-in, sleep log) */
export async function scheduleDailyReminder(options: {
  id: number;
  title: string;
  body: string;
  hour: number;
  minute: number;
}): Promise<void> {
  if (!isNative()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: options.id,
        title: options.title,
        body: options.body,
        schedule: {
          on: { hour: options.hour, minute: options.minute },
          repeats: true,
          allowWhileIdle: true,
        },
        sound: 'default',
      },
    ],
  });
}

/** Cancel a scheduled notification */
export async function cancelNotification(id: number): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

/** Cancel all scheduled notifications */
export async function cancelAllNotifications(): Promise<void> {
  if (!isNative()) return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }
}

// ── Predefined reminder IDs ──
export const REMINDER_IDS = {
  MORNING_CHECKIN: 1001,
  EVENING_SLEEP: 1002,
  MEDICATION: 1003,
  WEEKLY_ASSESSMENT: 1004,
} as const;

/** Setup default reminders for new users */
export async function setupDefaultReminders(): Promise<void> {
  const hasPermission = await requestLocalNotificationPermission();
  if (!hasPermission) return;

  await scheduleDailyReminder({
    id: REMINDER_IDS.MORNING_CHECKIN,
    title: 'Bom dia! Como você está?',
    body: 'Registre seu humor e energia no check-in matinal.',
    hour: 9,
    minute: 0,
  });

  await scheduleDailyReminder({
    id: REMINDER_IDS.EVENING_SLEEP,
    title: 'Hora de registrar o sono',
    body: 'Como foi sua noite? Registre antes de dormir.',
    hour: 22,
    minute: 0,
  });
}
