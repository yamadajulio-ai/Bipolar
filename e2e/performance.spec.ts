import { test, expect } from "@playwright/test";

/**
 * Performance Tests — validates page load times, bundle sizes, and response times.
 *
 * These tests answer: "Is the app fast enough for a good user experience?"
 *
 * Run: npx playwright test e2e/performance.spec.ts
 */

// ─── Page Load Times ─────────────────────────────────────────────────────────

test.describe("Page load performance", () => {
  const publicPages = [
    { path: "/login", maxTime: 5000 },
    { path: "/cadastro", maxTime: 5000 },
    { path: "/sos", maxTime: 3000 }, // SOS must be fast — crisis page
    { path: "/recuperar-senha", maxTime: 5000 },
    { path: "/", maxTime: 5000 },
  ];

  for (const { path, maxTime } of publicPages) {
    test(`${path} loads within ${maxTime}ms`, async ({ page }) => {
      const start = Date.now();
      const response = await page.goto(path);
      const loadTime = Date.now() - start;

      expect(response?.status(), `${path} should return 200`).toBeLessThan(400);
      expect(loadTime, `${path} should load within ${maxTime}ms (took ${loadTime}ms)`).toBeLessThan(maxTime);
    });
  }
});

// ─── API Response Times ──────────────────────────────────────────────────────

test.describe("API response times", () => {
  test("POST /api/auth/login responds within 3s", async ({ request }) => {
    const start = Date.now();
    await request.post("/api/auth/login", {
      data: { email: "test@test.com", senha: "test" },
      headers: { "Content-Type": "application/json" },
    });
    const responseTime = Date.now() - start;
    expect(responseTime, "Login should respond quickly").toBeLessThan(3000);
  });

  test("GET /api/health responds within 1s", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/health");
    const responseTime = Date.now() - start;
    expect(responseTime, "Health check should be instant").toBeLessThan(1000);
  });

  test("GET /api/auth/google-login redirects within 2s", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/auth/google-login", { maxRedirects: 0 });
    const responseTime = Date.now() - start;
    expect(responseTime, "OAuth redirect should be fast").toBeLessThan(2000);
  });

  test("POST /api/auth/forgot-password responds within 3s", async ({ request }) => {
    const start = Date.now();
    await request.post("/api/auth/forgot-password", {
      data: { email: "test@test.com" },
      headers: { "Content-Type": "application/json" },
    });
    const responseTime = Date.now() - start;
    expect(responseTime).toBeLessThan(3000);
  });
});

// ─── Resource Loading ────────────────────────────────────────────────────────

test.describe("Resource loading", () => {
  test("login page makes no more than 50 network requests", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Dev mode has more requests (HMR, source maps). Production should be <30.
    expect(
      requests.length,
      `Login page made ${requests.length} requests (max 50 in dev)`
    ).toBeLessThan(50);
  });

  test("no 404 errors on login page", async ({ page }) => {
    const notFoundRequests: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 404) notFoundRequests.push(res.url());
    });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(notFoundRequests, "Should have zero 404s").toEqual([]);
  });

  test("no 404 errors on cadastro page", async ({ page }) => {
    const notFoundRequests: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 404) notFoundRequests.push(res.url());
    });
    await page.goto("/cadastro");
    await page.waitForLoadState("networkidle");
    expect(notFoundRequests).toEqual([]);
  });

  test("no 404 errors on SOS page", async ({ page }) => {
    const notFoundRequests: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 404) notFoundRequests.push(res.url());
    });
    await page.goto("/sos");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    expect(notFoundRequests).toEqual([]);
  });

  test("no 500 errors on any public page", async ({ page }) => {
    const serverErrors: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
    });

    for (const path of ["/login", "/cadastro", "/sos", "/recuperar-senha", "/"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
    }

    expect(serverErrors, "No 500 errors on public pages").toEqual([]);
  });
});

// ─── JavaScript Errors ───────────────────────────────────────────────────────

test.describe("No JavaScript errors on public pages", () => {
  const publicPages = ["/login", "/cadastro", "/sos", "/recuperar-senha"];

  for (const path of publicPages) {
    test(`${path} has no JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      expect(errors, `${path} should have no JS errors`).toEqual([]);
    });
  }
});

// ─── Mobile Performance ──────────────────────────────────────────────────────

test.describe("Mobile performance", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("SOS page loads fast on mobile", async ({ page }) => {
    const start = Date.now();
    await page.goto("/sos");
    const loadTime = Date.now() - start;
    expect(loadTime, "SOS must load fast on mobile").toBeLessThan(3000);
  });

  test("login page loads within 5s on mobile", async ({ page }) => {
    const start = Date.now();
    await page.goto("/login");
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });
});
