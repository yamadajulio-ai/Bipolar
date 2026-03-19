import crypto from "node:crypto";
import { describe, it, expect } from "vitest";

/**
 * Tests for WhatsApp webhook route logic.
 *
 * Since the route handlers depend on Next.js request/response objects and env vars,
 * we test the core security logic (HMAC verification) and payload parsing in isolation.
 * The verifyMetaSignature function is replicated from the route (not exported).
 */

// ─── Replicated from route.ts ─────────────────────────────────────────────────

function verifyMetaSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

const APP_SECRET = "test_app_secret_abc123";

function sign(body: string, secret: string = APP_SECRET): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("verifyMetaSignature", () => {
  describe("valid signatures", () => {
    it("accepts correctly signed body", () => {
      const body = '{"entry":[]}';
      const sig = sign(body);
      expect(verifyMetaSignature(body, sig, APP_SECRET)).toBe(true);
    });

    it("accepts empty body with valid signature", () => {
      const body = "";
      const sig = sign(body);
      expect(verifyMetaSignature(body, sig, APP_SECRET)).toBe(true);
    });

    it("accepts UTF-8 body with valid signature", () => {
      const body = '{"text":"Olá, como está?"}';
      const sig = sign(body);
      expect(verifyMetaSignature(body, sig, APP_SECRET)).toBe(true);
    });

    it("accepts large body with valid signature", () => {
      const body = JSON.stringify({ data: "x".repeat(100_000) });
      const sig = sign(body);
      expect(verifyMetaSignature(body, sig, APP_SECRET)).toBe(true);
    });
  });

  describe("invalid signatures — rejected", () => {
    it("rejects null signature", () => {
      expect(verifyMetaSignature("{}", null, APP_SECRET)).toBe(false);
    });

    it("rejects undefined signature", () => {
      expect(verifyMetaSignature("{}", undefined as unknown as string | null, APP_SECRET)).toBe(false);
    });

    it("rejects empty string signature", () => {
      expect(verifyMetaSignature("{}", "", APP_SECRET)).toBe(false);
    });

    it("rejects signature without sha256= prefix", () => {
      const body = "{}";
      const hash = crypto.createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex");
      expect(verifyMetaSignature(body, hash, APP_SECRET)).toBe(false);
    });

    it("rejects wrong secret", () => {
      const body = '{"entry":[]}';
      const sig = sign(body, "wrong_secret");
      expect(verifyMetaSignature(body, sig, APP_SECRET)).toBe(false);
    });

    it("rejects tampered body", () => {
      const body = '{"entry":[]}';
      const sig = sign(body);
      expect(verifyMetaSignature('{"entry":["tampered"]}', sig, APP_SECRET)).toBe(false);
    });

    it("rejects signature with correct prefix but wrong hash", () => {
      expect(verifyMetaSignature("{}", "sha256=0000000000000000000000000000000000000000000000000000000000000000", APP_SECRET)).toBe(false);
    });

    it("rejects truncated signature", () => {
      const body = "{}";
      const sig = sign(body);
      expect(verifyMetaSignature(body, sig.slice(0, 20), APP_SECRET)).toBe(false);
    });

    it("rejects signature with extra bytes appended", () => {
      const body = "{}";
      const sig = sign(body) + "extra";
      expect(verifyMetaSignature(body, sig, APP_SECRET)).toBe(false);
    });
  });

  describe("timing-safe comparison", () => {
    it("uses constant-time comparison (length mismatch = false, not throw)", () => {
      // Different length buffers should return false, not crash
      expect(verifyMetaSignature("{}", "sha256=short", APP_SECRET)).toBe(false);
    });
  });
});

// ─── Webhook payload parsing tests ────────────────────────────────────────────

