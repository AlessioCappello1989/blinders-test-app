/* IronBlind: service worker minimo, serve solo a mostrare le notifiche di sistema. */
self.addEventListener('install', () => self.skipWaiting());
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
