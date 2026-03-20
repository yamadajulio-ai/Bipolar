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
      <MetaPixel />
      <MicrosoftClarity />
      <GoogleAnalytics />
      {children}
    </>
  );
}
