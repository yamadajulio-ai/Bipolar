import { MetaPixel } from "@/components/MetaPixel";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

/**
 * Auth pages layout (login, cadastro, recuperar-senha).
 * Includes marketing analytics for funnel tracking.
 * These trackers are excluded from the authenticated (app) area.
 */
export default function AuthLayout({
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