describe("WhatsApp webhook payload parsing", () => {
  // These test the expected structure that the route handler processes

  describe("message extraction", () => {
    it("extracts text from standard WhatsApp webhook payload", () => {
      const payload = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: "5511999999999",
                text: { body: "  Olá  " },
              }],
            },
          }],
        }],
      };

      const entries = Array.isArray(payload.entry) ? payload.entry : [];
      const messages: Array<{ from: string; text: string }> = [];

      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change?.value;
          if (!value?.messages) continue;
          for (const message of value.messages) {
            const from = message.from;
            const text = message.text?.body?.trim().toLowerCase();
            if (text && from) {
              messages.push({ from, text });
            }
          }
        }
      }

      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe("5511999999999");
      expect(messages[0].text).toBe("olá"); // trimmed + lowercased
    });

    it("handles multiple entries and changes", () => {
      const payload = {
        entry: [
          {
            changes: [
              { value: { messages: [{ from: "1", text: { body: "A" } }] } },
              { value: { messages: [{ from: "2", text: { body: "B" } }] } },
            ],
          },
          {
            changes: [
              { value: { messages: [{ from: "3", text: { body: "C" } }] } },
            ],
          },
        ],
      };

      const entries = Array.isArray(payload.entry) ? payload.entry : [];
      let count = 0;
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          if (!change?.value?.messages) continue;
          for (const msg of change.value.messages) {
            if (msg.from && msg.text?.body?.trim()) count++;
          }
        }
      }

      expect(count).toBe(3);
    });

    it("skips messages without text", () => {
      const payload = {
        entry: [{
          changes: [{
            value: {
              messages: [
                { from: "1", image: { id: "abc" } }, // image, no text
                { from: "2", text: { body: "" } },    // empty text
                { from: "3" },                        // no text field at all
              ],
            },
          }],
        }],
      };

      const entries = payload.entry;
      let count = 0;
      for (const entry of entries) {
        for (const change of entry.changes) {
          if (!change?.value?.messages) continue;
          for (const msg of change.value.messages) {
            const text = msg.text?.body?.trim().toLowerCase();
            if (text && msg.from) count++;
          }
        }
      }

      expect(count).toBe(0);
    });

    it("skips messages without from", () => {
      const payload = {
        entry: [{
          changes: [{
            value: {
              messages: [
                { text: { body: "hello" } }, // no from
              ],
            },
          }],
        }],
      };

      const entries = payload.entry;
      let count = 0;
      for (const entry of entries) {
        for (const change of entry.changes) {
          if (!change?.value?.messages) continue;
          for (const msg of change.value.messages) {
            const text = (msg as Record<string, unknown>).text as { body?: string } | undefined;
            const from = (msg as Record<string, unknown>).from;
            if (text?.body?.trim() && from) count++;
          }
        }
      }

      expect(count).toBe(0);
    });

    it("handles empty entry array", () => {
      const payload = { entry: [] };
      const entries = Array.isArray(payload.entry) ? payload.entry : [];
      expect(entries).toHaveLength(0);
    });

    it("handles missing entry field", () => {
      const payload = {};
      const entries = Array.isArray((payload as Record<string, unknown>).entry) ? (payload as Record<string, unknown>).entry as unknown[] : [];
      expect(entries).toHaveLength(0);
    });

    it("handles changes without value.messages", () => {
      const payload = {
        entry: [{
          changes: [
            { value: { statuses: [{ id: "1", status: "delivered" }] } },
          ],
        }],
      };

      const entries = payload.entry;
      let count = 0;
      for (const entry of entries) {
        for (const change of entry.changes) {
          const value = change?.value as Record<string, unknown>;
          if (!value?.messages) continue;
          count++;
        }
      }

      expect(count).toBe(0); // statuses only, no messages
    });
  });

  describe("payload size limits", () => {
    it("256KB limit is reasonable for Meta payloads", () => {
      const maxBytes = 256 * 1024;
      // Typical Meta payload is <10KB
      const typicalPayload = JSON.stringify({
        entry: [{ changes: [{ value: { messages: [{ from: "1", text: { body: "hello" } }] } }] }],
      });
      expect(Buffer.byteLength(typicalPayload, "utf8")).toBeLessThan(maxBytes);
    });

    it("detects oversized payloads via Buffer.byteLength", () => {
      const oversized = "x".repeat(256 * 1024 + 1);
      expect(Buffer.byteLength(oversized, "utf8")).toBeGreaterThan(256 * 1024);
    });

    it("accounts for multi-byte UTF-8 characters", () => {
      // Each emoji is 4 bytes in UTF-8
      const emoji = "😀".repeat(100);
      expect(Buffer.byteLength(emoji, "utf8")).toBe(400); // 4 bytes × 100
      expect(emoji.length).toBe(200); // JS string length (2 surrogates per emoji)
    });
  });
});
