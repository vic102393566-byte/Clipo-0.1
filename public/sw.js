// Clipo Service Worker - Web Push Notifications for Scheduled Publications

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Clipo — Publicação concluída',
    body: 'Seu vídeo agendado foi publicado com sucesso.',
    url: '/?tab=agendamentos',
    tag: 'clipo-publish-notification',
    publicationId: undefined,
    platforms: [],
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      try {
        payload.body = event.data.text() || payload.body;
      } catch {
        // ignore parse failure
      }
    }
  }

  const options = {
    body: payload.body,
    tag: payload.tag || `clipo-pub-${payload.publicationId || Date.now()}`,
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || '/?tab=agendamentos',
      publicationId: payload.publicationId,
      platforms: payload.platforms || [],
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?tab=agendamentos';
  const publicationId = event.notification.data?.publicationId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_PUBLICATION',
            tab: 'agendamentos',
            publicationId,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
