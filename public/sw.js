/* ZERO TO HERO — service worker: Web Push + PWA.
 * Đặt ở /sw.js để scope là toàn app. Chrome yêu cầu có fetch handler thì
 * mới cho cài PWA; handler này không chặn request (để trình duyệt tự tải).
 */

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "ZERO TO HERO";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "zth",
    renotify: true,
    data: { url: data.url || "/tham-khao" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl =
    (event.notification.data && event.notification.data.url) || "/tham-khao";
  const url = new URL(rawUrl, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});

// Fetch handler tối thiểu để đủ điều kiện cài PWA (không can thiệp request).
self.addEventListener("fetch", () => {});
