/**
 * Biometric authentication (Face ID / Touch ID) via Capacitor.
 * Provides app-lock functionality for privacy on shared devices.
 */
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { isNative } from './platform';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

/** Check if device supports biometrics */
export async function isBiometricAvailable(): Promise<{
  available: boolean;
  type: BiometryType;
}> {
  if (!isNative()) {
    return { available: false, type: BiometryType.NONE };
  }

  try {
    const result = await NativeBiometric.isAvailable();
    return {
      available: result.isAvailable,
      type: result.biometryType,
    };
  } catch {
    return { available: false, type: BiometryType.NONE };
  }
}

/** Get human-readable name for biometric type */
export function getBiometricName(type: BiometryType): string {
  switch (type) {
    case BiometryType.FACE_ID:
      return 'Face ID';
    case BiometryType.TOUCH_ID:
      return 'Touch ID';
    case BiometryType.FINGERPRINT:
      return 'Impressão Digital';
    case BiometryType.FACE_AUTHENTICATION:
      return 'Reconhecimento Facial';
    case BiometryType.IRIS_AUTHENTICATION:
      return 'Íris';
    default:
      return 'Biometria';
  }
}

/** Prompt user for biometric verification */
export async function verifyBiometric(): Promise<boolean> {
  if (!isNative()) return true; // Skip on web

  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Desbloqueie para acessar seus dados de saúde',
      title: 'Suporte Bipolar',
      subtitle: 'Autenticação necessária',
      description: 'Use biometria para proteger seus dados sensíveis',
    });
    return true;
  } catch {
    return false;
  }
}

/** Check if user has enabled biometric lock */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
    return value === 'true';
  } catch {
    return false;
  }
}

/** Enable/disable biometric lock */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    await Preferences.set({
      key: BIOMETRIC_ENABLED_KEY,
      value: enabled ? 'true' : 'false',
    });
  } catch {
    // Preferences plugin failure — non-blocking
  }
}
