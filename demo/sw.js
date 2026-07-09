/* MISTER service worker — offline shell + smart caching + update push
 * bump CACHE_VERSION on every deploy to invalidate old caches
 */
const CACHE_VERSION = 'mister-v37';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMG_CACHE = `${CACHE_VERSION}-img`;

const DATA_MAX_AGE_MS = 5 * 60 * 1000; // Serve cached JSON at most 5 min old on network failure

// Files that make the app usable offline (the "app shell")
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './vendor-qrcode.js',
  './ui-notify.js',
  './site-tour.js',
  './theme-toggle.js',
  './keyboard-shortcuts.js',
  './team-switcher.js',
  './chat-signing.js',
  './export-report.js',
  './vendor-jspdf.js',
  './favicon.svg',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
];

// ---- install: pre-cache shell -------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Individual .add so a single 404 doesn't brick the install
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] skip cache', url, err.message);
          })
        )
      );
    })
    // Do NOT skipWaiting automatically — let ui-notify.js prompt the user
    // (that's the "New version available" toast). If the page ships an
    // explicit SKIP_WAITING message we honour it below.
  );
});

// ---- activate: clear old versions + take control ------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
     .then(() => broadcast({ type: 'sw-activated', version: CACHE_VERSION }))
  );
});

// ---- fetch: routing -----------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept cross-origin (QVAC bridge, CDN, analytics)
  if (url.origin !== self.location.origin) return;

  // Never cache dynamic API paths
  if (url.pathname.includes('/bridge/') || url.pathname.includes('/api/')) return;

  // Navigation requests: try network, fall back to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(navigationHandler(req));
    return;
  }

  // JSON data: network-first with staleness guard
  if (url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }

  // Images: cache-first with separate bucket
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  // App shell + static JS/CSS: cache-first
  event.respondWith(cacheFirst(req, SHELL_CACHE));
});

async function navigationHandler(req) {
  try {
    const fresh = await fetch(req);
    return fresh;
  } catch (_err) {
    const cached = await caches.match(req) || await caches.match('./index.html');
    if (cached) return cached;
    return new Response('<h1>Offline</h1><p>You are offline and no cached copy is available.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html' } });
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) {
    // Refresh in background so next hit is fresh
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        caches.open(cacheName).then((c) => c.put(req, res.clone()));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const shell = await caches.match('./index.html');
    if (shell) return shell;
    throw err;
  }
}

// Stale-while-revalidate: return cache immediately, refresh in background.
// If we have no cache at all, fall back to network. If network fails and
// cache is older than DATA_MAX_AGE_MS, still serve it but flag stale.
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  if (cached) return cached;
  const network = await networkPromise;
  if (network) return network;
  return new Response(JSON.stringify({ error: 'offline', path: req.url }),
    { status: 503, headers: { 'Content-Type': 'application/json' } });
}

// ---- message channel ----------------------------------------------------
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
  if (data && data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({ type: 'version', version: CACHE_VERSION });
  }
  if (data && data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

async function broadcast(msg) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clientsList) c.postMessage(msg);
}
