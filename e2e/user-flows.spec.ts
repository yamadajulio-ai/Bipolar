import { test, expect, type Page } from "@playwright/test";

/**
 * User flow tests — simulates a REAL USER interacting with the app.
 *
 * These tests answer: "If I open the site and click things, does it work?"
 * They catch problems like buttons that exist but don't function,
 * missing redirects, broken OAuth flows, and accessibility issues.
 *
 * Run: npx playwright test e2e/user-flows.spec.ts
 */

// ─── Helper: minimum touch target size (Apple HIG / WCAG) ──────────────────

async function assertTouchTarget(page: Page, locator: ReturnType<Page["locator"]>, minSize = 44) {
  // Wait for element to be stable (handles React hydration re-renders)
  await expect(locator).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box, "Element must be visible and have a bounding box").toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(minSize);
  expect(box!.width).toBeGreaterThanOrEqual(minSize);
}

// ─── Login Page: Complete UI Verification ───────────────────────────────────

test.describe("Login page — user perspective", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows email/password form with all fields", async ({ page }) => {
    await expect(page.locator("input[name='email']")).toBeVisible();
    await expect(page.locator("input[name='senha']")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("shows 'Esqueci minha senha' link", async ({ page }) => {
    const link = page.getByRole("link", { name: /esqueci/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/recuperar-senha");
  });

  test("shows 'Criar conta' link", async ({ page }) => {
    const link = page.getByRole("link", { name: /criar conta/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/cadastro");
  });

  test("Google OAuth button exists and redirects correctly", async ({ page }) => {
    const googleButton = page.getByRole("link", { name: /google/i });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toHaveAttribute("href", "/api/auth/google-login");
  });

  test("Apple OAuth button exists and redirects correctly", async ({ page }) => {
    const appleButton = page.getByRole("link", { name: /apple/i });
    await expect(appleButton).toBeVisible();
    await expect(appleButton).toHaveAttribute("href", "/api/auth/apple-login");
  });

  test("Apple button is a link to OAuth (not broken JS-only button)", async ({ page }) => {
    // This is THE test that would have caught the bug.
    // Before the fix, the button used JS-only flow that threw "apple_not_available" on web.
    // Now it should be a simple <a> link that redirects to our OAuth endpoint.
    //
    // The AppleSignInButton component uses useEffect (client-side hydration),
    // so we need to wait for the <a> tag to appear after React mounts.
    const appleLink = page.locator("a[href='/api/auth/apple-login']");
    await expect(appleLink).toBeVisible({ timeout: 10_000 });

    // Verify the text shows Apple branding
    await expect(appleLink).toContainText(/apple/i);

    // Verify no error message is shown
    await expect(page.getByText(/não foi possível/i)).not.toBeVisible();
  });

  test("Google button is a link to OAuth", async ({ page }) => {
    const googleButton = page.getByRole("link", { name: /google/i });
    await expect(googleButton).toBeVisible();
    const href = await googleButton.getAttribute("href");
    expect(href).toBe("/api/auth/google-login");
  });

  test("all interactive elements meet minimum touch target height", async ({ page }) => {
    const submitButton = page.getByRole("button", { name: /entrar/i });
    const googleButton = page.getByRole("link", { name: /google/i });
    const appleButton = page.getByRole("link", { name: /apple/i });

    // Apple HIG requires 44px minimum for touch targets
    await assertTouchTarget(page, submitButton);
    await assertTouchTarget(page, googleButton);
    await assertTouchTarget(page, appleButton);
  });

  test("shows validation error for empty form submission", async ({ page }) => {
    // Click submit without filling anything — browser validation or custom error
    const submitButton = page.getByRole("button", { name: /entrar/i });
    await submitButton.click();

    // Either HTML5 validation tooltip or custom error message
    const emailInput = page.locator("input[name='email']");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.fill("input[name='email']", "naoexiste@teste.com");
    await page.fill("input[name='senha']", "senhaerrada123");

    // Need CSRF token for the POST to work
    const csrfCookie = (await page.context().cookies()).find(c => c.name === "__Host-csrf");

    await page.getByRole("button", { name: /entrar/i }).click();

    // Should show an error message (not crash, not redirect)
    await expect(page.locator("[class*='alert'], [role='alert'], [class*='error'], [class*='danger']").first())
      .toBeVisible({ timeout: 5000 });
  });

  test("OAuth error params display user-friendly messages", async ({ page }) => {
    const errorCases = [
      { param: "csrf", expected: /segurança/i },
      { param: "apple_login_failed", expected: /apple/i },
      { param: "google_login_failed", expected: /google/i },
      { param: "rate_limited", expected: /tentativas|aguarde/i },
      { param: "email_not_verified", expected: /verificado/i },
    ];

    for (const { param, expected } of errorCases) {
      await page.goto(`/login?error=${param}`);
      const alertText = await page.locator("[class*='alert'], [role='alert'], [class*='danger']").first().textContent();
      expect(alertText, `Error param '${param}' should show user-friendly message`).toMatch(expected);
    }
  });
});

// ─── Cadastro Page: Complete UI Verification ────────────────────────────────

test.describe("Cadastro page — user perspective", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cadastro");
  });

  test("shows registration form with all required fields", async ({ page }) => {
    await expect(page.locator("input[name='email']")).toBeVisible();
    await expect(page.locator("input[name='senha']")).toBeVisible();
    await expect(page.locator("input[name='confirmarSenha']")).toBeVisible();
    await expect(page.locator("input[name='ageGate']")).toBeVisible();
    await expect(page.locator("input[name='healthConsent']")).toBeVisible();
  });

  test("shows educational disclaimer", async ({ page }) => {
    await expect(page.getByText(/não substitui/i)).toBeVisible();
  });

  test("Google OAuth button exists and works", async ({ page }) => {
    const googleButton = page.getByRole("link", { name: /google/i });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toHaveAttribute("href", "/api/auth/google-login");
  });

  test("Apple OAuth button exists and works", async ({ page }) => {
    const appleButton = page.getByRole("link", { name: /apple/i });
    await expect(appleButton).toBeVisible();
    await expect(appleButton).toHaveAttribute("href", "/api/auth/apple-login");
  });

  test("LGPD consent checkbox links to privacy policy and terms", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /privacidade/i });
    const termsLink = page.getByRole("link", { name: /termos/i });
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/privacidade");
    await expect(termsLink).toHaveAttribute("href", "/termos");
  });

  test("shows error when submitting without age confirmation", async ({ page }) => {
    await page.fill("input[name='email']", "teste@teste.com");
    await page.fill("input[name='senha']", "Senha12345!");
    await page.fill("input[name='confirmarSenha']", "Senha12345!");
    // Check health consent but NOT age gate
    await page.check("input[name='healthConsent']");

    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/18 anos/i)).toBeVisible({ timeout: 3000 });
  });

  test("shows error for password mismatch", async ({ page }) => {
    await page.fill("input[name='email']", "teste@teste.com");
    await page.fill("input[name='senha']", "Senha12345!");
    await page.fill("input[name='confirmarSenha']", "OutraSenha!");
    await page.check("input[name='ageGate']");
    await page.check("input[name='healthConsent']");

    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/senhas não coincidem/i)).toBeVisible({ timeout: 3000 });
  });

  test("shows error for short password", async ({ page }) => {
    await page.fill("input[name='email']", "teste@teste.com");
    await page.fill("input[name='senha']", "abc");
    await page.fill("input[name='confirmarSenha']", "abc");
    await page.check("input[name='ageGate']");
    await page.check("input[name='healthConsent']");

    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/8 caracteres/i)).toBeVisible({ timeout: 3000 });
  });

  test("'Já tem conta?' link goes to login", async ({ page }) => {
    const link = page.getByRole("link", { name: /entrar/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/login");
  });
});

