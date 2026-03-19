import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for web-push.ts — sendPush function.
 *
 * We mock the `web-push` npm module and test:
 * 1. VAPID configuration behavior
 * 2. Endpoint allowlist enforcement at send-time
 * 3. HTTP status code → PushResult mapping
 * 4. TTL configuration
 */

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

// ─── Dynamic import (after mocks) ────────────────────────────────────────────

async function loadModule() {
  // Clear module cache to reset vapidConfigured state
  vi.resetModules();
  const mod = await import("./web-push");
  return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sendPush", () => {
  const validSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    p256dh: "BNcRd1234567890abcdef",
    auth: "auth1234567890ab",
  };
  const payload = { title: "Test", body: "Hello" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
  });

  afterEach(() => {
    // Restore env vars
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  describe("VAPID configuration", () => {
    it("returns config error when VAPID keys are missing", async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      const { sendPush } = await loadModule();

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "config" });
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("returns config error when only public key is set", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      delete process.env.VAPID_PRIVATE_KEY;
      const { sendPush } = await loadModule();

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "config" });
    });

    it("configures VAPID and sends when both keys are set", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      const { sendPush } = await loadModule();

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: true });
      expect(mockSetVapidDetails).toHaveBeenCalledWith(
        "mailto:contato@suportebipolar.com",
        "pubkey",
        "privkey",
      );
      expect(mockSendNotification).toHaveBeenCalledOnce();
    });

    it("uses custom VAPID_SUBJECT when set", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      process.env.VAPID_SUBJECT = "mailto:custom@example.com";
      const { sendPush } = await loadModule();

      await sendPush(validSub, payload);
      expect(mockSetVapidDetails).toHaveBeenCalledWith(
        "mailto:custom@example.com",
        "pubkey",
        "privkey",
      );
    });

    it("only configures VAPID once (lazy init)", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      const { sendPush } = await loadModule();

      await sendPush(validSub, payload);
      await sendPush(validSub, payload);

      expect(mockSetVapidDetails).toHaveBeenCalledTimes(1);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe("endpoint allowlist enforcement (send-time SSRF guard)", () => {
    it("rejects non-allowlisted endpoint", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      const { sendPush } = await loadModule();

      const result = await sendPush(
        { ...validSub, endpoint: "https://evil.com/push" },
        payload,
      );
      expect(result).toEqual({ ok: false, reason: "invalid-endpoint" });
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("rejects HTTP endpoint", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      const { sendPush } = await loadModule();

      const result = await sendPush(
        { ...validSub, endpoint: "http://fcm.googleapis.com/push" },
        payload,
      );
      expect(result).toEqual({ ok: false, reason: "invalid-endpoint" });
    });

    it("rejects localhost endpoint", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      const { sendPush } = await loadModule();

      const result = await sendPush(
        { ...validSub, endpoint: "https://localhost:8080/push" },
        payload,
      );
      expect(result).toEqual({ ok: false, reason: "invalid-endpoint" });
    });

    it("accepts all known push service hosts", async () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
      const { sendPush } = await loadModule();

      const hosts = [
        "https://fcm.googleapis.com/push",
        "https://updates.push.services.mozilla.com/push",
        "https://push.services.mozilla.com/push",
        "https://web.push.apple.com/push",
        "https://wns.windows.com/push",
        "https://notify.windows.com/push",
        "https://push.api.chrome.google.com/push",
      ];

      for (const endpoint of hosts) {
        mockSendNotification.mockResolvedValueOnce({ statusCode: 201 });
        const result = await sendPush({ ...validSub, endpoint }, payload);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("HTTP status code handling", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
    });

    it("returns ok on successful send", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockResolvedValueOnce({ statusCode: 201 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: true });
    });

    it("returns expired on 410 Gone", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce({ statusCode: 410 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "expired" });
    });

    it("returns expired on 404 Not Found", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce({ statusCode: 404 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "expired" });
    });

    it("returns invalid-key on 400 Bad Request", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce({ statusCode: 400 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "invalid-key" });
    });

    it("returns invalid-key on 403 Forbidden", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce({ statusCode: 403 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "invalid-key" });
    });

    it("returns transient on 500 Server Error", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce({ statusCode: 500 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "transient" });
    });

    it("returns transient on 429 Too Many Requests", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce({ statusCode: 429 });

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "transient" });
    });

    it("returns transient on network error (no statusCode)", async () => {
      const { sendPush } = await loadModule();
      mockSendNotification.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await sendPush(validSub, payload);
      expect(result).toEqual({ ok: false, reason: "transient" });
    });
  });

  describe("payload and options", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pubkey";
      process.env.VAPID_PRIVATE_KEY = "privkey";
    });

    it("sends JSON-stringified payload", async () => {
      const { sendPush } = await loadModule();

      const testPayload = { title: "Bom dia!", body: "Registre seu sono", tag: "wake", url: "/sono" };
      await sendPush(validSub, testPayload);

      const call = mockSendNotification.mock.calls[0];
      expect(call[1]).toBe(JSON.stringify(testPayload));
    });

    it("sets TTL to 1800 seconds (30 minutes)", async () => {
      const { sendPush } = await loadModule();

      await sendPush(validSub, payload);

      const call = mockSendNotification.mock.calls[0];
      expect(call[2]).toEqual({ TTL: 1800 });
    });

    it("sends correct subscription object format", async () => {
      const { sendPush } = await loadModule();

      await sendPush(validSub, payload);

      const call = mockSendNotification.mock.calls[0];
      expect(call[0]).toEqual({
        endpoint: validSub.endpoint,
        keys: {
          p256dh: validSub.p256dh,
          auth: validSub.auth,
        },
      });
    });
  });
});
