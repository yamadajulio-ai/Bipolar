import { MetaPixel } from "@/components/MetaPixel";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

/**
 * Public pages layout — includes marketing analytics (Pixel, Clarity, GA4).
 * These trackers are intentionally excluded from the authenticated (app) area
 * to protect clinical data privacy (LGPD + GPT Pro audit recommendation).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-white">Pular para conteúdo</a>
      <MetaPixel />
      <MicrosoftClarity />
      <GoogleAnalytics />
      <div id="main-content" tabIndex={-1} className="outline-none">{children}</div>
    </>
  );
}
