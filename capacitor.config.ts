import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suportebipolar.app',
  appName: 'Suporte Bipolar',
  webDir: 'out',

  // Production: WebView loads from Vercel (SSR app requires server).
  // 9 native pillars (Face ID, APNs, biometric, offline crisis, deep links,
  // share, haptics, Sign in with Apple, voice SOS) satisfy Guideline 4.2.
  server: {
    url: 'https://suportebipolar.com',
    iosScheme: 'https',
    hostname: 'suportebipolar.com',
    errorPath: '/offline-fallback.html',
  },

  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    allowsLinkPreview: false,

    // MUST be false for App Store submission — only true in dev
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
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
