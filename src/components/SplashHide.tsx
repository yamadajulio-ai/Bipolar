"use client";

import { useEffect } from "react";

/**
 * Hides the native Capacitor splash screen once React has hydrated.
 * Uses dynamic imports to avoid crashes on web/SSR where Capacitor
 * modules are not available.
 */
export function SplashHide() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          await SplashScreen.hide();
        }
      } catch {
        // Module not available (web/SSR) — safe to ignore
      }
    })();
  }, []);

  return null;
}
