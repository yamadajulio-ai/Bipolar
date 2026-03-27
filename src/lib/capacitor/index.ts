/**
 * Capacitor native bridge — unified export for all native capabilities.
 */
export { isNative, isIOS, isWeb } from './platform';

export {
  isBiometricAvailable,
  getBiometricName,
  verifyBiometric,
  isBiometricEnabled,
  setBiometricEnabled,
} from './biometric';

export {
  registerPushNotifications,
  onPushReceived,
  onPushActionPerformed,
  requestLocalNotificationPermission,
  scheduleDailyReminder,
  cancelNotification,
  cancelAllNotifications,
  setupDefaultReminders,
  REMINDER_IDS,
} from './notifications';

export {
  registerDeepLinkHandler,
  onAppStateChange,
  shareContent,
  SHARE_PRESETS,
} from './deep-links';

export {
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticSuccess,
  hapticWarning,
  hapticError,
} from './haptics';
