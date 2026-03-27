"use client";

import Script from "next/script";

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

/**
 * Microsoft Clarity — heatmaps, gravação de sessões e rage click detection.
 * Carrega apenas se NEXT_PUBLIC_CLARITY_ID estiver definido.
 * Completamente gratuito, sem limite de sessões.
 */
export function MicrosoftClarity() {
  // Block marketing trackers inside Capacitor WebView (Apple App Store compliance)
  if (!CLARITY_ID || (typeof window !== "undefined" && "Capacitor" in window)) return null;

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");
        `,
      }}
    />
  );
}
