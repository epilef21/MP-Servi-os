// Service Worker para Web Push (padrão W3C, sem Firebase FCM)

// Força ativação imediata sem esperar outras abas fecharem
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AssistHub';
  const options = {
    body:  data.body  || 'Nova atualização',
    icon:  '/logo.png',
    badge: '/logo.png',
    tag:   'assisthub-checklist',
    requireInteraction: false,
    data:  data,
  };

  // Notifica clientes abertos para tocarem o som e exibirem toast
  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'PUSH_RECEIVED', data });
      });
    });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      notifyClients,
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
