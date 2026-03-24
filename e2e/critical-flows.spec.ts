import { test, expect } from "@playwright/test";

/**
 * Critical flow smoke tests — validates that key pages load and API routes
 * return expected status codes for unauthenticated users.
 *
 * Run: npx playwright test e2e/critical-flows.spec.ts
 * Requires: dev server running on localhost:3000 (or E2E_BASE_URL env var)
 */

// ─── Page Load Smoke Tests ──────────────────────────────────────────────────

test.describe("Critical flow smoke tests", () => {
  test("SOS page loads without auth", async ({ page }) => {
    await page.goto("/sos");
    await expect(page).toHaveTitle(/SOS|Suporte/i);
    // SOS must never redirect to login
    expect(page.url()).toContain("/sos");
  });

  test("Login page loads and shows form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible();
  });

  test("Protected pages redirect to login without auth", async ({ page }) => {
    const protectedRoutes = [
      "/hoje",
      "/checkin",
      "/insights",
      "/avaliacao-semanal",
      "/meu-diario",
      "/consentimentos",
    ];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/login/);
      expect(page.url()).toContain("/login");
    }
  });

  test("Public pages load without redirect", async ({ page }) => {
    await page.goto("/comecar");
    expect(page.url()).not.toContain("/login");
  });
});

// ─── API Route Status Codes ─────────────────────────────────────────────────

test.describe("API route access control", () => {
  test("Unauthenticated POST to protected endpoint returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/diario/snapshots", {
      data: {
        mood: 3,
        energy: 3,
        anxiety: 2,
        irritability: 2,
        clientRequestId: "test",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("SOS API accepts anonymous events", async ({ request }) => {
    const res = await request.post("/api/sos", {
      data: { action: "opened" },
      headers: {
        "sec-fetch-site": "same-origin",
        origin: "http://localhost:3000",
      },
    });
    // Should succeed (200) or rate limit (429), but NOT 401
    expect([200, 429]).toContain(res.status());
  });

  test("Health export import requires auth", async ({ request }) => {
    const res = await request.post(
      "/api/integrations/health-export/import",
      {
        data: { data: { metrics: [] } },
      },
    );
    expect(res.status()).toBe(401);
  });
});