// ─── SOS Page: Always Accessible ────────────────────────────────────────────

test.describe("SOS page — crisis accessibility", () => {
  test("loads without any authentication", async ({ page }) => {
    const res = await page.goto("/sos");
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain("/sos");
  });

  test("shows emergency contact numbers", async ({ page }) => {
    await page.goto("/sos");
    // CVV (188) or SAMU (192) should be visible
    const pageContent = await page.textContent("body");
    const hasEmergencyNumber = pageContent?.includes("188") || pageContent?.includes("192");
    expect(hasEmergencyNumber, "SOS page must show emergency numbers (CVV 188 or SAMU 192)").toBe(true);
  });

  test("never redirects to login even when accessed directly", async ({ page }) => {
    // Clear all cookies to ensure truly unauthenticated
    await page.context().clearCookies();
    await page.goto("/sos");
    expect(page.url()).toContain("/sos");
    expect(page.url()).not.toContain("/login");
  });
});

// ─── Navigation: Public Pages ───────────────────────────────────────────────

test.describe("Public page navigation", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    expect(page.url()).not.toContain("/login");
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
  });

  test("recuperar-senha page loads", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.locator("input[name='email'], input[type='email']").first()).toBeVisible();
  });
});

// ─── Mobile Viewport Tests ──────────────────────────────────────────────────

test.describe("Mobile viewport (iPhone)", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test("login page renders correctly on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByRole("link", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /apple/i })).toBeVisible();
  });

  test("all buttons meet 44px touch target on mobile", async ({ page }) => {
    await page.goto("/login");

    const submitButton = page.getByRole("button", { name: /entrar/i });
    const googleButton = page.getByRole("link", { name: /google/i });
    const appleButton = page.getByRole("link", { name: /apple/i });

    await assertTouchTarget(page, submitButton);
    await assertTouchTarget(page, googleButton);
    await assertTouchTarget(page, appleButton);
  });

  test("cadastro page renders correctly on mobile", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByRole("link", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /apple/i })).toBeVisible({ timeout: 15_000 });
  });

  test("SOS page loads on mobile without auth", async ({ page }) => {
    await page.goto("/sos");
    expect(page.url()).toContain("/sos");
  });
});

// ─── Apple OAuth Callback Security ──────────────────────────────────────────

test.describe("Apple OAuth callback security", () => {
  test("callback rejects POST without state cookie (CSRF)", async ({ request }) => {
    // Use Playwright's request API (not browser fetch) to get full access to redirect response
    const res = await request.post("/api/auth/apple-login/callback", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "id_token=fake.jwt.token&code=fake_code&state=random_state",
      maxRedirects: 0,
    });
    // Should redirect to login with CSRF error (no state cookie)
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()["location"]).toContain("error=csrf");
  });

  test("callback rejects POST without id_token", async ({ request, context }) => {
    // Set matching state cookie in the request context
    await context.addCookies([{
      name: "apple-login-state",
      value: "test_state_123",
      domain: "localhost",
      path: "/api/auth/apple-login/callback",
      secure: false,
      sameSite: "None",
    }]);

    const res = await request.post("/api/auth/apple-login/callback", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": "apple-login-state=test_state_123",
      },
      data: "code=fake_code&state=test_state_123",
      maxRedirects: 0,
    });
    // Should redirect with error (no id_token)
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()["location"]).toContain("error=");
  });
});
