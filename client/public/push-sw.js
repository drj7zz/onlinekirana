self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('onlinekirana-shell-v1').then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/manifest.webmanifest',
      '/logo.png',
      '/icon/icon-192.png',
      '/icon/icon-512.png',
    ])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('onlinekirana-') && key !== 'onlinekirana-shell-v1')
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open('onlinekirana-shell-v1').then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open('onlinekirana-shell-v1').then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'OnlineKirana update', {
    body: payload.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
