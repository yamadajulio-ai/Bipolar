'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  isNative,
  verifyBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  registerPushNotifications,
  onPushActionPerformed,
  registerDeepLinkHandler,
  onAppStateChange,
} from '@/lib/capacitor';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

/**
 * NativeAppShell — initializes all native capabilities when running in Capacitor.
 * Renders nothing visible; handles biometric lock, push registration, deep links.
 * Must be mounted once in the root layout.
 */
export function NativeAppShell() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);

  const handleBiometricCheck = useCallback(async () => {
    const { available } = await isBiometricAvailable();
    const enabled = await isBiometricEnabled();

    if (available && enabled) {
      setLocked(true);
      const verified = await verifyBiometric();
      if (verified) {
        setLocked(false);
      }
      // If not verified, stays locked — user must retry
    }
  }, []);

  useEffect(() => {
    if (!isNative()) return;

    // ── Status Bar ──
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#527a6e' }).catch(() => {});

    // ── Keyboard ──
    Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});

    // ── Biometric lock on launch ──
    handleBiometricCheck();

    // ── Re-lock on app resume ──
    onAppStateChange((isActive) => {
      if (isActive) {
        handleBiometricCheck();
      }
    });

    // ── Push notifications ──
    registerPushNotifications().then((token) => {
      if (token) {
        // Send APNs token to our backend for native push
        fetch('/api/push-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'apns', token }),
        }).catch(() => {});
      }
    });

    // ── Deep links ──
    registerDeepLinkHandler((path) => {
      router.push(path);
    });

    // ── Handle push tap → navigate ──
    onPushActionPerformed((data) => {
      const path = data?.path as string | undefined;
      if (path) {
        router.push(path);
      }
    });
  }, [router, handleBiometricCheck]);

  // ── Biometric lock screen ──
  if (locked) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          backgroundColor: '#527a6e',
          color: 'white',
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          Suporte Bipolar
        </h2>
        <p style={{ fontSize: '0.875rem', opacity: 0.8, textAlign: 'center', maxWidth: '280px' }}>
          Use biometria para desbloquear seus dados de saúde
        </p>
        <button
          onClick={handleBiometricCheck}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 2rem',
            borderRadius: '0.5rem',
            border: '2px solid white',
            backgroundColor: 'transparent',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Desbloquear
        </button>
      </div>
    );
  }

  return null;
}
