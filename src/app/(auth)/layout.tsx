import { MetaPixel } from "@/components/MetaPixel";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-white">Pular para conteúdo</a>
      <MetaPixel />
      <MicrosoftClarity />
      <GoogleAnalytics />
      <MedicalDisclaimer />
      <div id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </div>
    </>
  );
}
