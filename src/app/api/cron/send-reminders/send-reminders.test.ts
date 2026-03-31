import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for cron/send-reminders route.
 *
 * Mocks: prisma, web-push, rate limiting, Sentry.
 * Tests: auth, idempotency, reminder matching, batch sending, cleanup, error handling.
 */

// ─── Mock setup ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCheckRateLimit: any = vi.fn().mockResolvedValue(true);
const mockIsRateLimited = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/security", () => ({
  checkRateLimit: mockCheckRateLimit,
  isRateLimited: mockIsRateLimited,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSendPush: any = vi.fn().mockResolvedValue({ ok: true as const });
vi.mock("@/lib/web-push", () => ({
  sendPush: mockSendPush,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCaptureCheckIn: any = vi.fn().mockReturnValue("check-in-id");
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureCheckIn: mockCaptureCheckIn,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindManySettings: any = vi.fn().mockResolvedValue([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindManySubs: any = vi.fn().mockResolvedValue([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDeleteManySubs: any = vi.fn().mockResolvedValue({ count: 0 });

vi.mock("@/lib/db", () => ({
  prisma: {
    reminderSettings: {
      findMany: mockFindManySettings,
    },
    pushSubscription: {
      findMany: mockFindManySubs,
      deleteMany: mockDeleteManySubs,
    },
  },
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new Request("https://suportebipolar.com/api/cron/send-reminders", {
    method: "GET",
    headers,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/cron/send-reminders", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockCheckRateLimit.mockResolvedValue(true);
    mockIsRateLimited.mockResolvedValue(false);
    mockSendPush.mockResolvedValue({ ok: true });
    mockFindManySettings.mockResolvedValue([]);
    mockFindManySubs.mockResolvedValue([]);
    const mod = await import("./route");
    GET = mod.GET as unknown as (req: Request) => Promise<Response>;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it("returns 401 without authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(401);
  });

  it("accepts correct Bearer token", async () => {
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
  });

  // ── Sentry check-in ──────────────────────────────────────────────────

  it("creates Sentry check-in with correct schedule", async () => {
    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockCaptureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: "send-reminders", status: "in_progress" },
      expect.objectContaining({
        schedule: { type: "crontab", value: "* * * * *" },
        timezone: "America/Sao_Paulo",
      }),
    );
  });

  it("marks check-in as ok on success", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: true });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockCaptureCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ok" }),
    );
  });

  it("marks check-in as ok on early return (no matching settings)", async () => {
    mockFindManySettings.mockResolvedValue([]);
    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockCaptureCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ok" }),
    );
  });

  // ── Idempotency (split inflight/sent) ──────────────────────────────

  it("checks sent marker before acquiring inflight lock", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: true });

    await GET(makeRequest("Bearer test-cron-secret"));

    // isRateLimited called with sent: prefix (read-only check)
    expect(mockIsRateLimited).toHaveBeenCalledWith(
      expect.stringMatching(/^sent:reminder:u1:wakeReminder:/),
      1,
    );
    // checkRateLimit called with inflight: prefix (acquire lock)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^inflight:reminder:u1:wakeReminder:/),
      1,
      90_000,
    );
  });

  it("skips already-sent reminders via sent marker", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);

    // Sent marker exists → already delivered
    mockIsRateLimited.mockResolvedValue(true);

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("skips when inflight lock is already held by another worker", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);

    // Not yet sent, but inflight lock held
    mockIsRateLimited.mockResolvedValue(false);
    mockCheckRateLimit.mockResolvedValue(false);

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("marks sent after successful delivery", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: true });

    await GET(makeRequest("Bearer test-cron-secret"));

    // After successful send, checkRateLimit is called with sent: prefix (5 min TTL)
    const sentCalls = mockCheckRateLimit.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).startsWith("sent:"),
    );
    expect(sentCalls.length).toBeGreaterThanOrEqual(1);
    expect(sentCalls[0][2]).toBe(5 * 60_000);
  });

  // ── No matching settings ─────────────────────────────────────────────

  it("returns sent=0 when no reminder settings match", async () => {
    mockFindManySettings.mockResolvedValue([]);

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.ok).toBe(true);
  });

  // ── No subscriptions ─────────────────────────────────────────────────

  it("returns sent=0 when users have settings but no push subscriptions", async () => {
    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: "09:00", sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([]); // no subs

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  // ── Successful sending ────────────────────────────────────────────────

  it("sends push to matching user subscription", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      {
        userId: "u1",
        wakeReminder: spTime,
        sleepReminder: null,
        diaryReminder: null,
        breathingReminder: null,
      },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "key1", auth: "auth1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: true });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(mockSendPush).toHaveBeenCalledOnce();
  });

  it("sends to multiple subscriptions for same user", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push1", p256dh: "k1", auth: "a1" },
      { id: "sub-2", userId: "u1", endpoint: "https://fcm.googleapis.com/push2", p256dh: "k2", auth: "a2" },
    ]);

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(mockSendPush).toHaveBeenCalledTimes(2);
  });

  // ── Expired subscription cleanup ──────────────────────────────────────

  it("deletes expired subscriptions after sending", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: false, reason: "expired" });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.cleaned).toBe(1);
    expect(mockDeleteManySubs).toHaveBeenCalledWith({
      where: { id: { in: ["sub-1"] } },
    });
  });

  it("deletes invalid-endpoint subscriptions", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: false, reason: "invalid-endpoint" });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.cleaned).toBe(1);
  });

  // ── VAPID not configured ──────────────────────────────────────────────

  it("logs VAPID warning only once when config error", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push1", p256dh: "k1", auth: "a1" },
      { id: "sub-2", userId: "u1", endpoint: "https://fcm.googleapis.com/push2", p256dh: "k2", auth: "a2" },
    ]);
    mockSendPush.mockResolvedValue({ ok: false, reason: "config" });

    await GET(makeRequest("Bearer test-cron-secret"));

    // Should only log VAPID warning once, not per subscription
    const vapidCalls = mockCaptureMessage.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("VAPID"),
    );
    expect(vapidCalls.length).toBe(1);
  });

  // ── Error handling ────────────────────────────────────────────────────

  it("returns 500 and marks Sentry check-in as error on crash", async () => {
    mockFindManySettings.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
    expect(mockCaptureCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
    expect(mockCaptureException).toHaveBeenCalled();
  });

  // ── Transient errors don't trigger cleanup ────────────────────────────

  it("does not delete subscriptions on transient errors", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: false, reason: "transient" });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.cleaned).toBe(0);
    expect(mockDeleteManySubs).not.toHaveBeenCalled();
  });

  // ── Bad-request tracking ──────────────────────────────────────────────

  it("tracks bad-request errors without deleting subscriptions", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: false, reason: "bad-request" });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.cleaned).toBe(0);
    expect(mockDeleteManySubs).not.toHaveBeenCalled();

    // Should log bad-request count via Sentry
    const badRequestCalls = mockCaptureMessage.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("400"),
    );
    expect(badRequestCalls.length).toBe(1);
  });

  // ── Multiple reminders same time ──────────────────────────────────────

  it("sends multiple reminder types when they match same time", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      {
        userId: "u1",
        wakeReminder: spTime,
        diaryReminder: spTime, // both match
        sleepReminder: null,
        breathingReminder: null,
      },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.sent).toBe(2); // 2 reminders × 1 subscription
    expect(mockSendPush).toHaveBeenCalledTimes(2);
  });

  // ── Retry resilience ──────────────────────────────────────────────────

  it("does not mark sent when all sends fail (allows retry)", async () => {
    const spTime = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockFindManySettings.mockResolvedValue([
      { userId: "u1", wakeReminder: spTime, sleepReminder: null, diaryReminder: null, breathingReminder: null },
    ]);
    mockFindManySubs.mockResolvedValue([
      { id: "sub-1", userId: "u1", endpoint: "https://fcm.googleapis.com/push", p256dh: "k1", auth: "a1" },
    ]);
    mockSendPush.mockResolvedValue({ ok: false, reason: "transient" });

    await GET(makeRequest("Bearer test-cron-secret"));

    // No "sent:" marker should be created when all sends failed
    const sentCalls = mockCheckRateLimit.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).startsWith("sent:"),
    );
    expect(sentCalls.length).toBe(0);
  });
});
