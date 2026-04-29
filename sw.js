// Core Breaker — Service Worker
// Caches the game shell so it works offline. Bump CACHE_VERSION to force users
// to fetch the new HTML/icons on their next online visit.

const CACHE_VERSION = 'core-breaker-v37';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-apple.png',
];

// Install: precache the shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clear any old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for game assets, network-first for everything else (e.g. Google Fonts)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isGameAsset = url.origin === self.location.origin;

  if (isGameAsset) {
    // Cache-first for our own files
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          // Cache successful responses for offline use
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
  } else {
    // Network-first for cross-origin (Google Fonts), with cache fallback
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  }
});

// Message handler — lets the page command the SW.
// Currently used by the in-app FORCE RELOAD button to wipe all caches.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});
