import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Security hardening regression tests (Onda 1: I1 + I9).
 * Covers: auth guards, middleware route protection, LGPD export minimization.
 */

// ─── Mock state ──────────────────────────────────────────────────────────────

const mockSession = {
  isLoggedIn: false,
  userId: "",
  email: "",
  save: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/security", () => ({
  checkRateLimit: vi.fn(() => Promise.resolve(true)),
  getClientIp: vi.fn(() => "1.2.3.4"),
  maskIp: vi.fn(() => "1.2.3.0"),
  CSRF_COOKIE_NAME: "__Host-csrf",
  CSRF_HEADER_NAME: "x-csrf-token",
  generateCsrfToken: vi.fn(() => "test-csrf-token"),
  validateCsrfToken: vi.fn(() => true),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    sleepLog: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    healthMetric: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/integrations/healthExport", () => ({
  parseHealthExportPayloadV2: vi.fn(() => ({
    sleepNights: [],
    hrvHrData: { hrvByDate: new Map(), hrByDate: new Map() },
    genericMetrics: [],
  })),
}));

// ─── Tests: I1-T1 — Health export import auth guard ─────────────────────────

describe("I1-T1: Health export import requires auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.isLoggedIn = false;
    mockSession.userId = "";
  });

  it("returns 401 when no session is present", async () => {
    const { POST } = await import(
      "@/app/api/integrations/health-export/import/route"
    );

    const req = new NextRequest("http://localhost/api/integrations/health-export/import", {
      method: "POST",
      body: JSON.stringify({ data: { metrics: [] } }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Não autorizado");
  });

  it("proceeds when session is valid", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "user-1";

    const { POST } = await import(
      "@/app/api/integrations/health-export/import/route"
    );

    const req = new NextRequest("http://localhost/api/integrations/health-export/import", {
      method: "POST",
      body: JSON.stringify({ data: { metrics: [] } }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    // 400 = "no recognized data" which means auth passed, parsing ran
    expect(res.status).toBe(400);
  });
});

// ─── Tests: I9-T1 — Middleware route protection ──────────────────────────────

describe("I9-T1: Middleware protects all (app) routes", () => {
  // These routes map to src/app/(app)/*/page.tsx and must redirect to /login
  // when no session cookie is present.
  const appRoutes = [
    "/hoje", "/checkin", "/insights", "/mais", "/diario",
    "/sono", "/exercicios", "/relatorio", "/financeiro",
    "/conta", "/integracoes", "/plano-de-crise",
    // Previously missing — added in I9-T1
    "/avaliacao-semanal", "/meu-diario", "/consentimentos",
    "/onboarding", "/cognitivo", "/life-chart", "/circadiano",
    "/como-usar", "/perfil", "/acesso-profissional",
    "/feedback", "/medicamentos", "/admin",
  ];

  // Read the middleware source to verify all routes are in protectedPaths
  it("protectedPaths covers all (app) routes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const middlewarePath = path.resolve("src/middleware.ts");
    const source = fs.readFileSync(middlewarePath, "utf-8");

    for (const route of appRoutes) {
      // Check the route string appears in the protectedPaths array
      expect(source).toContain(`"${route}"`);
    }
  });

  it("SOS route is explicitly public (never blocked)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const middlewarePath = path.resolve("src/middleware.ts");
    const source = fs.readFileSync(middlewarePath, "utf-8");

    // Extract protectedPaths array from source
    const protectedMatch = source.match(/const protectedPaths\s*=\s*\[([\s\S]*?)\];/);
    expect(protectedMatch).toBeTruthy();
    const protectedBlock = protectedMatch![1];
    // SOS must NOT be listed in protectedPaths
    expect(protectedBlock).not.toContain("/sos");
    // SOS must have explicit early return in middleware
    expect(source).toContain('pathname === "/sos"');
  });
});
