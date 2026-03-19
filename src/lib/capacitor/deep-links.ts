/**
 * Deep links and share functionality via Capacitor.
 * Handles Universal Links (iOS) and native share sheet.
 */
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { isNative } from './platform';

/** Register deep link handler for Universal Links */
export function registerDeepLinkHandler(
  navigate: (path: string) => void
): void {
  if (!isNative()) return;

  CapApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url);
      const path = url.pathname + url.search;
      navigate(path);
    } catch {
      // Invalid URL — ignore
    }
  });
}

/** Handle app state changes (resume from background) */
export function onAppStateChange(
  callback: (isActive: boolean) => void
): void {
  if (!isNative()) return;

  CapApp.addListener('appStateChange', (state) => {
    callback(state.isActive);
  });
}

/** Native share sheet */
export async function shareContent(options: {
  title: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  if (!isNative()) {
    // Fallback to Web Share API
    if (navigator.share) {
      try {
        await navigator.share(options);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: 'Compartilhar',
    });
    return true;
  } catch {
    return false;
  }
}

/** Quick share presets for the app */
export const SHARE_PRESETS = {
  crisisContacts: {
    title: 'Contatos de Emergência',
    text: 'CVV: 188 (24h) | SAMU: 192 | Suporte Bipolar: suportebipolar.com',
  },
  inviteFriend: {
    title: 'Suporte Bipolar',
    text: 'Conhece o Suporte Bipolar? Um app gratuito para monitorar humor, sono e rotina. Ajuda muito no dia a dia.',
    url: 'https://suportebipolar.com',
  },
  weeklyReport: (period: string) => ({
    title: `Meu relatório semanal — ${period}`,
    text: `Confira meu progresso no Suporte Bipolar (${period}). O app me ajuda a monitorar padrões e manter a rotina.`,
    url: 'https://suportebipolar.com/insights',
  }),
} as const;
