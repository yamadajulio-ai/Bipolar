import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Integration tests for auth routes: login, logout, cadastro, export, excluir-conta.
 * Covers: validation, rate limiting, step-up auth (email + OAuth), session management.
 */

// ─── Shared mock state ──────────────────────────────────────────────────────

const mockSession = {
  isLoggedIn: true,
  userId: "user-1",
  email: "test@example.com",
  onboarded: true,
  lastActive: Date.now(),
  createdAt: Date.now(),
  save: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
  hashPassword: vi.fn(() => Promise.resolve("hashed-pw")),
}));

const mockCheckRateLimit = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/security", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: vi.fn(() => "1.2.3.4"),
  maskIp: vi.fn(() => "1.2.3.0"),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// ─── Prisma mock ────────────────────────────────────────────────────────────

const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserDelete = vi.fn();
const mockGoogleAccountFindUnique = vi.fn().mockResolvedValue(null);
const mockDiaryFindMany = vi.fn().mockResolvedValue([]);
const mockSleepFindMany = vi.fn().mockResolvedValue([]);
const mockRhythmFindMany = vi.fn().mockResolvedValue([]);
const mockPlannerFindMany = vi.fn().mockResolvedValue([]);
const mockExerciseFindMany = vi.fn().mockResolvedValue([]);
const mockCourseFindMany = vi.fn().mockResolvedValue([]);
const mockCrisisFindUnique = vi.fn().mockResolvedValue(null);
const mockReminderFindUnique = vi.fn().mockResolvedValue(null);
const mockFinancialFindMany = vi.fn().mockResolvedValue([]);
const mockFeedbackFindMany = vi.fn().mockResolvedValue([]);
const mockContextualFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      delete: mockUserDelete,
    },
    googleAccount: { findUnique: mockGoogleAccountFindUnique },
    diaryEntry: { findMany: mockDiaryFindMany },
    sleepLog: { findMany: mockSleepFindMany },
    dailyRhythm: { findMany: mockRhythmFindMany },
    plannerBlock: { findMany: mockPlannerFindMany },
    exerciseSession: { findMany: mockExerciseFindMany },
    courseProgress: { findMany: mockCourseFindMany },
    crisisPlan: { findUnique: mockCrisisFindUnique },
    reminderSettings: { findUnique: mockReminderFindUnique },
    financialTransaction: { findMany: mockFinancialFindMany },
    feedback: { findMany: mockFeedbackFindMany },
    contextualFeedback: { findMany: mockContextualFindMany },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "decrypted-token"),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, url = "https://suportebipolar.com/api/auth/login"): NextRequest {
  return new NextRequest(new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

function resetSession(overrides: Partial<typeof mockSession> = {}) {
  Object.assign(mockSession, {
    isLoggedIn: true,
    userId: "user-1",
    email: "test@example.com",
    onboarded: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  });
  mockSession.save.mockClear();
  mockSession.destroy.mockClear();
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSession();
  mockCheckRateLimit.mockResolvedValue(true);
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    ({ POST } = await import("./login/route"));
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-email", senha: "12345678" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing password", async () => {
    const res = await POST(makeRequest({ email: "test@test.com", senha: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when IP rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false);
    const res = await POST(makeRequest({ email: "test@test.com", senha: "12345678" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("Muitas tentativas");
  });

  it("returns 429 when email rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await POST(makeRequest({ email: "test@test.com", senha: "12345678" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("e-mail");
  });

  it("returns 401 for non-existent user", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ email: "nobody@test.com", senha: "12345678" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with generic error for social-only account (anti-enumeration)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "u1", email: "g@test.com", passwordHash: null, onboarded: true });
    const res = await POST(makeRequest({ email: "g@test.com", senha: "12345678" }));
    // Must NOT reveal that the account is social-only (anti-enumeration)
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).not.toContain("Google");
    expect(body.error).toBe("E-mail ou senha incorretos.");
  });

  it("returns 401 for wrong password", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    mockUserFindUnique.mockResolvedValueOnce({ id: "u1", email: "t@test.com", passwordHash: "hash", onboarded: true });
    const res = await POST(makeRequest({ email: "t@test.com", senha: "wrongpw!!" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 and rotates session on valid login (anti-fixation)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "u1", email: "t@test.com", passwordHash: "hash", onboarded: true });
    const res = await POST(makeRequest({ email: "t@test.com", senha: "correctpw" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.onboarded).toBe(true);
    // Session rotation: destroy called before save (prevents session fixation)
    expect(mockSession.destroy).toHaveBeenCalled();
    expect(mockSession.save).toHaveBeenCalled();
    expect(mockSession.userId).toBe("u1");
    expect(mockSession.isLoggedIn).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/logout", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    ({ POST } = await import("./logout/route"));
  });

  it("destroys session and redirects with Clear-Site-Data", async () => {
    const req = new NextRequest(new Request("https://suportebipolar.com/api/auth/logout", { method: "POST" }));
    const res = await POST(req);
    expect(mockSession.destroy).toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("Clear-Site-Data")).toBe('"cache", "cookies", "storage"');
    expect(res.headers.get("Location")).toContain("/");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CADASTRO (Registration)
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/cadastro", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  const validBody = {
    email: "new@example.com",
    senha: "StrongPw1!",
    confirmarSenha: "StrongPw1!",
    ageGate: true,
    healthConsent: true,
  };

  beforeEach(async () => {
    ({ POST } = await import("./cadastro/route"));
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false);
    const res = await POST(makeRequest(validBody, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "bad" }, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toBeDefined();
  });

  it("returns 400 for short password", async () => {
    const res = await POST(makeRequest({ ...validBody, senha: "short", confirmarSenha: "short" }, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for mismatched passwords", async () => {
    const res = await POST(makeRequest({ ...validBody, confirmarSenha: "DifferentPw!" }, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when ageGate is false", async () => {
    const res = await POST(makeRequest({ ...validBody, ageGate: false }, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when healthConsent is false", async () => {
    const res = await POST(makeRequest({ ...validBody, healthConsent: false }, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(400);
  });

  it("returns 400 with generic error for duplicate email (anti-enumeration)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "existing" });
    const res = await POST(makeRequest(validBody, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(400);
    const body = await res.json();
    // Generic message — must NOT reveal that the email already exists
    expect(body.error).not.toContain("cadastrado");
    expect(body.error).toBeDefined();
  });

  it("returns 201, creates user, and rotates session on success", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValueOnce({ id: "new-user", email: "new@example.com" });
    const res = await POST(makeRequest(validBody, "https://suportebipolar.com/api/auth/cadastro"));
    expect(res.status).toBe(201);
    expect(mockUserCreate).toHaveBeenCalled();
    // Session rotation: destroy before save
    expect(mockSession.destroy).toHaveBeenCalled();
    expect(mockSession.save).toHaveBeenCalled();
    expect(mockSession.isLoggedIn).toBe(true);
    expect(mockSession.onboarded).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT (Step-up Auth)
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/export", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  const url = "https://suportebipolar.com/api/auth/export";

  beforeEach(async () => {
    ({ POST } = await import("./export/route"));
  });

  it("returns 401 when not logged in", async () => {
    resetSession({ isLoggedIn: false });
    const res = await POST(makeRequest({ password: "pw" }, url));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false);
    const res = await POST(makeRequest({ password: "pw" }, url));
    expect(res.status).toBe(429);
  });

  it("returns 422 (requiresPassword) for email user without password in body", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1", email: "t@test.com", name: null, authProvider: "email",
      passwordHash: "hash", createdAt: new Date(),
    });
    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.requiresPassword).toBe(true);
  });

  it("returns 403 for email user with wrong password", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1", email: "t@test.com", name: null, authProvider: "email",
      passwordHash: "hash", createdAt: new Date(),
    });
    const res = await POST(makeRequest({ password: "wrong" }, url));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Senha incorreta");
  });

  it("returns 200 with JSON download for email user with correct password", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1", email: "t@test.com", name: "Julio", authProvider: "email",
      passwordHash: "hash", createdAt: new Date(),
    });
    const res = await POST(makeRequest({ password: "correct" }, url));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = await res.json();
    expect(body.lgpdNotice).toContain("LGPD");
    expect(body.user.email).toBe("t@test.com");
  });

  it("returns 403 (requiresReauth) for OAuth user with stale session", async () => {
    resetSession({ lastActive: Date.now() - 10 * 60 * 1000 }); // 10 min ago
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1", email: "g@test.com", name: null, authProvider: "google",
      passwordHash: null, createdAt: new Date(),
    });
    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.requiresReauth).toBe(true);
  });

  it("returns 200 for OAuth user with fresh session (<5 min)", async () => {
    resetSession({ lastActive: Date.now() - 2 * 60 * 1000 }); // 2 min ago
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1", email: "g@test.com", name: null, authProvider: "google",
      passwordHash: null, createdAt: new Date(),
    });
    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXCLUIR CONTA (Step-up Auth + Account Deletion)
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/excluir-conta", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  const url = "https://suportebipolar.com/api/auth/excluir-conta";

  beforeEach(async () => {
    ({ POST } = await import("./excluir-conta/route"));
  });

  it("returns 401 when not logged in", async () => {
    resetSession({ isLoggedIn: false });
    const res = await POST(makeRequest({ password: "pw" }, url));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false);
    const res = await POST(makeRequest({ password: "pw" }, url));
    expect(res.status).toBe(429);
  });

  it("returns 422 (requiresPassword) for email user without password", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ passwordHash: "hash", authProvider: "email" });
    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.requiresPassword).toBe(true);
  });

  it("returns 403 for email user with wrong password", async () => {
    const { verifyPassword } = await import("@/lib/auth");
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    mockUserFindUnique.mockResolvedValueOnce({ passwordHash: "hash", authProvider: "email" });
    const res = await POST(makeRequest({ password: "wrong" }, url));
    expect(res.status).toBe(403);
  });

  it("deletes user, destroys session, and redirects for email user with correct password", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ passwordHash: "hash", authProvider: "email" });
    const res = await POST(makeRequest({ password: "correct" }, url));
    expect(res.status).toBe(303);
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mockSession.destroy).toHaveBeenCalled();
    expect(res.headers.get("Location")).toContain("/");
  });

  it("returns 403 (requiresReauth) for OAuth user with stale session", async () => {
    resetSession({ lastActive: Date.now() - 10 * 60 * 1000 });
    mockUserFindUnique.mockResolvedValueOnce({ passwordHash: null, authProvider: "google" });
    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.requiresReauth).toBe(true);
  });

  it("deletes user for OAuth user with fresh session and revokes Google tokens", async () => {
    resetSession({ lastActive: Date.now() - 1000 });
    mockUserFindUnique.mockResolvedValueOnce({ passwordHash: null, authProvider: "google" });
    mockGoogleAccountFindUnique.mockResolvedValueOnce({ refreshToken: "encrypted-token" });

    // Mock global fetch for token revocation
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(303);
    expect(mockUserDelete).toHaveBeenCalled();
    expect(mockSession.destroy).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("oauth2.googleapis.com/revoke"),
      expect.objectContaining({ method: "POST" }),
    );

    globalThis.fetch = originalFetch;
  });

  it("still deletes user if Google token revocation fails", async () => {
    resetSession({ lastActive: Date.now() - 1000 });
    mockUserFindUnique.mockResolvedValueOnce({ passwordHash: null, authProvider: "google" });
    mockGoogleAccountFindUnique.mockResolvedValueOnce({ refreshToken: "encrypted-token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));

    const res = await POST(makeRequest({}, url));
    expect(res.status).toBe(303);
    expect(mockUserDelete).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });
});
