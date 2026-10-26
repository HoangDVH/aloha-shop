// ALOHA Shop PWA & Web Push Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Xử lý sự kiện Push Notification từ máy chủ (khi đóng trình duyệt / khóa màn hình)
self.addEventListener("push", (event) => {
  let payload = {
    title: "ALOHA Shop - Đơn hàng mới!",
    body: "Bạn vừa nhận được một đơn hàng mới từ website.",
    url: "/admin/don-hang",
  };

  try {
    if (event.data) {
      payload = Object.assign(payload, event.data.json());
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: "/brand/logo-icon.png",
    badge: "/brand/logo-icon.png",
    data: { url: payload.url || "/admin/don-hang" },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "ALOHA Shop", options)
  );
});

// Xử lý khi người dùng click vào thông báo
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin/don-hang";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/admin") && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
