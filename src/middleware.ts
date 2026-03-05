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

/** CSRF: Reject cross-origin mutating requests to /api (defense-in-depth). */
function checkCsrf(request: NextRequest): NextResponse | null {
  const { method, headers } = request;

  // Only check mutating methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  // Allow Vercel Cron (no Origin header, but has cron secret)
  if (request.nextUrl.pathname.startsWith("/api/cron")) return null;

  // Allow external integrations that authenticate via API key
  if (request.nextUrl.pathname.startsWith("/api/integrations")) return null;

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
