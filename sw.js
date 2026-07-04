/* RoboRider service worker — bump CACHE version on every deploy to push updates */
const CACHE = 'roborider-v25';

/* App shell precached so the tool opens instantly and works offline */
const SHELL = [
  'rider-builder.html',
  'index.html',
  'rider-maken.html',
  'rider-maken-en.html',
  'stage-plot-maken.html',
  'stage-plot-maken-en.html',
  'inputlijst-maken.html',
  'inputlijst-maken-en.html',
  'hospitality-rider.html',
  'hospitality-rider-en.html',
  'rider-sturen.html',
  'rider-sturen-en.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'roborider-favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  /* Only handle our own same-origin GETs. Leave Supabase, Lemon Squeezy,
     Google Fonts, the CDN scripts and GoatCounter completely untouched. */
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Page navigations: network-first so a fresh deploy is picked up online,
     with the cached copy as an offline fallback. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('rider-builder.html')))
    );
    return;
  }

  /* Static same-origin assets: cache-first, refresh in the background. */
  e.respondWith(
    caches.match(req).then((cached) => {
      const live = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || live;
    })
  );
});
