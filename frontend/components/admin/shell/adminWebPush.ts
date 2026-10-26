import { adminFetch } from "@/components/admin/api/adminFetch";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isWebPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg?.pushManager) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToWebPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isWebPushSupported()) {
    return { ok: false, error: "Trình duyệt hoặc thiết bị này không hỗ trợ Web Push." };
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return { ok: false, error: "Bạn chưa cấp quyền thông báo cho trình duyệt." };
    }

    const reg = await navigator.serviceWorker.ready;
    if (!reg?.pushManager) {
      return { ok: false, error: "Service Worker PushManager không sẵn sàng." };
    }

    // 1. Lấy VAPID public key từ máy chủ
    const vapidRes = await adminFetch<{ ok: boolean; publicKey?: string }>(
      "/api/shop/admin/push/vapid-public-key"
    );
    if (!vapidRes?.publicKey) {
      return { ok: false, error: "Không lấy được khoá VAPID từ máy chủ." };
    }

    // 2. Đăng ký nhận push với trình duyệt (Chrome / Apple Push Service)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidRes.publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    // 3. Gửi subscription lên máy chủ backend để lưu vào MongoDB
    const subJson = sub.toJSON();
    await adminFetch("/api/shop/admin/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        subscription: {
          endpoint: sub.endpoint,
          keys: subJson.keys,
        },
      }),
    });

    return { ok: true };
  } catch (err: any) {
    console.warn("[web-push] subscribe failed:", err);
    return { ok: false, error: err?.message || "Đăng ký Web Push thất bại." };
  }
}

export async function unsubscribeFromWebPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isWebPushSupported()) return { ok: true };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager?.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await adminFetch("/api/shop/admin/push/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint }),
      });
    }
    return { ok: true };
  } catch (err: any) {
    console.warn("[web-push] unsubscribe failed:", err);
    return { ok: false, error: err?.message || "Hủy đăng ký thất bại." };
  }
}

export async function sendTestWebPush(): Promise<{ ok: boolean; message?: string; sent?: number }> {
  try {
    return await adminFetch<{ ok: boolean; message?: string; sent?: number }>(
      "/api/shop/admin/push/test",
      { method: "POST" }
    );
  } catch (err: any) {
    return { ok: false, message: err?.message || "Không thể gửi thông báo test." };
  }
}
