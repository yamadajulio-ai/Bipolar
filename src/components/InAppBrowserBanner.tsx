"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const DISMISS_KEY = "inapp-browser-dismissed";

/**
 * Detects Instagram, Facebook, TikTok and other in-app browsers on iOS.
 * Shows a banner instructing the user to open the link in Safari,
 * since PWA installation and some features don't work in webviews.
 */
export function InAppBrowserBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Capacitor IS a webview — don't show this banner inside the native app
    if (Capacitor.isNativePlatform()) return;
    if (!isInAppBrowser()) return;

    // Check if user already dismissed
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    setShow(true);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-[var(--shadow-raised)] safe-top dark:bg-amber-950/90 dark:border-amber-700">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <span className="mt-0.5 text-xl shrink-0" aria-hidden="true">⚠️</span>
        <div className="flex-1 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Abra no Safari para a melhor experiência</p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            Você está em um navegador interno (Instagram/Facebook). Para instalar o app e usar todos os recursos:
          </p>
          <ol className="mt-1.5 ml-4 list-decimal text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
            <li>
              Toque nos <strong>três pontos</strong> (⋯) no canto superior
            </li>
            <li>
              Selecione <strong>&quot;Abrir no navegador&quot;</strong> ou <strong>&quot;Abrir no Safari&quot;</strong>
            </li>
          </ol>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
          aria-label="Fechar aviso"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Detect in-app browsers (Instagram, Facebook, TikTok, LinkedIn, etc.)
 * These browsers don't support PWA install and have limited functionality.
 */
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Instagram: FBAN/FBAV, Facebook: FB_IAB/FBAN, TikTok: BytedanceWebview,
  // LinkedIn: LinkedInApp, Line: Line/, Twitter: Twitter
  return /FBAN|FBAV|Instagram|FB_IAB|BytedanceWebview|LinkedInApp|Line\/|Twitter/i.test(ua);
}
