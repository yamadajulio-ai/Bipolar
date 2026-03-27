"use client";

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Google Analytics 4 — funil completo de ad click → landing → cadastro.
 * Carrega apenas se NEXT_PUBLIC_GA_ID estiver definido.
 * Integra nativamente com Microsoft Clarity.
 */
export function GoogleAnalytics() {
  // Block marketing trackers inside Capacitor WebView (Apple App Store compliance)
  if (!GA_ID || (typeof window !== "undefined" && "Capacitor" in window)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
              anonymize_ip: true
            });
          `,
        }}
      />
    </>
  );
}

/* ── Helpers para eventos customizados ─────────────────────────────── */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Dispara evento de cadastro iniciado */
export function gaTrackSignUpStart() {
  if (typeof window !== "undefined" && window.gtag && !("Capacitor" in window)) {
    window.gtag("event", "sign_up_start", { method: "email" });
  }
}

/** Dispara evento de cadastro concluído */
export function gaTrackSignUpComplete(method: "email" | "google" = "email") {
  if (typeof window !== "undefined" && window.gtag && !("Capacitor" in window)) {
    window.gtag("event", "sign_up", { method });
  }
}
