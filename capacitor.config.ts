import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suportebipolar.app',
  appName: 'Suporte Bipolar',
  webDir: 'out',

  // B+ strategy: WebView loads Vercel, native plugins add real value
  server: {
    url: 'https://suportebipolar.com',
    cleartext: false,
    allowNavigation: ['suportebipolar.com', '*.suportebipolar.com'],
  },

  ios: {
    scheme: 'Suporte Bipolar',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    allowsLinkPreview: false,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // Pilar 1: APNs nativo (substitui Web Push no iOS app)
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Pilar 2: Local Notifications (lembretes de rotina, check-in, sono)
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#527a6e',
      sound: 'notification.wav',
    },

    // Pilar 3: Biometria (Face ID / Touch ID)
    NativeBiometric: {
      // Configured at runtime via plugin API
    },

    // Splash screen nativa
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#527a6e',
    },

    // Keyboard behavior
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
