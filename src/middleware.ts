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

/** Match exact path or path segment (prevents /app matching /apple-app-site-association) */
function matchesPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Professional access tokens: 24 random bytes → base64url = exactly 32 chars */
const PROFESSIONAL_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

function isProfessionalAccessCsrfExempt(pathname: string): boolean {
  const prefix = "/api/acesso-profissional/";
  if (!pathname.startsWith(prefix)) return false;
  const token = pathname.slice(prefix.length);
  return PROFESSIONAL_TOKEN_RE.test(token);
}

/** CSRF: Reject cross-origin mutating requests to /api (defense-in-depth). */
function checkCsrf(request: NextRequest): NextResponse | null {
  const { method, headers } = request;
  const pathname = request.nextUrl.pathname;

  // Only check mutating methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  // Allow Vercel Cron (no Origin header, but has cron secret)
  if (pathname.match(/^\/api\/cron(\/[^/]+)?$/)) return null;

  // Allow external integrations that authenticate via API key (exact webhook endpoints)
  if (pathname === "/api/integrations/health-export" ||
      pathname === "/api/integrations/health-connect") return null;

  // Allow WhatsApp webhook (Meta verifies via verify_token)
  if (pathname === "/api/whatsapp/webhook") return null;

  // Allow professional access — token must match exact format (auth'd via token+PIN)
  if (isProfessionalAccessCsrfExempt(pathname)) return null;

  const origin = headers.get("origin");
  const referer = headers.get("referer");
  const secFetchSite = headers.get("sec-fetch-site");
  const expectedOrigin = new URL(request.url).origin;

  // Sec-Fetch-Site: browsers always send this on fetch/XHR
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "Requisição cross-origin bloqueada" }, { status: 403 });
  }

  // Origin header check (fallback for older browsers)
  if (origin && origin !== expectedOrigin) {
    return NextResponse.json({ error: "Requisição cross-origin bloqueada" }, { status: 403 });
  }

  // Fail closed: when both Sec-Fetch-Site and Origin are absent, require valid Referer
  if (!secFetchSite && !origin) {
    try {
      if (!referer || new URL(referer).origin !== expectedOrigin) {
        return NextResponse.json({ error: "Origem não verificável" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Origem não verificável" }, { status: 403 });
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

  // SOS must ALWAYS be public — never redirect, never block
  if (pathname === "/sos" || pathname.startsWith("/sos/")) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("suporte-bipolar-session") ??
    request.cookies.get("empresa-bipolar-session");

  const isProtected = protectedPaths.some((p) => matchesPath(pathname, p));
  const isAuthPage = authPaths.some((p) => matchesPath(pathname, p));

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
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|apple-app-site-association).*)"],
};
