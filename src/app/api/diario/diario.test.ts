import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Integration tests for diary snapshot routes: POST, PATCH, GET, confirm-summary.
 * Focus: CAS atomicity, edit window, feature flags, concurrency.
 */

// ─── Mock state ─────────────────────────────────────────────────────────────

const mockSession = {
  isLoggedIn: true,
  userId: "user-1",
  email: "test@example.com",
  save: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

const mockCheckRateLimit = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/security", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/dateUtils", () => ({
  localDateStr: vi.fn(() => "2026-03-22"),
}));

vi.mock("@/lib/featureFlags", () => ({
  isSnapshotEnabled: vi.fn(() => true),
}));

// ─── Prisma mock ────────────────────────────────────────────────────────────

const mockSnapshotFindUnique = vi.fn();
const mockSnapshotFindFirst = vi.fn();
const mockSnapshotFindMany = vi.fn().mockResolvedValue([]);
const mockSnapshotCreate = vi.fn();
const mockSnapshotUpdate = vi.fn();
const mockEntryUpsert = vi.fn();
const mockEntryUpdate = vi.fn();
const mockEntryUpdateMany = vi.fn();
const mockEntryFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    moodSnapshot: {
      findUnique: mockSnapshotFindUnique,
      findFirst: mockSnapshotFindFirst,
      findMany: mockSnapshotFindMany,
      create: mockSnapshotCreate,
      update: mockSnapshotUpdate,
    },
    diaryEntry: {
      upsert: mockEntryUpsert,
      update: mockEntryUpdate,
      updateMany: mockEntryUpdateMany,
      findUnique: mockEntryFindUnique,
    },
  },
}));

