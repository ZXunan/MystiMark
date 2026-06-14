// sw.js — Service Worker that caches the project's static assets so
// the *page* itself loads instantly on second visit. The Pyodide
// runtime and wheel downloads are deliberately NOT routed through
// the service worker — Pyodide uses its own dynamic-fetch machinery
// internally and intercepting those requests (even with cache-first)
// has been observed to break them, especially in cross-origin setups
// with subresource integrity / opaque responses.
//
// The benefit is still real: second visit = no re-download of
// index.html, styles.css, main.js, i18n.js, and bw_bundle.json.

const VERSION = 'mm-v1.0';
const STATIC_CACHE = `bw-static-${VERSION}`;

const PRECACHE_PATHS = [
  './',
  './index.html',
  './styles.css',
  './src/main.js',
  './src/i18n.js',
  './py_src/bw_bundle.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE_PATHS.map(async (p) => {
      try { await cache.add(new Request(p)); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n !== STATIC_CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only intercept same-origin (project assets). All cross-origin
  // requests — including Pyodide and its CDN — pass straight through
  // to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(staleWhileRevalidate(req));
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req).then((resp) => {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => hit);
  return hit || fetchPromise;
}
