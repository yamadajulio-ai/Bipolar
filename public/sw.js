// Suporte Bipolar — Service Worker v3
// Static: cache-first, API: network-first (PHI safety), offline: pre-cache

const CACHE_STATIC = "rb-static-v4";
const CACHE_OFFLINE = "rb-offline-v4";
const ALL_CACHES = [CACHE_STATIC, CACHE_OFFLINE];

const OFFLINE_URL = "/offline";


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

  // 2. API requests — NEVER cache (PHI safety: prevents cross-user data leaks
  // on shared devices; Cache API has no user/session partitioning)
  if (url.pathname.startsWith("/api/")) {
    return; // pass through to network, no SW interception
  }

  // 3. Admin pages — never cache, never serve offline (LGPD/PHI)
  if (url.pathname.startsWith("/admin")) {
    return; // pass through to network, no SW interception
  }

  // 4. Navigation — network-only with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // 5. Everything else — pass through (no caching)
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

// --- Cache purge (legacy cleanup — no API cache exists in v4) ---
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_AUTH_CACHES") {
    // Clean up any legacy API caches from previous SW versions
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("rb-api")).map((k) => caches.delete(k)))
      )
    );
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
