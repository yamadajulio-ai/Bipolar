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

  export interface VerifyIdentityOptions {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
  }

  export const NativeBiometric: {
    isAvailable(): Promise<IsAvailableResult>;
    verifyIdentity(options: VerifyIdentityOptions): Promise<void>;
  };
}
