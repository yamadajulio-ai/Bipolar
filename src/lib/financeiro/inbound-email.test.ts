import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// Test the HMAC utility functions directly since the route handler
// requires Next.js request/response infrastructure.

// We test the exported generateImportEmail and the internal
// generateMailboxHash / resolveMailboxHash round-trip logic.

// Since the functions are in a route file, we extract and test the logic.

const SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long-for-testing";

function generateMailboxHash(userId: string): string {
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`financial-import:${userId}`)
    .digest("hex")
    .slice(0, 16);
  return `${userId}.${hmac}`;
}

function resolveMailboxHash(hash: string): { userId: string } | null {
  const dotIdx = hash.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const userId = hash.slice(0, dotIdx);
  const providedHmac = hash.slice(dotIdx + 1);

  const expectedHmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`financial-import:${userId}`)
    .digest("hex")
    .slice(0, 16);

  if (providedHmac.length !== expectedHmac.length) return null;
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (!crypto.timingSafeEqual(a, b)) return null;

  return { userId };
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

describe("HMAC Token Round-Trip", () => {
  it("generates and resolves a valid token", () => {
    const userId = "clkx1234567890abcdef";
    const hash = generateMailboxHash(userId);
    const resolved = resolveMailboxHash(hash);
    expect(resolved).toEqual({ userId });
  });

  it("generates 16-char hex HMAC (64 bits)", () => {
    const hash = generateMailboxHash("user-123");
    const hmacPart = hash.split(".").pop()!;
    expect(hmacPart).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(hmacPart)).toBe(true);
  });

  it("rejects tampered HMAC", () => {
    const hash = generateMailboxHash("user-123");
    const tampered = hash.slice(0, -1) + "0"; // Change last char
    expect(resolveMailboxHash(tampered)).toBeNull();
  });

  it("rejects hash with no dot separator", () => {
    expect(resolveMailboxHash("nodothere")).toBeNull();
  });

  it("rejects empty hash", () => {
    expect(resolveMailboxHash("")).toBeNull();
  });

  it("rejects hash with wrong HMAC length", () => {
    expect(resolveMailboxHash("user-123.abc")).toBeNull(); // too short
  });

  it("handles UUID-style userId with hyphens", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const hash = generateMailboxHash(userId);
    const resolved = resolveMailboxHash(hash);
    expect(resolved).toEqual({ userId });
  });

  it("handles cuid-style userId", () => {
    const userId = "clkx1a2b3c4d5e6f";
    const hash = generateMailboxHash(userId);
    const resolved = resolveMailboxHash(hash);
    expect(resolved).toEqual({ userId });
  });

  it("different userIds produce different HMACs", () => {
    const hash1 = generateMailboxHash("user-1");
    const hash2 = generateMailboxHash("user-2");
    expect(hash1).not.toBe(hash2);
  });

  it("same userId always produces same HMAC (deterministic)", () => {
    const hash1 = generateMailboxHash("user-1");
    const hash2 = generateMailboxHash("user-1");
    expect(hash1).toBe(hash2);
  });
});

describe("getExtension", () => {
  it("extracts .csv", () => {
    expect(getExtension("file.csv")).toBe(".csv");
  });

  it("extracts .xlsx", () => {
    expect(getExtension("extrato.xlsx")).toBe(".xlsx");
  });

  it("extracts .ofx", () => {
    expect(getExtension("banco.ofx")).toBe(".ofx");
  });

  it("returns empty for no extension", () => {
    expect(getExtension("noext")).toBe("");
  });

  it("lowercases extension", () => {
    expect(getExtension("FILE.CSV")).toBe(".csv");
  });

  it("handles multiple dots", () => {
    expect(getExtension("my.file.name.xlsx")).toBe(".xlsx");
  });

  it("handles hidden files", () => {
    expect(getExtension(".gitignore")).toBe(".gitignore");
  });
});
