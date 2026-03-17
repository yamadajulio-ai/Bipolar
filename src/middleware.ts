import { NextRequest, NextResponse } from "next/server";

const protectedPaths = [
  "/app",
  "/hoje",
  "/planejador",
  "/checkin",
  "/insights",
  "/mais",
  "/diario",
  "/conteudos",
  "/plano-de-crise",
  "/familias",
  "/conta",
  "/sono",
  "/exercicios",
  "/rotina",
  "/sos",
  "/sons",
  "/relatorio",
  "/cursos",
  "/integracoes",
  "/financeiro",
  "/noticias",
];
const authPaths = ["/login", "/cadastro"];
// Paths that should redirect logged-in users to /hoje (landing pages)
const landingPaths = ["/"];

/** CSRF: Reject cross-origin mutating requests to /api (defense-in-depth). */
function checkCsrf(request: NextRequest): NextResponse | null {
  const { method, headers } = request;

  // Only check mutating methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  // Allow Vercel Cron (no Origin header, but has cron secret)
  if (request.nextUrl.pathname.startsWith("/api/cron")) return null;

  // Allow external integrations that authenticate via API key
  if (request.nextUrl.pathname.startsWith("/api/integrations")) return null;

  // Allow WhatsApp webhook (Meta verifies via verify_token)
  if (request.nextUrl.pathname.startsWith("/api/whatsapp/webhook")) return null;

  // Allow professional access (public endpoint, auth'd via token+PIN)
  if (request.nextUrl.pathname.startsWith("/api/acesso-profissional/") &&
      !request.nextUrl.pathname.endsWith("/acesso-profissional")) return null;

  const origin = headers.get("origin");
  const secFetchSite = headers.get("sec-fetch-site");

  // Sec-Fetch-Site: browsers always send this on fetch/XHR
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "Requisição cross-origin bloqueada" }, { status: 403 });
  }

  // Origin header check (fallback for older browsers)
  if (origin) {
    const url = new URL(request.url);
    const expected = url.origin;
    if (origin !== expected) {
      return NextResponse.json({ error: "Requisição cross-origin bloqueada" }, { status: 403 });
    }
  }

  return null;
}

// Legacy domains that should redirect to the canonical domain
const LEGACY_HOSTS = ["redebipolar.com", "www.redebipolar.com", "redebipolar.com.br", "www.redebipolar.com.br"];
const CANONICAL_ORIGIN = "https://suportebipolar.com";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect legacy domains to canonical domain (301 permanent)
  const host = request.headers.get("host")?.toLowerCase().replace(/:.*$/, "");
  if (host && LEGACY_HOSTS.includes(host)) {
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${request.nextUrl.search}`, 301);
  }

  // CSRF check for API routes
  if (pathname.startsWith("/api/")) {
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("empresa-bipolar-session");

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL("/hoje", request.url));
  }

  // Redirect logged-in users from landing page to dashboard
  const isLanding = landingPaths.includes(pathname);
  if (isLanding && sessionCookie) {
    return NextResponse.redirect(new URL("/hoje", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
