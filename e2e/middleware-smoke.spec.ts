import { test, expect } from "@playwright/test";

/**
 * Middleware smoke tests — validates auth guards, CSRF, cache headers, and cookie security.
 * These are the tests that vitest route-level tests cannot cover (framework integration).
 *
 * Run: npx playwright test e2e/middleware-smoke.spec.ts
 * Requires: dev server running on localhost:3000 (or E2E_BASE_URL env var)
 */

// ─── Auth Guards ─────────────────────────────────────────────────────────────

test.describe("Protected path redirection", () => {
  test("unauthenticated user on /hoje → redirect to /login", async ({ page }) => {
    const res = await page.goto("/hoje");
    expect(page.url()).toContain("/login");
    // Should be a client redirect via Next.js middleware
    expect(res?.status()).toBeLessThan(400);
  });

  test("unauthenticated user on /checkin → redirect to /login", async ({ page }) => {
    await page.goto("/checkin");
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user on /insights → redirect to /login", async ({ page }) => {
    await page.goto("/insights");
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user on /conta → redirect to /login", async ({ page }) => {
    await page.goto("/conta");
    expect(page.url()).toContain("/login");
  });

  test("/sos is always public (never redirected)", async ({ page }) => {
    const res = await page.goto("/sos");
    expect(page.url()).toContain("/sos");
    expect(res?.status()).toBe(200);
  });

  test("/login is accessible without auth", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain("/login");
  });

  test("/cadastro is accessible without auth", async ({ page }) => {
    const res = await page.goto("/cadastro");
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain("/cadastro");
  });
});

// ─── CSRF Protection ─────────────────────────────────────────────────────────

test.describe("CSRF enforcement on API routes", () => {
  test("POST to /api/auth/login without CSRF headers → 403", async ({ request }) => {
    // Simulate cross-origin request: no Sec-Fetch-Site, no Origin, no Referer
    const res = await request.post("/api/auth/login", {
      data: { email: "test@test.com", senha: "12345678" },
      headers: { "Content-Type": "application/json" },
    });
    // Middleware should block: either CSRF cookie missing or cross-origin detection
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("GET requests are exempt from CSRF check", async ({ request }) => {
    // GET /api/health should work without CSRF (if it exists; otherwise any GET API)
    const res = await request.get("/api/health");
    // Should not be 403 (CSRF block) — may be 404 if route doesn't exist, but not CSRF
    expect(res.status()).not.toBe(403);
  });
});

// ─── Cache Headers ──────────────────────────────────────────────────────────

test.describe("Cache-Control headers", () => {
  test("authenticated API endpoints have no-store", async ({ page }) => {
    // Navigate to login page first to get CSRF cookie, then make API call
    await page.goto("/login");

    // Use page.evaluate to make a same-origin fetch (bypasses Playwright's cross-origin)
    const cacheControl = await page.evaluate(async () => {
      const csrfCookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith("__Host-csrf="))
        ?.split("=")[1];

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfCookie ? { "x-csrf-token": csrfCookie } : {}),
        },
        body: JSON.stringify({ email: "nobody@test.com", senha: "12345678" }),
      });
      return res.headers.get("cache-control");
    });

    // Even failed auth requests should have no-store (middleware sets it for all non-public API)
    expect(cacheControl).toContain("no-store");
  });
});

// ─── CSRF Cookie ────────────────────────────────────────────────────────────

test.describe("CSRF cookie attributes", () => {
  test("__Host-csrf cookie is set on page load", async ({ page }) => {
    await page.goto("/login");
    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find((c) => c.name === "__Host-csrf");

    expect(csrfCookie).toBeTruthy();
    // __Host- prefix requires: Secure=true, Path=/, no Domain
    expect(csrfCookie!.secure).toBe(true);
    expect(csrfCookie!.path).toBe("/");
    // Should NOT be httpOnly (client JS needs to read it for double-submit)
    expect(csrfCookie!.httpOnly).toBe(false);
  });
});

// ─── SOS Always Public ──────────────────────────────────────────────────────

test.describe("SOS crisis page availability", () => {
  test("/sos loads without auth and returns 200", async ({ page }) => {
    const res = await page.goto("/sos");
    expect(res?.status()).toBe(200);
    // Verify it actually rendered content (not a redirect page)
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
