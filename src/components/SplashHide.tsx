"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * Hides the native Capacitor splash screen once React has hydrated.
 * Placed in the root layout so the splash stays visible until the
 * first meaningful paint, avoiding the white-screen flash.
 */
export function SplashHide() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }, []);

  return null;
}
