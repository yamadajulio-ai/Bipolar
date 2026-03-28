import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for push-subscriptions route (POST + DELETE).
 *
 * Mocks: prisma, auth, rate limiting, Sentry.
 * Tests: auth checks, validation, SSRF allowlist, atomic cap, shared device safety, DELETE.
 */

// ─── Mock setup ─────────────────────────────────────────────────────────────

const mockSession = { isLoggedIn: true, userId: "user-1", email: "test@test.com" };
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCheckRateLimit: any = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/security", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Prisma mock with $transaction support
const mockCount = vi.fn(() => Promise.resolve(0));
const mockFindUnique = vi.fn((): Promise<{ id: string } | null> => Promise.resolve(null));
const mockDeleteMany = vi.fn(() => Promise.resolve({ count: 0 }));
const mockUpsert = vi.fn(() => Promise.resolve({ id: "sub-1" }));

const txProxy = {
  pushSubscription: {
    count: mockCount,
    findUnique: mockFindUnique,
    deleteMany: mockDeleteMany,
    upsert: mockUpsert,
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction: any = vi.fn((fn: (tx: typeof txProxy) => Promise<unknown>) => fn(txProxy));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    pushSubscription: {
      deleteMany: mockDeleteMany,
    },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method: string, body: unknown): Request {
  return new Request("https://suportebipolar.com/api/push-subscriptions", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    // 87-char base64url P-256 public key (65 bytes raw = 87-88 chars base64url)
    p256dh: "BNcRdreALongerTestKeyThatMatchesRealWorldP256dhLengthRequirementsForWebPushCryptoKeysXY",
    // 22-char base64url auth secret (16 bytes raw = 22-24 chars base64url)
    auth: "dGVzdEF1dGhTZWNyZXRLZXk",
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/push-subscriptions", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSession.isLoggedIn = true;
    mockSession.userId = "user-1";
    mockCheckRateLimit.mockResolvedValue(true);
    mockCount.mockResolvedValue(0);
    mockFindUnique.mockResolvedValue(null);
    const mod = await import("./route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it("returns 401 when not logged in", async () => {
    mockSession.isLoggedIn = false;
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("autorizado");
  });

  // ── Rate limiting ─────────────────────────────────────────────────────

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(429);
  });

  it("calls checkRateLimit with correct key", async () => {
    await POST(makeRequest("POST", validPayload));
    expect(mockCheckRateLimit).toHaveBeenCalledWith("push_sub:user-1", 10, 900_000);
  });

  // ── Validation ────────────────────────────────────────────────────────

  it("returns 400 for missing endpoint", async () => {
    const res = await POST(makeRequest("POST", { keys: validPayload.keys }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing keys", async () => {
    const res = await POST(makeRequest("POST", { endpoint: validPayload.endpoint }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid endpoint URL", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "not-a-url",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-allowlisted endpoint (SSRF)", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://evil.com/push",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for HTTP endpoint (not HTTPS)", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "http://fcm.googleapis.com/push",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for endpoint longer than 2048 chars", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://fcm.googleapis.com/" + "a".repeat(2048),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid p256dh format", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      keys: { ...validPayload.keys, p256dh: "invalid!!!chars!!!that!!!are!!!long!!!enough!!!to!!!pass!!!min!!!length!!!but!!!fail!!!regex!!" },
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid auth format", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      keys: { ...validPayload.keys, auth: "too!!!short!!!invalid" },
    }));
    expect(res.status).toBe(400);
  });

  // ── SSRF: accepts all known push services ─────────────────────────────

  it("accepts FCM endpoint", async () => {
    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("accepts Mozilla push endpoint", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc",
    }));
    expect(res.status).toBe(200);
  });

  it("accepts Apple push endpoint", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://web.push.apple.com/abc",
    }));
    expect(res.status).toBe(200);
  });

  it("accepts WNS push endpoint", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://wns.windows.com/abc",
    }));
    expect(res.status).toBe(200);
  });

  it("accepts Chrome push endpoint", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://push.api.chrome.google.com/abc",
    }));
    expect(res.status).toBe(200);
  });

  it("accepts subdomain of allowed host", async () => {
    const res = await POST(makeRequest("POST", {
      ...validPayload,
      endpoint: "https://eu.notify.windows.com/abc",
    }));
    expect(res.status).toBe(200);
  });

  // ── Atomic cap enforcement ────────────────────────────────────────────

  it("returns 409 when cap exceeded (5 devices, new endpoint)", async () => {
    mockCount.mockResolvedValue(5);
    mockFindUnique.mockResolvedValue(null); // not an update

    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Limite");
  });

  it("allows update when cap is at limit (existing endpoint)", async () => {
    mockCount.mockResolvedValue(5);
    mockFindUnique.mockResolvedValue({ id: "existing-sub" }); // is an update

    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(200);
  });

  it("allows new subscription when under cap", async () => {
    mockCount.mockResolvedValue(4);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(200);
  });

  // ── Shared device safety ──────────────────────────────────────────────

  it("deletes endpoint from other users before upserting", async () => {
    await POST(makeRequest("POST", validPayload));

    // Should delete from OTHER users first
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        endpoint: validPayload.endpoint,
        userId: { not: "user-1" },
      },
    });

    // Then upsert for current user
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_endpoint: {
            userId: "user-1",
            endpoint: validPayload.endpoint,
          },
        },
      }),
    );
  });

  // ── Transaction atomicity ─────────────────────────────────────────────

  it("runs all operations inside $transaction", async () => {
    await POST(makeRequest("POST", validPayload));
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("rolls back on cap exceeded (transaction throws)", async () => {
    mockCount.mockResolvedValue(5);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("POST", validPayload));
    expect(res.status).toBe(409);
    // upsert should NOT have been called since cap check throws before it
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/push-subscriptions", () => {
  let DELETE: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSession.isLoggedIn = true;
    mockSession.userId = "user-1";
    mockCheckRateLimit.mockResolvedValue(true);
    mockDeleteMany.mockResolvedValue({ count: 1 });
    const mod = await import("./route");
    DELETE = mod.DELETE as unknown as (req: Request) => Promise<Response>;
  });

  it("returns 401 when not logged in", async () => {
    mockSession.isLoggedIn = false;
    const res = await DELETE(makeRequest("DELETE", { endpoint: "https://fcm.googleapis.com/abc" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await DELETE(makeRequest("DELETE", { endpoint: "https://fcm.googleapis.com/abc" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for missing endpoint", async () => {
    const res = await DELETE(makeRequest("DELETE", {}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-string endpoint", async () => {
    const res = await DELETE(makeRequest("DELETE", { endpoint: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for endpoint longer than 2048 chars", async () => {
    const res = await DELETE(makeRequest("DELETE", { endpoint: "x".repeat(2049) }));
    expect(res.status).toBe(400);
  });

  it("deletes subscription for current user only", async () => {
    const endpoint = "https://fcm.googleapis.com/abc";
    await DELETE(makeRequest("DELETE", { endpoint }));

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", endpoint },
    });
  });

  it("returns success even if no subscription found", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeRequest("DELETE", { endpoint: "https://fcm.googleapis.com/abc" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockDeleteMany.mockRejectedValue(new Error("DB down"));
    const res = await DELETE(makeRequest("DELETE", { endpoint: "https://fcm.googleapis.com/abc" }));
    expect(res.status).toBe(500);
  });
});
