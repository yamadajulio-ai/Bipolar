/**
 * Allowlist of known Web Push service hosts.
 * Shared between push-subscriptions route (write-time) and web-push lib (send-time).
 * This prevents SSRF via crafted subscription endpoints.
 */
export const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "wns.windows.com",
  "notify.windows.com",
  "push.api.chrome.google.com",
];

// Private/reserved hostnames that must never be used as push endpoints (SSRF)
const BLOCKED_HOSTNAMES = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]",
]);

function isPrivateOrReservedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  // IPv4 private ranges: 10.x, 172.16-31.x, 192.168.x, 169.254.x (link-local)
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
  // IPv6 link-local (fe80::), ULA (fc00::/fd00::), loopback (::1)
  if (/^(fe80|fc00|fd|::1)/i.test(hostname)) return true;
  return false;
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    // Only allow default HTTPS port (443) — reject arbitrary ports
    if (url.port !== "" && url.port !== "443") return false;
    // Block loopback, private, and reserved addresses (SSRF defense)
    if (isPrivateOrReservedHostname(url.hostname)) return false;
    return PUSH_SERVICE_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    );
  } catch {
    return false;
  }
}
