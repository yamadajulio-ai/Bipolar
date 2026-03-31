/** Type stub for capacitor-native-biometric (installed only in iOS builds) */
declare module "capacitor-native-biometric" {
  export enum BiometryType {
    NONE = 0,
    TOUCH_ID = 1,
    FACE_ID = 2,
    FINGERPRINT = 3,
    FACE_AUTHENTICATION = 4,
    IRIS_AUTHENTICATION = 5,
  }

  export interface IsAvailableResult {
    isAvailable: boolean;
    biometryType: BiometryType;
  }

  export interface IsAvailableOptions {
    useFallback?: boolean;
  }

  export interface VerifyIdentityOptions {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    negativeButtonText?: string;
    /** iOS only: fall back to device passcode if biometric fails */
    useFallback?: boolean;
    /** iOS only: custom text for the fallback button */
    fallbackTitle?: string;
    /** Android only: max biometric attempts (max 5, default 1) */
    maxAttempts?: number;
  }

  export const NativeBiometric: {
    isAvailable(options?: IsAvailableOptions): Promise<IsAvailableResult>;
    verifyIdentity(options?: VerifyIdentityOptions): Promise<void>;
  };
}
