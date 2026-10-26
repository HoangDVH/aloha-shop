/**
 * ALOHA Shop — Dịch vụ Web Push (RFC 8292 / VAPID).
 * Hỗ trợ gửi thông báo đẩy tới Chrome, Edge, Safari (macOS & iOS PWA 16.4+)
 * ngay cả khi đóng trình duyệt hoặc khoá màn hình điện thoại.
 */
import webpush from "web-push";
import type { Db } from "mongodb";

export const SHOP_PUSH_COL = "aloha_shop_push_subscriptions";
export const SHOP_SETTINGS_COL = "aloha_shop_settings";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: PushSubscriptionKeys;
  expirationTime?: number | null;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userId?: string;
  username?: string;
  role?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushNotificationMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

let vapidInitialized = false;
let cachedPublicKey = "";

export interface VapidKeysDoc {
  _id: string;
  publicKey: string;
  privateKey: string;
  subject?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Đảm bảo VAPID keys đã được nạp và khởi tạo cho webpush.
 * Nếu chưa có VAPID keys trong env hoặc DB, tự động sinh và lưu vĩnh viễn vào DB.
 */
export async function ensureVapidConfig(db: Db): Promise<{ publicKey: string; privateKey: string }> {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const envSubject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@alohathegioichaucay.com";

  if (envPublic && envPrivate) {
    if (!vapidInitialized || cachedPublicKey !== envPublic) {
      webpush.setVapidDetails(envSubject, envPublic, envPrivate);
      vapidInitialized = true;
      cachedPublicKey = envPublic;
    }
    return { publicKey: envPublic, privateKey: envPrivate };
  }

  // Tìm trong DB
  const settingsCol = db.collection<VapidKeysDoc>(SHOP_SETTINGS_COL);
  const found = await settingsCol.findOne({ _id: "vapid_keys" });

  if (found?.publicKey && found?.privateKey) {
    const subject = found.subject || envSubject;
    if (!vapidInitialized || cachedPublicKey !== found.publicKey) {
      webpush.setVapidDetails(subject, found.publicKey, found.privateKey);
      vapidInitialized = true;
      cachedPublicKey = found.publicKey;
    }
    return { publicKey: found.publicKey, privateKey: found.privateKey };
  }

  // Tự động sinh cặp key mới và lưu vĩnh viễn vào DB
  const generated = webpush.generateVAPIDKeys();
  await settingsCol.updateOne(
    { _id: "vapid_keys" },
    {
      $set: {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject: envSubject,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  webpush.setVapidDetails(envSubject, generated.publicKey, generated.privateKey);
  vapidInitialized = true;
  cachedPublicKey = generated.publicKey;

  return generated;
}

/**
 * Lấy VAPID public key cho client đăng ký Service Worker PushManager
 */
export async function getVapidPublicKey(db: Db): Promise<string> {
  const { publicKey } = await ensureVapidConfig(db);
  return publicKey;
}

/**
 * Lưu hoặc cập nhật thiết bị đăng ký nhận Web Push
 */
export async function savePushSubscription(
  db: Db,
  sub: PushSubscriptionPayload,
  userMetadata?: { userId?: string; username?: string; role?: string; userAgent?: string }
): Promise<void> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw new Error("invalid_push_subscription");
  }

  const col = db.collection<StoredPushSubscription>(SHOP_PUSH_COL);
  const now = new Date();

  await col.updateOne(
    { endpoint: sub.endpoint },
    {
      $set: {
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        userId: userMetadata?.userId,
        username: userMetadata?.username,
        role: userMetadata?.role,
        userAgent: userMetadata?.userAgent,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

/**
 * Hủy đăng ký thiết bị nhận Web Push
 */
export async function removePushSubscription(db: Db, endpoint: string): Promise<boolean> {
  if (!endpoint) return false;
  const col = db.collection<StoredPushSubscription>(SHOP_PUSH_COL);
  const res = await col.deleteOne({ endpoint });
  return (res.deletedCount || 0) > 0;
}

/**
 * Lấy số lượng thiết bị đang đăng ký nhận thông báo đẩy
 */
export async function getPushSubscriptionCount(db: Db): Promise<number> {
  const col = db.collection(SHOP_PUSH_COL);
  return await col.countDocuments();
}

/**
 * Phát thông báo đẩy tới toàn bộ thiết bị admin đã đăng ký.
 * Tự động dọn dẹp các token đã hết hạn hoặc bị hủy (status 404 hoặc 410).
 */
export async function broadcastAdminWebPush(
  db: Db,
  message: PushNotificationMessage
): Promise<{ sent: number; failed: number; pruned: number }> {
  await ensureVapidConfig(db);

  const col = db.collection<StoredPushSubscription>(SHOP_PUSH_COL);
  const subs = await col.find({}).toArray();

  if (!subs.length) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  const payloadString = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url || "/admin/don-hang-web",
    tag: message.tag || "aloha-admin-push",
    icon: message.icon || "/brand/logo-icon.png",
    badge: message.badge || "/brand/logo-icon.png",
    data: message.data || {},
    timestamp: Date.now(),
  });

  let sent = 0;
  let failed = 0;
  const deadEndpoints: string[] = [];

  const promises = subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        payloadString,
        {
          TTL: 86400, // Giữ trên hàng đợi push trong 24 giờ nếu máy đang tắt
          urgency: "high",
        }
      );
      sent++;
    } catch (err: any) {
      failed++;
      // Mã 404 (Not Found) hoặc 410 (Gone) nghĩa là người dùng đã gỡ App hoặc thu hồi quyền
      if (err?.statusCode === 404 || err?.statusCode === 410 || err?.statusCode === 400) {
        deadEndpoints.push(sub.endpoint);
      } else {
        console.warn(`[web-push] send failed to ${sub.endpoint.slice(0, 30)}...:`, err?.message || err);
      }
    }
  });

  await Promise.allSettled(promises);

  let pruned = 0;
  if (deadEndpoints.length > 0) {
    const delRes = await col.deleteMany({ endpoint: { $in: deadEndpoints } });
    pruned = delRes.deletedCount || 0;
  }

  return { sent, failed, pruned };
}
