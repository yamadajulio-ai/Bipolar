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
  "localhost", "0.0.0.0",
]);

function isPrivateOrReservedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;

  // Strip brackets from IPv6 hostnames — URL().hostname returns "[::1]" for IPv6
  const bare = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // IPv4 loopback: full 127.0.0.0/8 range (not just 127.0.0.1)
  if (/^127\./.test(bare)) return true;
  // IPv4 private ranges: 10.x, 172.16-31.x, 192.168.x, 169.254.x (link-local/AWS metadata)
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(bare)) return true;
  // IPv4-mapped IPv6: ::ffff:127.0.0.1, ::ffff:10.0.0.1, etc.
  if (/^::ffff:/i.test(bare)) {
    const mapped = bare.slice(7); // strip "::ffff:"
    if (/^127\./.test(mapped)) return true;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(mapped)) return true;
  }
  // IPv6 loopback (::1)
  if (bare === "::1") return true;
  // IPv6 link-local (fe80::), ULA (fc00::/fd00::)
  if (/^(fe80|fc00|fd[0-9a-f]{0,2}:)/i.test(bare)) return true;
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
