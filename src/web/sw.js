// Stillwater service worker: network-first, so the running app always serves fresh code;
// the cached shell is only a fallback. Conversation requests (/api) are never cached.
const CACHE = 'stillwater-shell-v1';
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/web/styles.css', '/web/app.js', '/web/icon.svg']).catch(() => undefined))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); if (response.ok) caches.open(CACHE).then(c => c.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(hit => hit || Response.error())));
});
