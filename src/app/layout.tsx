import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
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
};

export const metadata: Metadata = {
  title: "Rede Bipolar — Juntos pelo equilíbrio",
  description:
    "Seu painel de estabilidade: rotina, sono, humor, finanças e corpo. Ferramentas para pessoas com Transtorno Afetivo Bipolar e suas famílias.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rede Bipolar",
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
    url: "https://redebipolar.com",
    siteName: "Rede Bipolar",
    title: "Rede Bipolar — Seu painel de estabilidade",
    description:
      "Rotina, sono, humor, finanças e corpo em um só lugar. Feito para quem vive com Transtorno Afetivo Bipolar.",
    images: [
      {
        url: "https://redebipolar.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Rede Bipolar — Juntos pelo equilíbrio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rede Bipolar — Seu painel de estabilidade",
    description:
      "Rotina, sono, humor, finanças e corpo em um só lugar. Feito para quem vive com Transtorno Afetivo Bipolar.",
    images: ["https://redebipolar.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://redebipolar.com",
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
              name: "Rede Bipolar",
              url: "https://redebipolar.com",
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
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
