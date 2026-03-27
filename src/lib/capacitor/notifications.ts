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

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      const regHandle = PushNotifications.addListener('registration', (token) => {
        regHandle.then(h => h.remove());
        errHandle.then(h => h.remove());
        resolve(token.value);
      });

      const errHandle = PushNotifications.addListener('registrationError', () => {
        regHandle.then(h => h.remove());
        errHandle.then(h => h.remove());
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/** Listen for incoming push notifications. Returns cleanup function. */
export function onPushReceived(
  callback: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
): (() => void) | undefined {
  if (!isNative()) return undefined;

  const handle = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    callback({
      title: notification.title ?? undefined,
      body: notification.body ?? undefined,
      data: notification.data as Record<string, unknown> | undefined,
    });
  });

  return () => { handle.then(h => h.remove()); };
}

/** Listen for push notification taps (deep link handling). Returns cleanup function. */
export function onPushActionPerformed(
  callback: (data: Record<string, unknown>) => void
): (() => void) | undefined {
  if (!isNative()) return undefined;

  const handle = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    callback(action.notification.data as Record<string, unknown>);
  });

  return () => { handle.then(h => h.remove()); };
}

// ── Local Notifications ──

/** Request local notification permissions */
export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
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

  try {
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
  } catch {
    // Plugin failure — non-blocking
  }
}

/** Cancel a scheduled notification */
export async function cancelNotification(id: number): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Plugin failure — non-blocking
  }
}

/** Cancel all scheduled notifications */
export async function cancelAllNotifications(): Promise<void> {
  if (!isNative()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    // Plugin failure — non-blocking
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

  // Lock screen safe: generic titles that don't reveal health context
  await scheduleDailyReminder({
    id: REMINDER_IDS.MORNING_CHECKIN,
    title: 'Suporte Bipolar',
    body: 'Você tem um lembrete.',
    hour: 9,
    minute: 0,
  });

  await scheduleDailyReminder({
    id: REMINDER_IDS.EVENING_SLEEP,
    title: 'Suporte Bipolar',
    body: 'Você tem um lembrete.',
    hour: 22,
    minute: 0,
  });
}
