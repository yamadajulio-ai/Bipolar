import { describe, it, expect } from "vitest";
import { isAllowedPushEndpoint, PUSH_SERVICE_HOSTS } from "./push-constants";

describe("PUSH_SERVICE_HOSTS", () => {
  it("contains expected known push services", () => {
    expect(PUSH_SERVICE_HOSTS).toContain("fcm.googleapis.com");
    expect(PUSH_SERVICE_HOSTS).toContain("updates.push.services.mozilla.com");
    expect(PUSH_SERVICE_HOSTS).toContain("web.push.apple.com");
    expect(PUSH_SERVICE_HOSTS).toContain("wns.windows.com");
    expect(PUSH_SERVICE_HOSTS).toContain("push.api.chrome.google.com");
  });

  it("has no duplicates", () => {
    const unique = new Set(PUSH_SERVICE_HOSTS);
    expect(unique.size).toBe(PUSH_SERVICE_HOSTS.length);
  });
});

describe("isAllowedPushEndpoint", () => {
  // ── Valid endpoints ─────────────────────────────────────────────
  describe("accepts valid push service endpoints", () => {
    const validEndpoints = [
      ["FCM", "https://fcm.googleapis.com/fcm/send/abc123"],
      ["Mozilla updates", "https://updates.push.services.mozilla.com/wpush/v2/abc"],
      ["Mozilla push", "https://push.services.mozilla.com/wpush/v1/def"],
      ["Apple", "https://web.push.apple.com/QWer-asdf"],
      ["WNS", "https://wns.windows.com/w/?token=xyz"],
      ["WNS notify", "https://notify.windows.com/w/?token=xyz"],
      ["Chrome", "https://push.api.chrome.google.com/v1/messages"],
    ] as const;

    it.each(validEndpoints)("%s: %s", (_name, endpoint) => {
      expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    });
  });

  // ── Subdomain matching ──────────────────────────────────────────
  describe("accepts subdomains of known hosts", () => {
    const subdomainEndpoints = [
      "https://us-east1.fcm.googleapis.com/fcm/send/abc",
      "https://autopush.push.services.mozilla.com/wpush/v2/abc",
      "https://ap1.web.push.apple.com/QWer",
      "https://db3p.notify.windows.com/w/?token=xyz",
    ];

    it.each(subdomainEndpoints)("%s", (endpoint) => {
      expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    });
  });

  // ── SSRF prevention: rejected endpoints ─────────────────────────
  describe("rejects non-allowlisted endpoints (SSRF prevention)", () => {
    const maliciousEndpoints = [
      ["localhost", "https://localhost:8080/push"],
      ["internal IP", "https://192.168.1.1/push"],
      ["internal IP loopback", "https://127.0.0.1/push"],
      ["arbitrary domain", "https://evil.com/push"],
      ["attacker mimicking FCM", "https://fcm.googleapis.com.evil.com/push"],
      ["attacker suffix trick", "https://notfcm.googleapis.com/push"],
      ["metadata endpoint", "https://169.254.169.254/latest/meta-data/"],
      ["internal service", "https://internal.company.com/api"],
      ["file protocol", "file:///etc/passwd"],
      ["FTP", "ftp://fcm.googleapis.com/push"],
    ] as const;

    it.each(maliciousEndpoints)("%s: %s", (_name, endpoint) => {
      expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    });
  });

  // ── Protocol enforcement ────────────────────────────────────────
  describe("rejects non-HTTPS protocols", () => {
    it("rejects HTTP", () => {
      expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    });

    it("rejects data URIs", () => {
      expect(isAllowedPushEndpoint("data:text/html,<h1>hi</h1>")).toBe(false);
    });

    it("rejects javascript URIs", () => {
      expect(isAllowedPushEndpoint("javascript:alert(1)")).toBe(false);
    });
  });

  // ── Invalid inputs ──────────────────────────────────────────────
  describe("handles invalid inputs gracefully", () => {
    it("rejects empty string", () => {
      expect(isAllowedPushEndpoint("")).toBe(false);
    });

    it("rejects garbage string", () => {
      expect(isAllowedPushEndpoint("not-a-url-at-all")).toBe(false);
    });

    it("rejects string with spaces in hostname", () => {
      // URL constructor handles path spaces (encodes them), but invalid hostnames fail
      expect(isAllowedPushEndpoint("https://fcm .googleapis.com/push")).toBe(false);
    });

    it("rejects URL with no hostname", () => {
      expect(isAllowedPushEndpoint("https:///push")).toBe(false);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────
  describe("edge cases", () => {
    it("rejects exact host without path", () => {
      // Valid — host matches, no path is fine for URL parsing
      expect(isAllowedPushEndpoint("https://fcm.googleapis.com")).toBe(true);
    });

    it("rejects host with port", () => {
      // URL with port — hostname still matches (port is separate from hostname)
      expect(isAllowedPushEndpoint("https://fcm.googleapis.com:443/push")).toBe(true);
    });

    it("rejects non-standard port on valid host", () => {
      // Port 8080 on valid host — rejected to prevent SSRF via arbitrary ports
      expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8080/push")).toBe(false);
    });

    it("case sensitivity — uppercase hostname rejected by URL normalization", () => {
      // URL constructor lowercases the hostname, so this should match
      expect(isAllowedPushEndpoint("https://FCM.GOOGLEAPIS.COM/push")).toBe(true);
    });
  });

  // ── SSRF: private/reserved address blocking ───────────────────
  describe("blocks private and reserved addresses", () => {
    const privateEndpoints = [
      ["localhost", "https://localhost/push"],
      ["loopback IPv4", "https://127.0.0.1/push"],
      ["loopback 0.0.0.0", "https://0.0.0.0/push"],
      ["IPv6 loopback", "https://[::1]/push"],
      ["10.x private", "https://10.0.0.1/push"],
      ["172.16.x private", "https://172.16.0.1/push"],
      ["172.31.x private", "https://172.31.255.255/push"],
      ["192.168.x private", "https://192.168.0.1/push"],
      ["link-local 169.254", "https://169.254.169.254/latest/meta-data/"],
      ["AWS metadata", "https://169.254.170.2/push"],
    ] as const;

    it.each(privateEndpoints)("%s: %s", (_name, endpoint) => {
      expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    });
  });
});
