/* Meu Lembrete — service worker (PWA + Web Push) */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Mantém o app instalável nos navegadores que exigem um handler de fetch.
// Não intercepta nada: deixa o navegador buscar normalmente.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "⏰ Lembrete";
  const options = {
    body: payload.body || "Você tem um lembrete.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "lembrete",
    renotify: true,
    data: { url: payload.url || "/lembretes" },
    vibrate: [180, 80, 180],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/lembretes";

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* ignore */
            }
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })()
  );
});
