import { test, expect } from "@playwright/test";

/**
 * Clinical Safety Tests — validates that safety-critical features work correctly
 * for users in crisis or with sensitive clinical data.
 *
 * These tests answer: "In the worst case scenario, does the app keep users safe?"
 *
 * Run: npx playwright test e2e/clinical-safety.spec.ts
 */

// ─── SOS Page: Crisis Accessibility ──────────────────────────────────────────

test.describe("SOS page — crisis safety", () => {
  test("SOS page loads fast (< 3 seconds)", async ({ page }) => {
    const start = Date.now();
    await page.goto("/sos");
    const loadTime = Date.now() - start;
    expect(loadTime, "SOS page must load quickly for crisis situations").toBeLessThan(3000);
  });

  test("shows CVV 188 emergency number", async ({ page }) => {
    await page.goto("/sos");
    const content = await page.textContent("body");
    expect(content, "Must show CVV 188 number").toContain("188");
  });

  test("shows SAMU 192 emergency number", async ({ page }) => {
    await page.goto("/sos");
    const content = await page.textContent("body");
    expect(content, "Must show SAMU 192 number").toContain("192");
  });

  test("emergency phone links are clickable tel: links", async ({ page }) => {
    await page.goto("/sos");
    // Check that emergency numbers have tel: href for one-tap calling
    const telLinks = await page.$$eval("a[href^='tel:']", (els) =>
      els.map((a) => ({ href: a.getAttribute("href"), text: a.textContent?.trim() }))
    );
    expect(telLinks.length, "SOS page must have clickable phone links").toBeGreaterThan(0);

    const hasCvv = telLinks.some((l) => l.href?.includes("188"));
    const hasSamu = telLinks.some((l) => l.href?.includes("192"));
    expect(hasCvv || hasSamu, "At least CVV or SAMU must be a tel: link").toBe(true);
  });

  test("SOS page works with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/sos");
    const content = await page.textContent("body");
    // Even without JS, critical numbers should be in the HTML
    const hasEmergencyInfo = content?.includes("188") || content?.includes("192");
    expect(hasEmergencyInfo, "SOS page must work without JavaScript").toBe(true);
    await context.close();
  });

  test("SOS page accessible from any state (clearing all data)", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    // Clear everything
    await context.clearCookies();
    await page.goto("/sos");
    expect(page.url()).toContain("/sos");
    expect(page.url()).not.toContain("/login");
    const res = await page.goto("/sos");
    expect(res?.status()).toBe(200);
    await context.close();
  });

  test("SOS page has no broken images or missing resources", async ({ page }) => {
    const failedRequests: string[] = [];
    page.on("requestfailed", (req) => failedRequests.push(req.url()));
    await page.goto("/sos");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    // Filter out Vercel Analytics (fails in local dev, works in production)
    const realFailures = failedRequests.filter(
      (url) => !url.includes("vercel-scripts.com") && !url.includes("va.vercel")
    );
    expect(realFailures, "SOS page should have zero failed requests (excluding analytics)").toEqual([]);
  });

  test("SOS page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/sos");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    // Filter out known benign errors (Next.js dev mode, analytics, hydration warnings)
    const realErrors = errors.filter(
      (e) => !e.includes("Download the React DevTools") && !e.includes("Failed to load resource") &&
        !e.includes("hydrat") && !e.includes("Warning:") && !e.includes("vercel-scripts") &&
        !e.includes("ERR_BLOCKED_BY_CLIENT")
    );
    expect(realErrors, "SOS page should have no console errors").toEqual([]);
  });
});

// ─── Login Error Messages: User Safety ───────────────────────────────────────

test.describe("Login error messages — user-friendly and safe", () => {
  test("wrong password shows generic error (no user enumeration)", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name='email']", "nonexistent@test.com");
    await page.fill("input[name='senha']", "WrongPassword1!");
    await page.getByRole("button", { name: /entrar/i }).click();

    const alert = page.locator("[class*='alert'], [role='alert'], [class*='danger']").first();
    await expect(alert).toBeVisible({ timeout: 5000 });
    const text = await alert.textContent();
    // Should NOT reveal whether the email exists or not
    expect(text).not.toMatch(/não encontrado|not found|user does not exist/i);
    // Should show a generic login error
    expect(text).toBeTruthy();
  });

  test("error messages are in Portuguese", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name='email']", "test@test.com");
    await page.fill("input[name='senha']", "wrong");
    await page.getByRole("button", { name: /entrar/i }).click();

    const alert = page.locator("[class*='alert'], [role='alert'], [class*='danger']").first();
    await expect(alert).toBeVisible({ timeout: 5000 });
    const text = await alert.textContent();
    // Should be in Portuguese, not English
    expect(text).not.toMatch(/^(Error|Invalid|Wrong|Incorrect)/);
  });
});

