/* MISTER service worker — offline shell + network-first data
 * bump CACHE_VERSION on every deploy to invalidate old caches
 */
const CACHE_VERSION = 'mister-v26';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Files that make the app usable offline (the "app shell")
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './vendor-qrcode.js',
  './ui-notify.js',
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
      // addAll fails atomically — use individual .add so a single 404 doesn't
      // brick the install (e.g. an icon that hasn't been generated yet).
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] skip cache', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ---- activate: clear old versions ---------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ---- fetch: routing -----------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept cross-origin (QVAC bridge, CDN vendor scripts, analytics)
  if (url.origin !== self.location.origin) return;

  // Never cache the QVAC bridge or any dynamic API
  if (url.pathname.includes('/bridge/') || url.pathname.includes('/api/')) return;

  // JSON data files: network-first (so a fresh deploy shows up immediately),
  // fall back to cache when offline.
  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // App shell + static assets: cache-first
  event.respondWith(cacheFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    // Offline & not in cache → fall back to the app shell
    const shell = await caches.match('./index.html');
    if (shell) return shell;
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw err;
  }
}

// ---- allow the page to trigger an immediate update ----------------------
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) self.skipWaiting();
});
