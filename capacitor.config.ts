import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suportebipolar.app',
  appName: 'Suporte Bipolar',
  webDir: 'out',
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
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#527a6e',
    },
  },
};

export default config;
