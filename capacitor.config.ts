import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suportebipolar.app',
  appName: 'Suporte Bipolar',
  webDir: 'out',

  // B-lite strategy: bundle local (core clínico) + API remota (token auth).
  // server.url REMOVIDO — Apple 4.2/2.5.2, Capacitor docs: "not intended for production".
  // WebView carrega do bundle local (out/). API calls via fetch + bearer token.
  server: {
    // iosScheme configura o scheme do WebView local (default: capacitor)
    iosScheme: 'capacitor',
    errorPath: '/offline-fallback.html',
  },

  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    allowsLinkPreview: false,

    // Only enable for dev builds — MUST be false for App Store submission
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

    // Splash screen nativa — supports dark mode
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      launchFadeOutDuration: 300,
      showSpinner: false,
      // Dark mode: iOS uses LaunchScreen.storyboard which respects
      // system appearance. Configure in Xcode after `cap add ios`.
      // For the WebView splash, these colors apply to light mode.
      // Dark mode background is set via LaunchScreen.storyboard.
    },

    // Keyboard behavior
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
