'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  isNative,
  isIOS,
  verifyBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  registerPushNotifications,
  onPushActionPerformed,
  registerDeepLinkHandler,
  onAppStateChange,
} from '@/lib/capacitor';
import { setupDefaultReminders } from '@/lib/capacitor/notifications';
import { hapticMedium } from '@/lib/capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

/**
 * NativeAppShell — initializes all native capabilities when running in Capacitor.
 * Renders nothing visible unless biometric lock is active.
 * Handles biometric lock, push registration, deep links, status bar.
 * Must be mounted once in the root layout.
 */
export function NativeAppShell() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const initRef = useRef(false);
  const biometricPending = useRef(false);
  const failCount = useRef(0);

  const handleBiometricCheck = useCallback(async () => {
    if (biometricPending.current) return; // debounce concurrent calls
    biometricPending.current = true;
    try {
      const { available } = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();

      if (available && enabled) {
        setLocked(true);
        const verified = await verifyBiometric();
        if (verified) {
          failCount.current = 0;
          setLocked(false);
          hapticMedium();
        } else {
          failCount.current += 1;
          // After 3 failed attempts (biometric + passcode fallback), force logout
          if (failCount.current >= 3) {
            failCount.current = 0;
            setLocked(false);
            try {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
            } catch {
              // Logout API failure — redirect anyway
            }
            window.location.href = '/login';
          }
        }
      }
    } catch {
      // Plugin failure — don't block the user, unlock gracefully
      setLocked(false);
    } finally {
      biometricPending.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (!isNative() || initRef.current) return;
    initRef.current = true;

    // ── Status Bar ──
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    // setBackgroundColor is Android-only — skip on iOS
    if (!isIOS()) {
      StatusBar.setBackgroundColor({ color: '#527a6e' }).catch(() => {});
    }

    // ── Keyboard ──
    Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});

    // ── Biometric lock on launch ──
    handleBiometricCheck();

    // ── Re-lock on app resume ──
    const stateCleanup = onAppStateChange((isActive) => {
      if (isActive) {
        handleBiometricCheck();
      }
    });

    // ── Push notifications ──
    // Only register if permission was already granted (no prompt on bootstrap).
    // First-time permission is requested contextually after first check-in.
    import('@capacitor/push-notifications').then(({ PushNotifications }) =>
      PushNotifications.checkPermissions().then((result) => {
        if (result.receive === 'granted') {
          registerPushNotifications().then((token) => {
            if (token) {
              fetch('/api/push-subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'apns', token }),
              }).catch(() => {});
            }
          }).catch(() => {});

          // Local notifications only after permission is already granted
          setupDefaultReminders().catch(() => {});
        }
      }).catch(() => {})
    ).catch(() => {});

    // ── Deep links (router.push guarded against invalid paths) ──
    const deepLinkCleanup = registerDeepLinkHandler((path) => {
      try {
        router.push(path);
      } catch {
        // Invalid route — ignore
      }
    });

    // ── Handle push tap → navigate (guarded) ──
    const pushActionCleanup = onPushActionPerformed((data) => {
      try {
        const path = data?.path as string | undefined;
        if (path && path.startsWith('/')) {
          router.push(path);
        }
      } catch {
        // Invalid path from push payload — ignore
      }
    });

    // ── Cleanup all listeners on unmount ──
    return () => {
      stateCleanup?.();
      deepLinkCleanup?.();
      pushActionCleanup?.();
    };
  }, [router, handleBiometricCheck]);

  // ── Biometric lock screen (Tailwind + dark mode) ──
  if (locked) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-4 bg-primary text-white dark:bg-[#1a3d34]">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2 className="text-xl font-semibold">
          Suporte Bipolar
        </h2>
        <p className="max-w-[280px] text-center text-sm opacity-80">
          Use biometria para desbloquear seus dados de saúde
        </p>
        <button
          onClick={handleBiometricCheck}
          className="mt-4 rounded-lg border-2 border-white bg-transparent px-8 py-3 text-base font-medium text-white transition-colors active:bg-white/20"
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          Desbloquear
        </button>
      </div>
    );
  }

  return null;
}
