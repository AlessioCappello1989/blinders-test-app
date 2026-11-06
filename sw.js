/* IronBlind: service worker minimo, serve solo a mostrare le notifiche di sistema. */
const SHELL = 'ironblind-shell-1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then(c => c.add('./')).catch(() => {})); });
// Rete per prima (gli aggiornamenti arrivano subito); offline si mostra l'ultima pagina salvata.
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(SHELL).then(c => c.put('./', k)).catch(() => {}); return r; })
    .catch(() => caches.match('./').then(r => r || Response.error())));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const swap = e.notification.data && e.notification.data.swap;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.focus(); if (swap) c.postMessage({ swap }); return; }
    }
    return self.clients.openWindow(swap ? './?swap=' + encodeURIComponent(swap) : './');
  }));
});
