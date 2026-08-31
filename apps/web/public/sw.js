const CACHE_PREFIX = 'rekt-ink-shell';
const CACHE_VERSION = 'v1';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const SHELL_URL = '/';
const PRECACHE = [
  SHELL_URL,
  '/manifest.webmanifest',
  '/icons/rekt-192.svg',
  '/icons/rekt-512.svg',
  '/icons/rekt-maskable.svg',
];

function isNetworkOnlyPath(pathname) {
  return pathname === '/health' || pathname.startsWith('/v1/');
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|mjs|woff2?|svg|png|webp|ico|json|webmanifest)$/i.test(pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }

  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    const urls = [...new Set(event.data.urls)]
      .map((value) => {
        try {
          return new URL(value, self.location.origin);
        } catch {
          return null;
        }
      })
      .filter((url) => url && url.origin === self.location.origin && !isNetworkOnlyPath(url.pathname) && isStaticAsset(url.pathname));

    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.allSettled(
          urls.map(async (url) => {
            const response = await fetch(url.href, { cache: 'reload' });
            if (response.ok) await cache.put(url.href, response.clone());
          }),
        ),
      ),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Market/API truth is never cached. Offline mode must fail closed instead of
  // replaying stale provider responses under a LIVE label.
  if (isNetworkOnlyPath(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
  }
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const fallback = await cache.match(SHELL_URL);
    if (fallback) return fallback;
    return new Response('REKT//INK offline shell unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
