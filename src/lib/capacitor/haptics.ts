/**
 * Haptic feedback via Capacitor — adds tactile response to key actions.
 * All functions are no-op on web. Safe to call anywhere.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

/** Light tap — check-in submit, toggle, navigation */
export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Medium tap — achievement unlock, important action */
export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

/** Heavy tap — SOS activation, critical alert */
export async function hapticHeavy(): Promise<void> {
  if (!isNative()) return;
  await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
}

/** Success notification — save confirmed, streak achieved */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

/** Warning notification — safety nudge, risk alert */
export async function hapticWarning(): Promise<void> {
  if (!isNative()) return;
  await Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
}

/** Error notification — validation error, failed action */
export async function hapticError(): Promise<void> {
  if (!isNative()) return;
  await Haptics.notification({ type: NotificationType.Error }).catch(() => {});
}