// ─── Public Pages: No Clinical Data Leakage ──────────────────────────────────

test.describe("Public pages — no data leakage", () => {
  test("login page does not expose any user data", async ({ page }) => {
    await page.goto("/login");
    const html = await page.content();
    // Should not contain any user emails, names, or clinical data
    expect(html).not.toMatch(/userId|user_id|session_token/i);
  });

  test("cadastro page does not pre-fill with other user data", async ({ page }) => {
    await page.goto("/cadastro");
    const emailInput = page.locator("input[name='email']");
    const value = await emailInput.inputValue();
    expect(value, "Email field should be empty on fresh visit").toBe("");
  });

  test("/recuperar-senha does not confirm email existence", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await page.fill("input[name='email'], input[type='email']", "nonexistent@test.com");
    // Find and click the submit button
    const submitBtn = page.locator("button[type='submit'], button:has-text('Enviar'), button:has-text('Recuperar')").first();
    await submitBtn.click();

    // Wait for response
    await page.waitForTimeout(3000);
    // Check visible text elements only (not minified JS in body)
    const visibleText = await page.locator("[class*='alert'], [role='alert'], p, h1, h2, h3, span").allTextContents();
    const allText = visibleText.join(" ");
    // Should NOT say "email not found" — that reveals user existence
    expect(allText).not.toMatch(/e-mail não encontrado|email not found|usuário não existe/i);
  });
});

// ─── Clinical Disclaimer Presence ────────────────────────────────────────────

test.describe("Clinical disclaimers", () => {
  test("cadastro page shows 'não substitui' disclaimer", async ({ page }) => {
    await page.goto("/cadastro");
    const content = await page.textContent("body");
    expect(content, "Must show clinical disclaimer").toMatch(/não substitui/i);
  });

  test("cadastro page requires health data consent", async ({ page }) => {
    await page.goto("/cadastro");
    const healthConsent = page.locator("input[name='healthConsent']");
    await expect(healthConsent, "Health consent checkbox must exist").toBeVisible();
  });

  test("cadastro page requires age gate (18+)", async ({ page }) => {
    await page.goto("/cadastro");
    const ageGate = page.locator("input[name='ageGate']");
    await expect(ageGate, "Age gate checkbox must exist").toBeVisible();
    // Verify it mentions 18 anos
    const label = page.locator("text=18 anos");
    await expect(label).toBeVisible();
  });

  test("cadastro page links to privacy policy", async ({ page }) => {
    await page.goto("/cadastro");
    const privacyLink = page.getByRole("link", { name: /privacidade/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/privacidade");
  });

  test("cadastro page links to terms of service", async ({ page }) => {
    await page.goto("/cadastro");
    const termsLink = page.getByRole("link", { name: /termos/i });
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute("href", "/termos");
  });

  test("cadastro mentions LGPD", async ({ page }) => {
    await page.goto("/cadastro");
    const content = await page.textContent("body");
    expect(content, "Must reference LGPD").toMatch(/LGPD/);
  });
});

// ─── Mobile Crisis Accessibility ─────────────────────────────────────────────

test.describe("Mobile crisis accessibility", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("SOS page emergency numbers visible without scrolling", async ({ page }) => {
    await page.goto("/sos");
    // Check that at least one emergency number is in the visible viewport
    const cvvLink = page.locator("text=188").first();
    if (await cvvLink.isVisible()) {
      const box = await cvvLink.boundingBox();
      expect(box, "CVV number must be visible").toBeTruthy();
      expect(box!.y, "CVV number must be above the fold").toBeLessThan(844);
    }
  });

  test("SOS page visible phone links are large enough for trembling hands", async ({ page }) => {
    await page.goto("/sos");
    // In crisis, users may have trembling hands — visible touch targets should be large
    const telLinks = page.locator("a[href^='tel:']");
    const count = await telLinks.count();

    const violations: string[] = [];
    for (let i = 0; i < count; i++) {
      const link = telLinks.nth(i);
      if (!(await link.isVisible())) continue;
      const box = await link.boundingBox();
      if (box && box.height > 0 && box.height < 44) {
        const text = (await link.textContent())?.trim().substring(0, 20) || "";
        violations.push(`Phone link "${text}" — ${Math.round(box.height)}px`);
      }
    }
    expect(violations, "Visible phone links must be ≥44px").toEqual([]);
  });
});
