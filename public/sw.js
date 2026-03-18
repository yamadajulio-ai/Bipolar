// Suporte Bipolar — Service Worker v3
// Static: cache-first, API: network-first (PHI safety), offline: pre-cache

const CACHE_STATIC = "rb-static-v3";
const CACHE_API = "rb-api-v3";
const CACHE_OFFLINE = "rb-offline-v3";
const ALL_CACHES = [CACHE_STATIC, CACHE_API, CACHE_OFFLINE];

const OFFLINE_URL = "/offline";

// Authenticated API endpoints — network-first with offline fallback only
// These contain user-specific PHI and must never serve stale cross-user data
const NETWORK_FIRST_API_PATHS = [
  "/api/diario",
  "/api/sono",
  "/api/rotina",
  "/api/insights-summary",
  "/api/lembretes",
  "/api/avaliacao-semanal",
  "/api/planner/blocks",
  "/api/financeiro/historico",
];


// --- Install ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_OFFLINE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

// --- Activate ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch ---
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // 1. Static assets — cache-first (content-hashed by Next.js)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // 2. Authenticated API GETs — network-first (prevents cross-user data leaks)
  if (request.method === "GET" && isNetworkFirstApi(url)) {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  // 3. Navigation — network-only with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // 4. Everything else — pass through (no caching)
});

// --- Strategies ---

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

/**
 * Network-first strategy for authenticated API endpoints.
 * Always fetches fresh data from server; only falls back to cache when offline.
 * This prevents cross-user PHI leaks on shared devices.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    } else if (response.status === 401 || response.status === 403) {
      // Session expired — purge all cached PHI
      await purgeApiCache();
    }
    return response;
  } catch {
    // Offline — serve cached version if available
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// --- Cache purge (logout, session expiry, account deletion) ---
async function purgeApiCache() {
  await caches.delete(CACHE_API);
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_AUTH_CACHES") {
    event.waitUntil(caches.delete(CACHE_API));
  }
});

// --- Helpers ---

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.json"
  );
}

function isNetworkFirstApi(url) {
  return NETWORK_FIRST_API_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(path + "/")
  );
}

// --- Web Push ---

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Suporte Bipolar", body: event.data.text() };
  }

  const title = payload.title || "Suporte Bipolar";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/favicon.png",
    tag: payload.tag || "reminder",
    data: { url: payload.url || "/hoje" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/hoje";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if found
      for (const client of clients) {
        if (new URL(client.url).pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
