import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  validateCsrfToken,
} from "@/lib/security";

/** Minimal session type for middleware (avoids importing auth.ts which pulls in argon2/bcrypt) */
interface MiddlewareSessionData {
  isLoggedIn?: boolean;
  onboarded?: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "suporte-bipolar-session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  },
};

/** API paths exempt from onboarded check (auth flows, webhooks, public endpoints) */
const ONBOARD_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/cron/",
  "/api/native/",
  "/api/integrations/",
  "/api/whatsapp/",
  "/api/acesso-profissional/",
  "/api/sos/",
];
const ONBOARD_EXEMPT_EXACT = [
  "/api/health",
  "/api/meta-events",
  "/api/consentimentos",
  "/api/display-preferences",
  "/api/safety-screening",
  "/api/sos", // SOS must always be accessible — crisis endpoint (prefix "/api/sos/" already in PREFIXES)
];

const protectedPaths = [
  "/app",
  "/hoje",
  "/agenda-rotina",
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
  const rest = pathname.slice(prefix.length);
  // Match token directly or token/subpath (e.g. token/notas)
  const token = rest.split("/")[0];
  return PROFESSIONAL_TOKEN_RE.test(token);
}

/** CSRF: Reject cross-origin mutating requests to /api (defense-in-depth). */
async function checkCsrf(request: NextRequest): Promise<NextResponse | null> {
  const { method, headers } = request;
  const pathname = request.nextUrl.pathname;

  // Only check mutating methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  // Native app endpoints: auth via Bearer token, no CSRF needed.
  // CSRF is a browser-cookie problem; native uses explicit Authorization header.
  if (pathname.startsWith("/api/native/")) return null;

  // Allow Vercel Cron (no Origin header, but has cron secret)
  if (pathname.match(/^\/api\/cron(\/[^/]+)?$/)) return null;

  // Allow external integrations that authenticate via API key (webhook endpoints + sub-paths)
  if (pathname.startsWith("/api/integrations/health-export") ||
      pathname.startsWith("/api/integrations/health-connect")) return null;

  // Allow WhatsApp webhook (Meta verifies via verify_token)
  if (pathname === "/api/whatsapp/webhook") return null;

  // Allow Postmark inbound email webhook (verified via POSTMARK_INBOUND_TOKEN)
  if (pathname === "/api/financeiro/inbound-email") return null;

  // Allow Pluggy webhook (verified via item ownership)
  if (pathname === "/api/financeiro/pluggy/webhook") return null;

  // Allow Apple OAuth callback — Apple sends form_post from their servers (cross-origin).
  // Protected by state cookie (CSRF), same pattern as Google OAuth callback.
  if (pathname === "/api/auth/apple-login/callback") return null;

  // Allow professional access — token must match exact format (auth'd via token+PIN)
  if (isProfessionalAccessCsrfExempt(pathname)) return null;

  const origin = headers.get("origin");
  const referer = headers.get("referer");
  const secFetchSite = headers.get("sec-fetch-site");
  const expectedOrigin = new URL(request.url).origin;

  // Sec-Fetch-Site: browsers always send this on fetch/XHR
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    console.warn("[CSRF] cross-origin blocked", { pathname, secFetchSite, origin });
    return NextResponse.json({ error: "Requisição cross-origin bloqueada" }, { status: 403 });
  }

  // Origin header check (fallback for older browsers)
  if (origin && origin !== expectedOrigin) {
    console.warn("[CSRF] origin mismatch", { pathname, origin, expected: expectedOrigin });
    return NextResponse.json({ error: "Requisição cross-origin bloqueada" }, { status: 403 });
  }

  // Fail closed: when both Sec-Fetch-Site and Origin are absent, require valid Referer
  if (!secFetchSite && !origin) {
    try {
      if (!referer || new URL(referer).origin !== expectedOrigin) {
        console.warn("[CSRF] unverifiable origin", { pathname, referer: referer ?? "none" });
        return NextResponse.json({ error: "Origem não verificável" }, { status: 403 });
      }
    } catch {
      console.warn("[CSRF] unverifiable origin (malformed referer)", { pathname });
      return NextResponse.json({ error: "Origem não verificável" }, { status: 403 });
    }
  }

  // Layer 2: Double-submit cookie validation (defense-in-depth)
  // Cookie is set on every response; client must echo it in X-CSRF-Token header.
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = headers.get(CSRF_HEADER_NAME);
  if (!(await validateCsrfToken(csrfCookie, csrfHeader))) {
    console.warn("[CSRF] token validation failed", { pathname, hasCookie: !!csrfCookie, hasHeader: !!csrfHeader });
    return NextResponse.json({ error: "Token CSRF inválido" }, { status: 403 });
  }

  return null;
}

// Legacy domains that should redirect to the canonical domain
const LEGACY_HOSTS = ["redebipolar.com", "www.redebipolar.com", "redebipolar.com.br", "www.redebipolar.com.br"];
const CANONICAL_ORIGIN = "https://suportebipolar.com";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect legacy domains to canonical domain (301 permanent)
  const host = request.headers.get("host")?.toLowerCase().replace(/:.*$/, "");
  if (host && LEGACY_HOSTS.includes(host)) {
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${request.nextUrl.search}`, 301);
  }

  // API routes: CSRF check + onboarded gate + no-store for authenticated endpoints
  if (pathname.startsWith("/api/")) {
    const csrfResponse = await checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    // Onboarded gate: block pre-onboarding users from data-writing API routes.
    // Without this, social login users who haven't completed onboarding (no LGPD consent)
    // could access API routes directly and write health data.
    const isExempt =
      ONBOARD_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p)) ||
      ONBOARD_EXEMPT_EXACT.some((p) => pathname === p);

    if (!isExempt) {
      const response = NextResponse.next();
      const session = await getIronSession<MiddlewareSessionData>(request, response, sessionOptions);
      if (session.isLoggedIn && !session.onboarded) {
        return NextResponse.json(
          { error: "Complete o onboarding antes de acessar esta funcionalidade." },
          { status: 403 },
        );
      }
    }

    // Public API endpoints that may be cached (health check, webhooks)
    const publicApiPaths = ["/api/health", "/api/whatsapp/webhook", "/api/meta-events", "/api/financeiro/inbound-email", "/api/financeiro/pluggy/webhook"];
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

  // Professional viewer routes: authenticated via professional session cookie (not user session).
  // No-store headers required (sensitive patient data). Don't fall into protectedPaths check.
  if (pathname.startsWith("/profissional/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, private, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return await ensureCsrfCookie(request, response);
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

  // Admin pages: no-store, never cache (LGPD P0)
  // Placed AFTER session check — /admin is in protectedPaths, so unauthenticated users
  // are already redirected to /login above. This block only applies cache headers.
  if (pathname.startsWith("/admin")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return await ensureCsrfCookie(request, response);
  }

  return await ensureCsrfCookie(request, NextResponse.next());
}

/**
 * Ensure CSRF cookie is present on every response.
 * Uses __Host- prefix (Secure, no Domain, Path=/).
 * Cookie is SameSite=Lax and NOT httpOnly so client JS can read it
 * and echo it in X-CSRF-Token header on mutating requests.
 */
async function ensureCsrfCookie(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  // Replace missing or legacy (non-HMAC) tokens with new HMAC-signed format
  const needsNewToken = !existingToken || !existingToken.includes(".");
  if (needsNewToken) {
    const token = await generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: false, // Client JS must read this to send in header
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|apple-app-site-association|offline-fallback\\.html|\\.well-known).*)"],
};
