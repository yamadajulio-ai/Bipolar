import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InAppBrowserBanner } from "@/components/InAppBrowserBanner";
import { NativeAppShell } from "@/components/capacitor/NativeAppShell";
import { MetaPixel } from "@/components/MetaPixel";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#527a6e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // iPhone notch/Dynamic Island support in PWA
};

export const metadata: Metadata = {
  title: "Suporte Bipolar — Acompanhe seus padrões de humor, sono e energia",
  description:
    "Registre humor, sono e energia em 30 segundos. Receba insights sobre seus padrões e compartilhe com seu profissional. Gratuito e seguro.",
  verification: {
    google: "AAA3yfmYp14DN--PF0B-YOf6-n80AVMzPt5igjY37Gs",
  },
  other: {
    "facebook-domain-verification": "y7ivnoop9rnuuvjc6c19dk8d4kqtj7",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Suporte Bipolar",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://suportebipolar.com",
    siteName: "Suporte Bipolar",
    title: "Suporte Bipolar — Acompanhe seus padrões de humor, sono e energia",
    description:
      "Registre humor, sono e energia em 30 segundos. Receba insights sobre seus padrões e compartilhe com seu profissional. Gratuito e seguro.",
    images: [
      {
        url: "https://suportebipolar.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Suporte Bipolar — Acompanhe seus padrões",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Suporte Bipolar — Acompanhe seus padrões de humor, sono e energia",
    description:
      "Registre humor, sono e energia em 30 segundos. Receba insights sobre seus padrões e compartilhe com seu profissional. Gratuito e seguro.",
    images: ["https://suportebipolar.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://suportebipolar.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Suporte Bipolar",
              url: "https://suportebipolar.com",
              description:
                "Ferramentas de auto-organização para pessoas com Transtorno Afetivo Bipolar",
              applicationCategory: "HealthApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "BRL",
              },
              inLanguage: "pt-BR",
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <InAppBrowserBanner />
        <NativeAppShell />
        <Analytics />
        <SpeedInsights />
        <ServiceWorkerRegister />
        <MetaPixel />
        <MicrosoftClarity />
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
