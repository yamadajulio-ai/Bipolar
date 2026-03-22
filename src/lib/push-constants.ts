import * as ipaddr from "ipaddr.js";

/**
 * Allowlist of known Web Push service hosts.
 * Shared between push-subscriptions route (write-time) and web-push lib (send-time).
 * This prevents SSRF via crafted subscription endpoints.
 *
 * Per-provider wildcard policy: only families that officially use subdomains
 * (WNS, Mozilla) get wildcard matching. Others require exact host match.
 */

/** Hosts that allow subdomain matching — only for providers with documented wildcard FQDNs */
const WILDCARD_HOSTS = new Set([
  "wns.windows.com",         // Microsoft WNS: documented *.wns.windows.com
  "notify.windows.com",      // Microsoft WNS: documented *.notify.windows.com
  "web.push.apple.com",      // Apple: regional prefixes (ap1, etc.)
]);

/** Hosts that require exact match only (no wildcard subdomains) */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",                 // Google FCM: single documented endpoint
  "push.api.chrome.google.com",         // Chrome: single documented endpoint
  "push.services.mozilla.com",          // Mozilla Autopush: exact documented endpoint
  "updates.push.services.mozilla.com",  // Mozilla Autopush: exact documented endpoint
]);

/** All known push service hosts (exported for tests) */
export const PUSH_SERVICE_HOSTS = [
  ...EXACT_HOSTS,
  ...WILDCARD_HOSTS,
];

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

/**
 * Allowlist-only IP policy: only "unicast" range passes.
 * All other ranges (loopback, private, reserved, teredo, 6to4, etc.) are blocked.
 * This is fail-closed by design — new/unknown ranges are automatically blocked.
 */
function isPrivateOrReservedIP(ip: string): boolean {
  try {
    let addr = ipaddr.parse(ip);

    // If it's IPv4-mapped IPv6 (::ffff:x.x.x.x), extract the IPv4 part
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      addr = (addr as ipaddr.IPv6).toIPv4Address();
    }

    // Only allow unicast — everything else is blocked (fail-closed)
    return addr.range() !== "unicast";
  } catch {
    // Parse failure → block
    return true;
  }
}

function isPrivateOrReservedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;

  // Strip brackets from IPv6 hostnames — URL().hostname returns "[::1]" for IPv6
  const bare = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // Use ipaddr.js for all IP validation — handles IPv4, IPv6, mapped, and edge cases
  if (ipaddr.isValid(bare)) {
    return isPrivateOrReservedIP(bare);
  }

  return false;
}

function matchesAllowedHost(hostname: string): boolean {
  // Check exact hosts first
  if (EXACT_HOSTS.has(hostname)) return true;

  // Check wildcard hosts (exact match OR subdomain)
  for (const host of WILDCARD_HOSTS) {
    if (hostname === host || hostname.endsWith("." + host)) return true;
  }

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
    return matchesAllowedHost(url.hostname);
  } catch {
    return false;
  }
}
