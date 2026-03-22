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
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

/** Parse dotted IPv4 string → 32-bit unsigned number, or null if invalid */
function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }
  return num >>> 0; // ensure unsigned
}

/** Check if a 32-bit IPv4 address falls in private/reserved ranges */
function isPrivateIPv4(ip: number): boolean {
  // 127.0.0.0/8 — loopback
  if ((ip >>> 24) === 127) return true;
  // 10.0.0.0/8 — private
  if ((ip >>> 24) === 10) return true;
  // 172.16.0.0/12 — private (172.16.x – 172.31.x)
  if ((ip >>> 16) >= 0xac10 && (ip >>> 16) <= 0xac1f) return true;
  // 192.168.0.0/16 — private
  if ((ip >>> 16) === 0xc0a8) return true;
  // 169.254.0.0/16 — link-local (AWS metadata, APIPA)
  if ((ip >>> 16) === 0xa9fe) return true;
  // 0.0.0.0/8 — "this" network
  if ((ip >>> 24) === 0) return true;
  return false;
}

/**
 * Parse IPv6 address → 8 x 16-bit groups, or null if invalid.
 * Handles :: expansion and IPv4-mapped suffixes (::ffff:1.2.3.4).
 */
function parseIPv6(addr: string): number[] | null {
  // Check for IPv4-mapped suffix (e.g., ::ffff:192.168.1.1)
  const lastColon = addr.lastIndexOf(":");
  const possibleV4 = addr.slice(lastColon + 1);
  let ipv4Tail: number[] | null = null;
  if (possibleV4.includes(".")) {
    const v4 = parseIPv4(possibleV4);
    if (v4 === null) return null;
    ipv4Tail = [(v4 >>> 16) & 0xffff, v4 & 0xffff];
    // Replace the IPv4 suffix with two placeholder hex groups for parsing
    addr = addr.slice(0, lastColon + 1) + "0:0";
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null; // only one :: allowed

  const parseGroups = (s: string): number[] | null => {
    if (s === "") return [];
    const parts = s.split(":");
    const groups: number[] = [];
    for (const p of parts) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(p)) return null;
      groups.push(parseInt(p, 16));
    }
    return groups;
  };

  let groups: number[];
  if (halves.length === 2) {
    const left = parseGroups(halves[0]);
    const right = parseGroups(halves[1]);
    if (!left || !right) return null;
    const fill = 8 - left.length - right.length;
    if (fill < 0) return null;
    groups = [...left, ...new Array(fill).fill(0), ...right];
  } else {
    const g = parseGroups(halves[0]);
    if (!g || g.length !== 8) return null;
    groups = g;
  }

  // Replace last 2 groups with actual IPv4-mapped values
  if (ipv4Tail) {
    groups[6] = ipv4Tail[0];
    groups[7] = ipv4Tail[1];
  }

  return groups.length === 8 ? groups : null;
}

function isPrivateOrReservedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;

  // Strip brackets from IPv6 hostnames — URL().hostname returns "[::1]" for IPv6
  const bare = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // Try IPv4 first
  const v4 = parseIPv4(bare);
  if (v4 !== null) return isPrivateIPv4(v4);

  // Try IPv6
  const v6 = parseIPv6(bare);
  if (v6) {
    // ::1 — loopback
    if (v6[0] === 0 && v6[1] === 0 && v6[2] === 0 && v6[3] === 0 &&
        v6[4] === 0 && v6[5] === 0 && v6[6] === 0 && v6[7] === 1) return true;
    // :: (all zeros) — unspecified
    if (v6.every((g) => g === 0)) return true;
    // ::ffff:x.x.x.x — IPv4-mapped IPv6 → check the embedded IPv4
    if (v6[0] === 0 && v6[1] === 0 && v6[2] === 0 && v6[3] === 0 &&
        v6[4] === 0 && v6[5] === 0xffff) {
      const embeddedV4 = ((v6[6] << 16) | v6[7]) >>> 0;
      return isPrivateIPv4(embeddedV4);
    }
    // fe80::/10 — link-local
    if ((v6[0] & 0xffc0) === 0xfe80) return true;
    // fc00::/7 — ULA (fc00:: and fd00::)
    if ((v6[0] & 0xfe00) === 0xfc00) return true;
    // 100::/64 — discard prefix
    if (v6[0] === 0x0100 && v6[1] === 0 && v6[2] === 0 && v6[3] === 0) return true;
    // 2001:db8::/32 — documentation
    if (v6[0] === 0x2001 && v6[1] === 0x0db8) return true;
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
