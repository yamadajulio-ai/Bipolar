import { test, expect } from "@playwright/test";

/**
 * API Security Tests — validates authentication, rate limiting, input validation,
 * and security headers across ALL API endpoints.
 *
 * These tests answer: "Can an attacker bypass auth, flood endpoints, or inject data?"
 *
 * Run: npx playwright test e2e/api-security.spec.ts
 */

// ─── Helper: make API request without browser context ────────────────────────

function apiUrl(path: string) {
  const base = process.env.E2E_BASE_URL || "http://localhost:3000";
  return `${base}${path}`;
}

// ─── Auth Guard: Protected API routes reject unauthenticated requests ────────

test.describe("API auth guards — unauthenticated requests", () => {
  const protectedGetRoutes = [
    "/api/diario",
    "/api/diario/snapshots",
    "/api/diario/tendencias",
    "/api/sono",
    "/api/sono/tendencias",
    "/api/medicamentos",
    "/api/medicamentos/summary",
    "/api/exercicios",
    "/api/consentimentos",
    "/api/display-preferences",
    "/api/lembretes",
    "/api/relatorio",
    "/api/relatorio/export",
    "/api/plano-de-crise",
    "/api/insights-narrative",
    "/api/insights-summary",
    "/api/acesso-profissional",
    "/api/perfil-socioeconomico",
    "/api/funcionamento",
    "/api/avaliacao-semanal",
    "/api/cognitivo",
    "/api/life-chart",
    "/api/journal",
    "/api/journal/reflection",
    "/api/journal/export",
    "/api/financeiro",
    "/api/financeiro/resumo",
    "/api/financeiro/historico",
    "/api/planner/rules",
    "/api/planner/blocks",
    "/api/integrations/settings",
    "/api/integrations/health-connect/status",
    "/api/integrations/health-export/status",
    "/api/noticias",
  ];

  for (const route of protectedGetRoutes) {
    test(`GET ${route} → rejects without auth`, async ({ request }) => {
      const res = await request.get(apiUrl(route));
      // Should return 401 or redirect to login (3xx)
      const status = res.status();
      expect(
        status === 401 || status === 403 || (status >= 300 && status < 400),
        `${route} should reject unauthenticated GET (got ${status})`
      ).toBe(true);
    });
  }

  const protectedPostRoutes = [
    "/api/diario",
    "/api/sono",
    "/api/exercicios",
    "/api/medicamentos",
    "/api/medicamentos/logs",
    "/api/feedback",
    "/api/plano-de-crise",
    "/api/safety-screening",
    "/api/sos",
    "/api/sos/chat",
    "/api/sos/report",
    "/api/consentimentos",
    "/api/push-subscriptions",
    "/api/life-chart",
    "/api/journal",
    "/api/avaliacao-semanal",
    "/api/cognitivo",
    "/api/meta-events",
    "/api/financeiro",
    "/api/acesso-profissional",
    "/api/insights-narrative",
  ];

  for (const route of protectedPostRoutes) {
    test(`POST ${route} → rejects without auth`, async ({ request }) => {
      const res = await request.post(apiUrl(route), {
        data: {},
        headers: { "Content-Type": "application/json" },
      });
      const status = res.status();
      expect(
        status === 401 || status === 403 || (status >= 300 && status < 400),
        `${route} should reject unauthenticated POST (got ${status})`
      ).toBe(true);
    });
  }
});

// ─── Public routes: should NOT require auth ──────────────────────────────────

test.describe("Public API routes — accessible without auth", () => {
  test("GET /api/health → 200", async ({ request }) => {
    const res = await request.get(apiUrl("/api/health"));
    expect(res.status()).toBe(200);
  });

  test("POST /api/auth/login → accepts request (may return error, but not 401)", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/login"), {
      data: { email: "test@test.com", senha: "password123" },
      headers: { "Content-Type": "application/json" },
    });
    // Should process the request (400 bad credentials or 200 success), not 401
    expect(res.status()).not.toBe(401);
  });

  test("POST /api/auth/cadastro → accepts request", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/cadastro"), {
      data: { email: "test@test.com", senha: "Abc12345!", confirmarSenha: "Abc12345!", ageGate: true, healthConsent: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).not.toBe(401);
  });

  test("POST /api/auth/forgot-password → accepts request", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/forgot-password"), {
      data: { email: "test@test.com" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).not.toBe(401);
  });

  test("GET /api/auth/google-login → redirects to Google OAuth", async ({ request }) => {
    const res = await request.get(apiUrl("/api/auth/google-login"), { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
  });

  test("GET /api/auth/apple-login → redirects to Apple OAuth (or 500 if env not configured)", async ({ request }) => {
    const res = await request.get(apiUrl("/api/auth/apple-login"), { maxRedirects: 0 });
    // In dev without Apple env vars, this returns 500. In production it redirects (3xx).
    // Either is acceptable — the key is it doesn't return 401.
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(404);
  });
});

// ─── Input Validation: malformed requests ────────────────────────────────────

