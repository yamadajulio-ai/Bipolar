/**
 * Deep links and share functionality via Capacitor.
 * Handles Universal Links (iOS) and native share sheet.
 */
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { isNative } from './platform';

/** Register deep link handler for Universal Links. Returns cleanup function. */
export function registerDeepLinkHandler(
  navigate: (path: string) => void
): (() => void) | undefined {
  if (!isNative()) return undefined;

  const ALLOWED_HOSTS = new Set(['suportebipolar.com', 'www.suportebipolar.com']);

  const handle = CapApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url);
      const isCustomScheme = url.protocol === 'suportebipolar:';
      const isTrustedHost = ALLOWED_HOSTS.has(url.hostname);
      if (!isCustomScheme && !isTrustedHost) return;

      // OAuth bridge: callback redirects to suportebipolar://auth-success?token=...
      // We bounce through /api/auth/native-session so the iron-session cookie is
      // set on the WebView's cookie jar (Safari's is isolated). Use a hard
      // navigation because Next's router can't hit an API route, and close
      // Safari in case iOS left it open when handing the URL to the app.
      if (isCustomScheme && url.hostname === 'auth-success') {
        const token = url.searchParams.get('token');
        import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => {});
        if (token) {
          window.location.href = `/api/auth/native-session?token=${encodeURIComponent(token)}`;
        } else {
          navigate('/login?error=no_token');
        }
        return;
      }

      if (isCustomScheme && url.hostname === 'auth-error') {
        const error = url.searchParams.get('error') || 'google_login_failed';
        import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => {});
        navigate(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      const path = url.pathname + url.search;
      if (path.startsWith('/')) {
        navigate(path);
      }
    } catch {
      // Invalid URL — ignore
    }
  });

  return () => { handle.then(h => h.remove()); };
}

/** Handle app state changes (resume from background). Returns cleanup function. */
export function onAppStateChange(
  callback: (isActive: boolean) => void
): (() => void) | undefined {
  if (!isNative()) return undefined;

  const handle = CapApp.addListener('appStateChange', (state) => {
    callback(state.isActive);
  });

  return () => { handle.then(h => h.remove()); };
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
