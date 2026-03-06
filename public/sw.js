// Rede Bipolar — Service Worker v2
// Three-cache strategy: static (cache-first), API (stale-while-revalidate), offline (pre-cache)

const CACHE_STATIC = "rb-static-v2";
const CACHE_API = "rb-api-v2";
const CACHE_OFFLINE = "rb-offline-v2";
const ALL_CACHES = [CACHE_STATIC, CACHE_API, CACHE_OFFLINE];

const OFFLINE_URL = "/offline";

// Read-only API endpoints safe to cache (stale-while-revalidate)
const CACHEABLE_API_PATHS = [
  "/api/diario",
  "/api/sono",
  "/api/rotina",
  "/api/insights-summary",
  "/api/lembretes",
];

// TTL for API cache (5 minutes)
const API_TTL_MS = 5 * 60 * 1000;

// In-memory TTL tracker (resets when SW restarts — acceptable)
const apiTimestamps = new Map();

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

  // 2. Cacheable API GETs — stale-while-revalidate
  if (request.method === "GET" && isCacheableApi(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_API, url.pathname));
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
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName, cacheKey) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const lastFetch = apiTimestamps.get(cacheKey) || 0;
  const isStale = Date.now() - lastFetch > API_TTL_MS;

  // If cache is fresh enough, return it without re-fetching
  if (cached && !isStale) {
    return cached;
  }

  // If we have a stale cache, return it AND refresh in background
  if (cached && isStale) {
    refreshInBackground(request, cache, cacheKey);
    return cached;
  }

  // No cache — must fetch
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      apiTimestamps.set(cacheKey, Date.now());
    }
    return response;
  } catch {
    // No cache and no network
    return cached || new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function refreshInBackground(request, cache, cacheKey) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      apiTimestamps.set(cacheKey, Date.now());
    }
  } catch {
    // Network failed — stale cache continues serving
  }
}

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

function isCacheableApi(url) {
  return CACHEABLE_API_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(path + "?") || url.pathname.startsWith(path + "/")
  );
}