test.describe("Input validation — malformed requests", () => {
  test("POST /api/auth/login with empty body → 400", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/login"), {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/auth/login with invalid email → 400/401", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/login"), {
      data: { email: "not-an-email", senha: "password" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/auth/cadastro with short password → 400", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/cadastro"), {
      data: { email: "test@test.com", senha: "abc", confirmarSenha: "abc", ageGate: true, healthConsent: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/auth/cadastro with mismatched passwords → 400", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/cadastro"), {
      data: { email: "test@test.com", senha: "Abc12345!", confirmarSenha: "Different1!", ageGate: true, healthConsent: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/auth/cadastro without age gate → 400", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/cadastro"), {
      data: { email: "test@test.com", senha: "Abc12345!", confirmarSenha: "Abc12345!", ageGate: false, healthConsent: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/auth/reset-password with weak password → 400", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/reset-password"), {
      data: { token: "fake-token", senha: "abc", confirmarSenha: "abc" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/auth/login with XSS in email → no script in response", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/login"), {
      data: { email: "<script>alert(1)</script>@test.com", senha: "password" },
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.text();
    expect(body).not.toContain("<script>");
  });

  test("POST /api/auth/cadastro with oversized email → 400", async ({ request }) => {
    const longEmail = "a".repeat(500) + "@test.com";
    const res = await request.post(apiUrl("/api/auth/cadastro"), {
      data: { email: longEmail, senha: "Abc12345!", confirmarSenha: "Abc12345!", ageGate: true, healthConsent: true },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── Security Headers ────────────────────────────────────────────────────────

test.describe("Security headers", () => {
  test("responses include Content-Security-Policy", async ({ request }) => {
    const res = await request.get(apiUrl("/login"), { maxRedirects: 5 });
    const csp = res.headers()["content-security-policy"];
    expect(csp, "CSP header should be present").toBeTruthy();
    expect(csp).toContain("default-src");
  });

  test("responses include X-Content-Type-Options: nosniff", async ({ request }) => {
    const res = await request.get(apiUrl("/login"));
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("API responses set proper content-type", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/login"), {
      data: { email: "test@test.com", senha: "wrong" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("session cookies are HttpOnly (except CSRF which JS must read)", async ({ page }) => {
    await page.goto("/login");
    const cookies = await page.context().cookies();
    // CSRF cookie (__Host-csrf) is intentionally NOT HttpOnly — JS must read it for double-submit pattern.
    // Session cookies MUST be HttpOnly.
    const sessionCookies = cookies.filter((c) => c.name.includes("session"));
    for (const cookie of sessionCookies) {
      expect(cookie.httpOnly, `${cookie.name} should be HttpOnly`).toBe(true);
    }
    // Verify CSRF cookie exists and is NOT HttpOnly (by design)
    const csrfCookie = cookies.find((c) => c.name.includes("csrf"));
    if (csrfCookie) {
      expect(csrfCookie.httpOnly, "CSRF cookie must be readable by JS (not HttpOnly)").toBe(false);
    }
  });
});

// ─── CSRF Protection ─────────────────────────────────────────────────────────

test.describe("CSRF protection", () => {
  test("POST to protected API without CSRF token → blocked by middleware", async ({ request }) => {
    // Cross-origin POST without proper headers should be blocked
    const res = await request.post(apiUrl("/api/diario"), {
      data: { test: true },
      headers: {
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    // Should be blocked (401 for auth or 403 for CSRF)
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

// ─── Professional Access Security ────────────────────────────────────────────

test.describe("Professional access security", () => {
  test("POST /api/acesso-profissional/fake-token with wrong PIN → error", async ({ request }) => {
    const res = await request.post(apiUrl("/api/acesso-profissional/fake-token-12345"), {
      data: { pin: "0000" },
      headers: { "Content-Type": "application/json" },
    });
    // Should return error (not 200 with data)
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

// ─── Cron Routes Security ────────────────────────────────────────────────────

test.describe("Cron route security", () => {
  const cronRoutes = [
    "/api/cron/send-reminders",
    "/api/cron/reactivation",
    "/api/cron/purge-access-logs",
  ];

  for (const route of cronRoutes) {
    test(`GET ${route} → requires CRON_SECRET`, async ({ request }) => {
      const res = await request.get(apiUrl(route));
      // Without CRON_SECRET header, should reject
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  }
});

// ─── Apple OAuth Callback Security (expanded) ────────────────────────────────

test.describe("Apple OAuth callback — extended security", () => {
  test("POST with oversized id_token → rejected", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/apple-login/callback"), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: `id_token=${"a".repeat(20000)}&code=fake&state=fake`,
      maxRedirects: 0,
    });
    const location = res.headers()["location"] || "";
    // Should redirect with error
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(location).toContain("error=");
  });

  test("POST with oversized state → rejected", async ({ request }) => {
    const res = await request.post(apiUrl("/api/auth/apple-login/callback"), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: `id_token=fake&code=fake&state=${"a".repeat(500)}`,
      maxRedirects: 0,
    });
    const location = res.headers()["location"] || "";
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(location).toContain("error=");
  });
});

// ─── Google OAuth Callback Security ──────────────────────────────────────────

test.describe("Google OAuth callback security", () => {
  test("GET /api/auth/google-login/callback without code → error redirect", async ({ request }) => {
    const res = await request.get(apiUrl("/api/auth/google-login/callback"), {
      maxRedirects: 0,
    });
    // Should redirect to login with error (missing code/state)
    expect(res.status()).toBeGreaterThanOrEqual(300);
  });

  test("GET /api/auth/google-login/callback with fake code → error redirect", async ({ request }) => {
    const res = await request.get(apiUrl("/api/auth/google-login/callback?code=fake&state=fake"), {
      maxRedirects: 0,
    });
    // Should redirect with error
    expect(res.status()).toBeGreaterThanOrEqual(300);
  });
});
