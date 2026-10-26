// ALOHA Shop PWA & Web Push Service Worker (RFC 8292 / VAPID)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Xử lý sự kiện Push Notification từ máy chủ (khi đóng trình duyệt / khóa màn hình)
self.addEventListener("push", (event) => {
  let payload = {
    title: "🔔 ALOHA Shop - Đơn hàng mới!",
    body: "Bạn vừa nhận được một đơn hàng mới từ website.",
    url: "/admin/don-hang-web",
    tag: "aloha-push-alert",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = Object.assign(payload, parsed);
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const targetUrl = payload.url || "/admin/don-hang-web";
  const options = {
    body: payload.body,
    icon: payload.icon || "/brand/logo-icon.png",
    badge: payload.badge || "/brand/logo-icon.png",
    data: { url: targetUrl, timestamp: Date.now() },
    tag: payload.tag || `aloha-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 450],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "ALOHA Shop", options)
  );
});

// Xử lý khi người dùng click vào thông báo trên màn hình khóa hoặc góc Windows
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin/don-hang-web";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Nếu có tab admin đang mở, focus vào tab đó và điều hướng
      for (const client of windowClients) {
        if (client.url && client.url.includes("/admin") && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Nếu chưa có tab nào mở, mở cửa sổ mới
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
