import { NextRequest, NextResponse } from "next/server";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  validateCsrfToken,
} from "@/lib/security";

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
  // Previously missing — all (app) routes that require auth
  "/avaliacao-semanal",
  "/meu-diario",
  "/consentimentos",
  "/onboarding",
  "/cognitivo",
  "/life-chart",
  "/circadiano",
  "/como-usar",
  "/perfil",
  "/acesso-profissional",
  "/feedback",
  "/medicamentos",
  "/admin",
];
const authPaths = ["/login", "/cadastro"];
// Paths that should redirect logged-in users to /hoje (landing pages)
const landingPaths = ["/", "/comecar"];

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

  // Allow external integrations that authenticate via API key (webhook endpoints + sub-paths)
  if (pathname.startsWith("/api/integrations/health-export") ||
      pathname.startsWith("/api/integrations/health-connect")) return null;

  // Allow WhatsApp webhook (Meta verifies via verify_token)
  if (pathname === "/api/whatsapp/webhook") return null;

  // Allow logout via native form POST (no X-CSRF-Token header).
  // Protected by Sec-Fetch-Site same-origin check + session cookie.
  if (pathname === "/api/auth/logout") return null;

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

  // Layer 2: Double-submit cookie validation (defense-in-depth)
  // Cookie is set on every response; client must echo it in X-CSRF-Token header.
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = headers.get(CSRF_HEADER_NAME);
  if (!validateCsrfToken(csrfCookie, csrfHeader)) {
    return NextResponse.json({ error: "Token CSRF inválido" }, { status: 403 });
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

  // Admin pages: no-store, never cache (LGPD P0)
  if (pathname.startsWith("/admin")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return ensureCsrfCookie(request, response);
  }

  // API routes: CSRF check + no-store for authenticated endpoints
  if (pathname.startsWith("/api/")) {
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    // Public API endpoints that may be cached (health check, webhooks)
    const publicApiPaths = ["/api/health", "/api/whatsapp/webhook", "/api/meta-events"];
    const isPublicApi = publicApiPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

    if (!isPublicApi) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "no-store, private, max-age=0");
      return response;
    }

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

  return ensureCsrfCookie(request, NextResponse.next());
}

/**
 * Ensure CSRF cookie is present on every response.
 * Uses __Host- prefix (Secure, no Domain, Path=/).
 * Cookie is SameSite=Lax and NOT httpOnly so client JS can read it
 * and echo it in X-CSRF-Token header on mutating requests.
 */
function ensureCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!existingToken) {
    const token = generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      path: "/",
      secure: true,
      sameSite: "lax",
      httpOnly: false, // Client JS must read this to send in header
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|apple-app-site-association).*)"],
};
