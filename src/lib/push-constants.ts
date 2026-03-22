import * as ipaddr from "ipaddr.js";

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

/**
 * Private/reserved CIDR ranges that must never be used as push endpoints (SSRF).
 * Uses ipaddr.js for robust IPv4/IPv6 parsing — no hand-rolled regex.
 */
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

function isPrivateOrReservedIP(ip: string): boolean {
  try {
    let addr = ipaddr.parse(ip);

    // If it's IPv4-mapped IPv6 (::ffff:x.x.x.x), extract the IPv4 part
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      addr = (addr as ipaddr.IPv6).toIPv4Address();
    }

    // ipaddr.js range() returns one of:
    // IPv4: 'unspecified', 'broadcast', 'loopback', 'multicast', 'linkLocal',
    //        'private', 'carrierGradeNat', 'reserved', 'unicast'
    // IPv6: 'unspecified', 'loopback', 'multicast', 'linkLocal', 'uniqueLocal',
    //        'ipv4Mapped', '6to4', 'teredo', 'reserved', 'benchmarking',
    //        'amt', 'as112v6', 'deprecated', 'orchid2', 'droneRemoteIdProtocol', 'unicast'
    const range = addr.range();

    const BLOCKED_RANGES = new Set([
      "unspecified",
      "broadcast",
      "loopback",
      "multicast",
      "linkLocal",
      "private",
      "carrierGradeNat",
      "reserved",
      "uniqueLocal",
      "benchmarking",
      "discard",
    ]);

    return BLOCKED_RANGES.has(range);
  } catch {
    // If parsing fails, treat as suspicious → block
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
