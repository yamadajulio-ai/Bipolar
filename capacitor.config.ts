import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suportebipolar.app',
  appName: 'Suporte Bipolar',
  webDir: 'out',

  // B+ strategy: WebView loads Vercel, native plugins add real value.
  // Native value: biometric lock, APNs push, local notifications, offline crisis,
  // haptic feedback, deep links, native share — justifies Guideline 4.2.
  server: {
    url: 'https://suportebipolar.com',
    cleartext: false,
    allowNavigation: ['suportebipolar.com', '*.suportebipolar.com'],
    // When WebView fails to load (offline), Capacitor shows webDir fallback.
    // out/index.html redirects to offline-fallback.html with crisis resources.
    errorPath: '/offline-fallback.html',
  },

  ios: {
    scheme: 'Suporte Bipolar',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    allowsLinkPreview: false,

    // Only enable for dev builds — MUST be false for App Store submission
    webContentsDebuggingEnabled: false,

    // Info.plist entries injected by Capacitor on sync
    // These appear under ios/App/App/Info.plist after `npx cap sync ios`
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
