/*
 * Sofra service worker — yalnızca web push bildirimleri.
 *
 * Sunucu (lib/push.ts) VAPID ile şifreli bildirim gönderir; burada
 * gösterilir. Bildirime tıklanınca ilgili sayfa (ör. sipariş takibi)
 * açık bir sekmedeyse ona geçilir, yoksa yeni sekme açılır.
 * Sayfa önbelleği yapılmaz; uygulama her zaman ağdan yüklenir.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Sofra", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Sofra", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      lang: "tr",
      data: { href: data.href || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = new URL(event.notification.data?.href || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.navigate(href).then((c) => (c ?? client).focus());
        }
      }
      return self.clients.openWindow(href);
    })
  );
});
