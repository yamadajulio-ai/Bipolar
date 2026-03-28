import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    extraHTTPHeaders: {
      // Playwright sends Sec-Fetch-Site: cross-site by default on navigations;
      // override for API tests to simulate same-origin browser behavior
    },
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { browserName: "chromium" },
    },
    {
      name: "mobile-safari",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
  ],
  // Don't auto-start dev server — run `pnpm dev` separately or point E2E_BASE_URL to staging
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