vi.mock("@/lib/diary/projectSnapshots", () => ({
  AGGREGATION_VERSION: 1,
  projectSnapshots: vi.fn(() => ({
    mood: 3, energyLevel: 3, anxietyLevel: 2, irritability: 2,
    warningSigns: null, note: null, snapshotCount: 2,
    firstSnapshotAt: new Date(), lastSnapshotAt: new Date(),
    moodRange: 1, moodInstability: 0.5, anxietyPeak: 3, irritabilityPeak: 3,
    morningEveningDelta: 0, abruptShifts: 0, aggregationVersion: 1,
    riskScoreCurrent: 0, riskScorePeak: 1,
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, url: string): NextRequest {
  return new NextRequest(new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

function makePatch(body: unknown, url: string): NextRequest {
  return new NextRequest(new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isLoggedIn = true;
  mockSession.userId = "user-1";
  mockCheckRateLimit.mockResolvedValue(true);
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRM-SUMMARY — CAS Atomicity
// ═══════════════════════════════════════════════════════════════════════════

describe("PATCH /api/diario/confirm-summary", () => {
  let PATCH: (req: NextRequest) => Promise<Response>;
  const url = "https://suportebipolar.com/api/diario/confirm-summary";

  beforeEach(async () => {
    ({ PATCH } = await import("./confirm-summary/route"));
  });

  it("returns 401 when not logged in", async () => {
    mockSession.isLoggedIn = false;
    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false);
    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid date format", async () => {
    const res = await PATCH(makePatch({ date: "invalid", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(400);
  });

  it("returns 400 when snapshotCount < 1", async () => {
    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 0 }, url));
    expect(res.status).toBe(400);
  });

  it("confirms when CAS tokens match (updateMany count=1)", async () => {
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 1 });
    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.confirmed).toBe(true);

    // Verify updateMany was called with tokens in WHERE
    expect(mockEntryUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        aggregationVersion: 1,
        snapshotCount: 2,
        mode: "AUTO_FROM_SNAPSHOT",
      }),
      data: expect.objectContaining({ summaryConfirmedAt: expect.any(Date) }),
    });
  });

  it("returns 409 Conflict when CAS tokens are stale (concurrent reprojectEntry)", async () => {
    // Simulate: updateMany matched 0 rows because aggregationVersion changed
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 0 });
    // Diagnostic read: entry exists and is AUTO_FROM_SNAPSHOT
    mockEntryFindUnique.mockResolvedValueOnce({ mode: "AUTO_FROM_SNAPSHOT" });

    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.stale).toBe(true);
  });

  it("returns 404 when entry does not exist", async () => {
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockEntryFindUnique.mockResolvedValueOnce(null);

    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(404);
  });

  it("returns 400 when entry mode is not AUTO_FROM_SNAPSHOT", async () => {
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockEntryFindUnique.mockResolvedValueOnce({ mode: "LEGACY_SINGLE" });

    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(400);
  });

  it("two simultaneous confirms with same tokens — only one succeeds", async () => {
    // Simulate: first call gets count=1, second gets count=0 (PostgreSQL serializes)
    mockEntryUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mockEntryFindUnique.mockResolvedValueOnce({ mode: "AUTO_FROM_SNAPSHOT" });

    const req1 = makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url);
    const req2 = makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url);

    const [res1, res2] = await Promise.all([PATCH(req1), PATCH(req2)]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(409);
  });

  it("confirm after reprojectEntry (version bumped) → 409", async () => {
    // Client had version=1, snapshotCount=2, but reprojectEntry changed snapshotCount to 3
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockEntryFindUnique.mockResolvedValueOnce({ mode: "AUTO_FROM_SNAPSHOT" });

    const res = await PATCH(makePatch({ date: "2026-03-22", aggregationVersion: 1, snapshotCount: 2 }, url));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.stale).toBe(true);
    expect(body.error).toContain("atualizado");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT EDIT (PATCH) — Edit Window & Legacy Block
// ═══════════════════════════════════════════════════════════════════════════

describe("PATCH /api/diario/snapshots — edit window", () => {
  let PATCH: (req: NextRequest) => Promise<Response>;
  const url = "https://suportebipolar.com/api/diario/snapshots";

  beforeEach(async () => {
    ({ PATCH } = await import("./snapshots/route"));
  });

  it("blocks editing legacy snapshots without receivedAt", async () => {
    mockSnapshotFindUnique.mockResolvedValueOnce({
      id: "snap-1",
      userId: "user-1",
      localDate: "2026-03-22",
      capturedAt: new Date(),
      receivedAt: null, // legacy — no server anchor
      diaryEntryId: "entry-1",
    });

    const res = await PATCH(makePatch({ snapshotId: "snap-1", mood: 4 }, url));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("antes da funcionalidade");
  });

  it("blocks editing when 15-min window expired", async () => {
    mockSnapshotFindUnique.mockResolvedValueOnce({
      id: "snap-1",
      userId: "user-1",
      localDate: "2026-03-22",
      capturedAt: new Date(Date.now() - 20 * 60 * 1000),
      receivedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
      diaryEntryId: "entry-1",
    });

    const res = await PATCH(makePatch({ snapshotId: "snap-1", mood: 4 }, url));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("15 minutos");
  });

  it("allows editing within 15-min window", async () => {
    const now = new Date();
    mockSnapshotFindUnique.mockResolvedValueOnce({
      id: "snap-1",
      userId: "user-1",
      localDate: "2026-03-22",
      capturedAt: now,
      receivedAt: now, // fresh
      diaryEntryId: "entry-1",
    });
    mockSnapshotFindFirst.mockResolvedValueOnce({ id: "snap-1" }); // is latest
    mockSnapshotUpdate.mockResolvedValueOnce({});
    mockSnapshotFindMany.mockResolvedValueOnce([{ capturedAt: now, mood: 4, energy: 3, anxiety: 2, irritability: 2, warningSignsNow: null, note: null }]);
    mockEntryUpdate.mockResolvedValueOnce({});

    const res = await PATCH(makePatch({ snapshotId: "snap-1", mood: 4 }, url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(true);
  });

  it("blocks editing non-latest snapshot", async () => {
    const now = new Date();
    mockSnapshotFindUnique.mockResolvedValueOnce({
      id: "snap-1",
      userId: "user-1",
      localDate: "2026-03-22",
      capturedAt: now,
      receivedAt: now,
      diaryEntryId: "entry-1",
    });
    mockSnapshotFindFirst.mockResolvedValueOnce({ id: "snap-2" }); // different = not latest

    const res = await PATCH(makePatch({ snapshotId: "snap-1", mood: 4 }, url));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("último registro");
  });

  it("returns 404 for snapshot belonging to another user", async () => {
    mockSnapshotFindUnique.mockResolvedValueOnce({
      id: "snap-1",
      userId: "other-user",
      localDate: "2026-03-22",
      capturedAt: new Date(),
      receivedAt: new Date(),
      diaryEntryId: "entry-1",
    });

    const res = await PATCH(makePatch({ snapshotId: "snap-1", mood: 4 }, url));
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT CREATE (POST) — Feature Flag & Idempotency
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/diario/snapshots", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  const url = "https://suportebipolar.com/api/diario/snapshots";

  beforeEach(async () => {
    ({ POST } = await import("./snapshots/route"));
  });

  it("returns 503 when feature flag is disabled", async () => {
    const { isSnapshotEnabled } = await import("@/lib/featureFlags");
    (isSnapshotEnabled as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const res = await POST(makeRequest({
      mood: 3, energy: 3, anxiety: 2, irritability: 2,
      clientRequestId: "test-1",
    }, url));
    expect(res.status).toBe(503);
  });

  it("returns 200 with deduplicated flag for duplicate clientRequestId", async () => {
    mockSnapshotFindUnique.mockResolvedValueOnce({ id: "existing-snap", diaryEntryId: "entry-1" });

    const res = await POST(makeRequest({
      mood: 3, energy: 3, anxiety: 2, irritability: 2,
      clientRequestId: "already-sent",
    }, url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deduplicated).toBe(true);
  });

  it("returns 201 on successful snapshot creation", async () => {
    mockSnapshotFindUnique.mockResolvedValueOnce(null); // no duplicate
    mockEntryUpsert.mockResolvedValueOnce({ id: "entry-1" });
    mockSnapshotCreate.mockResolvedValueOnce({ id: "snap-new", capturedAt: new Date() });
    mockSnapshotFindMany.mockResolvedValueOnce([{ capturedAt: new Date(), mood: 3, energy: 3, anxiety: 2, irritability: 2, warningSignsNow: null, note: null }]);
    mockEntryUpdate.mockResolvedValueOnce({});

    const res = await POST(makeRequest({
      mood: 3, energy: 3, anxiety: 2, irritability: 2,
      clientRequestId: "new-req",
    }, url));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("snap-new");
  });

  it("returns 400 for invalid mood value", async () => {
    const res = await POST(makeRequest({
      mood: 6, energy: 3, anxiety: 2, irritability: 2,
      clientRequestId: "bad-mood",
    }, url));
    expect(res.status).toBe(400);
  });
});
