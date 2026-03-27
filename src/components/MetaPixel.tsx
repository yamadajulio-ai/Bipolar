"use client";

import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Meta Pixel (Facebook Pixel) — carrega apenas se NEXT_PUBLIC_META_PIXEL_ID estiver definido.
 * Eventos padrão: PageView (auto), ViewContent e CompleteRegistration (disparados via helpers).
 * Todos os eventos são enviados tanto pelo browser (fbq) quanto pelo server (CAPI) com
 * o mesmo event_id para deduplicação automática.
 */
export function MetaPixel() {
  // Block marketing trackers inside Capacitor WebView (Apple App Store compliance)
  if (!PIXEL_ID || (typeof window !== "undefined" && "Capacitor" in window)) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

/* ── Helpers para disparar eventos com deduplicação Pixel + CAPI ─── */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Gera ID único para deduplicação browser ↔ server */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Envia evento server-side via API route (fire-and-forget) */
function sendServerEvent(
  eventName: string,
  eventId: string,
  customData?: Record<string, string>,
): void {
  fetch("/api/meta-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      eventId,
      sourceUrl: window.location.href,
      customData,
    }),
    keepalive: true,
  }).catch(() => {
    // Silencia erros — analytics não deve impactar UX
  });
}

/** Dispara ViewContent — usar na landing page /comecar */
export function trackViewContent(data?: Record<string, string>) {
  if (typeof window === "undefined" || "Capacitor" in window) return;

  const eventId = generateEventId();

  // Browser-side
  if (window.fbq) {
    window.fbq("track", "ViewContent", data, { eventID: eventId });
  }

  // Server-side (CAPI)
  sendServerEvent("ViewContent", eventId, data);
}

/** Dispara CompleteRegistration — usar após cadastro concluído */
export function trackCompleteRegistration() {
  if (typeof window === "undefined" || "Capacitor" in window) return;

  const eventId = generateEventId();

  // Browser-side
  if (window.fbq) {
    window.fbq("track", "CompleteRegistration", {}, { eventID: eventId });
  }

  // Server-side (CAPI)
  sendServerEvent("CompleteRegistration", eventId);
}
