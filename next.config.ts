import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

// unsafe-eval is required in dev for Next.js hot reload / React Fast Refresh.
// In production, only unsafe-inline remains (needed by third-party scripts like
// Google Tag Manager and Clarity that inject inline scripts).
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://connect.facebook.net https://www.clarity.ms https://www.googletagmanager.com"
  : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://connect.facebook.net https://www.clarity.ms https://www.googletagmanager.com";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  scriptSrc,
  "connect-src 'self' https://*.googleapis.com https://accounts.google.com https://*.sentry.io https://*.ingest.sentry.io https://connect.facebook.net https://www.facebook.com https://www.clarity.ms https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "block-all-mixed-content",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/ferramentas/calculadora-jet-lag",
        destination: "/ferramentas/regularidade-do-sono",
        permanent: true,
      },
      {
        source: "/planejador",
        destination: "/agenda-rotina",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "yamada-ai",
  project: "rede-bipolar",
  silent: true,
  disableLogger: true,
});
