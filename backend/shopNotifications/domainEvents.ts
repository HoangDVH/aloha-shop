/**
 * Unified domain event dispatcher for admin notifications (bell feed, SSE, Web Push, Zalo).
 */
import type { Db } from "mongodb";
import { ADMIN_NOTIFICATION_TYPES } from "../../shared/opsContracts.js";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { broadcastAdminWebPush } from "../shopPush/webPushService.js";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { APPLICATIONS_COL } from "../shopRecruitment/types.js";
import { zaloNotifyService } from "../shopWholesale/zaloNotifyService.js";
import { syncBus } from "../syncBus.js";
import { toMongoDate } from "../utils/mongoDate.js";
import {
  ADMIN_NOTIFICATIONS,
  buildCtvNotificationFields,
  buildOrderNotificationFields,
  buildRecruitmentNotificationFields,
  buildWholesaleNotificationFields,
  recordAdminNotification,
} from "./adminNotificationStore.js";

export type OrderCreatedEventContext = {
  shopDb: Db;
  order: Record<string, any>;
  syncSource?: string;
  zaloPayload?: Parameters<typeof zaloNotifyService.sendNewOrderNotice>[0] | null;
  pushPayload?: {
    title: string;
    body: string;
    url: string;
    tag: string;
  } | null;
  notifyBell?: boolean;
  notifyPush?: boolean;
  notifyZalo?: boolean;
};

export async function emitOrderCreated(ctx: OrderCreatedEventContext): Promise<void> {
  const code = String(ctx.order.code || ctx.order.kvOrderCode || ctx.order._id || "");
  const fields = buildOrderNotificationFields(ctx.order);

  if (ctx.notifyBell !== false && code) {
    await recordAdminNotification(ctx.shopDb, {
      dedupeKey: `order:${code}`,
      entityType: ADMIN_NOTIFICATION_TYPES.ORDER,
      entityId: code,
      eventAt: toMongoDate(ctx.order.createdAt),
      ...fields,
    });
  }

  try {
    syncBus.publish([SHOP_ORDERS, "shop_orders", ADMIN_NOTIFICATIONS], ctx.syncSource || "shop-order-create", {
      ids: code ? [code] : [],
    });
  } catch {
    /* ignore */
  }

  if (ctx.notifyPush !== false && ctx.pushPayload) {
    try {
      void broadcastAdminWebPush(ctx.shopDb, ctx.pushPayload).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  if (ctx.notifyZalo !== false && ctx.zaloPayload) {
    try {
      void zaloNotifyService.sendNewOrderNotice(ctx.zaloPayload).catch((err) => {
        console.error("[zalo-notify] Lỗi gửi thông báo đơn mới:", err?.message || err);
      });
    } catch {
      /* ignore */
    }
  }
}

export async function emitWholesaleRegistered(ctx: {
  shopDb: Db;
  account: Record<string, any>;
  eventAt?: Date;
  shopName?: string;
  businessType?: string;
  address?: string;
  note?: string;
  notifyZalo?: boolean;
}): Promise<void> {
  const id = String(ctx.account._id || "");
  const rev = Number(ctx.account.applicationRevision || 1) || 1;
  const eventAt = toMongoDate(
    ctx.eventAt ?? ctx.account.siAppliedAt ?? ctx.account.siProfile?.acceptedTermsAt ?? ctx.account.updatedAt
  );
  const fields = buildWholesaleNotificationFields(ctx.account);

  if (id) {
    await recordAdminNotification(ctx.shopDb, {
      dedupeKey: `wholesale:${id}:rev${rev}`,
      entityType: ADMIN_NOTIFICATION_TYPES.WHOLESALE,
      entityId: id,
      eventAt,
      ...fields,
    });
  }

  try {
    syncBus.publish([SHOP_ACCOUNTS, ADMIN_NOTIFICATIONS], "si_registered_pending_verification", {
      ids: id ? [id] : [],
    });
  } catch {
    /* ignore */
  }

  try {
    void broadcastAdminWebPush(ctx.shopDb, {
      title: "🌾 Khách sỉ mới đăng ký",
      body: `${ctx.account.fullName || ctx.account.phone || "Khách sỉ"} - ${ctx.account.phone || ""} (${ctx.account.siRegion || ""})`,
      url: fields.link,
      tag: `si_${id}`,
    }).catch(() => {});
  } catch {
    /* ignore */
  }

  if (ctx.notifyZalo !== false) {
    try {
      void zaloNotifyService
        .sendWholesaleRegistrationNotice({
          fullName: String(ctx.account.fullName || ""),
          phone: String(ctx.account.phone || ""),
          region: ctx.account.siRegion || undefined,
          shopName: ctx.shopName,
          businessType: ctx.businessType,
          address: ctx.address,
          note: ctx.note,
          registeredAt: eventAt,
        })
        .catch((err) => {
          console.error("[zalo-notify] Lỗi gửi thông báo sỉ:", err?.message || err);
        });
    } catch {
      /* ignore */
    }
  }
}

export async function emitCtvRegistered(ctx: {
  shopDb: Db;
  account: Record<string, any>;
  noticeType: "new_account" | "upgrade";
  eventAt?: Date;
  referralChannel?: string;
  channelUrl?: string;
  businessExperience?: string;
  address?: string;
  note?: string;
}): Promise<void> {
  const id = String(ctx.account._id || "");
  const eventAt = toMongoDate(
    ctx.eventAt ?? ctx.account.ctvAppliedAt ?? (ctx.noticeType === "upgrade" ? ctx.account.updatedAt : ctx.account.createdAt)
  );
  const fields = buildCtvNotificationFields(ctx.account);

  if (id) {
    await recordAdminNotification(ctx.shopDb, {
      dedupeKey: `ctv:${id}:${ctx.noticeType}`,
      entityType: ADMIN_NOTIFICATION_TYPES.CTV,
      entityId: id,
      eventAt,
      ...fields,
    });
  }

  try {
    syncBus.publish(
      [SHOP_ACCOUNTS, ADMIN_NOTIFICATIONS],
      ctx.noticeType === "upgrade" ? "ctv_apply" : "ctv_register",
      { ids: id ? [id] : [] }
    );
  } catch {
    /* ignore */
  }

  try {
    void broadcastAdminWebPush(ctx.shopDb, {
      title: "🤝 CTV mới đăng ký",
      body: `${ctx.account.fullName || ctx.account.phone || "Cộng tác viên"} - ${ctx.account.phone || ""}`,
      url: fields.link,
      tag: `ctv_${id}`,
    }).catch(() => {});
  } catch {
    /* ignore */
  }

  try {
    void zaloNotifyService
      .sendCollaboratorNotice({
        fullName: String(ctx.account.fullName || ctx.account.phone || ""),
        phone: String(ctx.account.phone || ""),
        email: ctx.account.email ? String(ctx.account.email) : undefined,
        ctvCode: ctx.account.ctvCode ? String(ctx.account.ctvCode) : undefined,
        referralChannel: ctx.referralChannel,
        channelUrl: ctx.channelUrl,
        businessExperience: ctx.businessExperience,
        address: ctx.address,
        note: ctx.note,
        registeredAt: eventAt,
        type: ctx.noticeType === "upgrade" ? "upgrade_account" : "new_account",
      })
      .catch((err) => {
        console.error("[zalo-notify] Lỗi gửi thông báo CTV:", err?.message || err);
      });
  } catch {
    /* ignore */
  }
}

export async function emitRecruitmentApplied(ctx: {
  shopDb: Db;
  application: Record<string, any>;
  zaloPayload: Parameters<typeof zaloNotifyService.sendRecruitmentNotice>[0];
}): Promise<void> {
  const id = String(ctx.application._id || "");
  const eventAt = toMongoDate(ctx.application.createdAt);
  const fields = buildRecruitmentNotificationFields(ctx.application);

  if (id) {
    await recordAdminNotification(ctx.shopDb, {
      dedupeKey: `recruitment:${id}`,
      entityType: ADMIN_NOTIFICATION_TYPES.RECRUITMENT,
      entityId: id,
      eventAt,
      ...fields,
    });
  }

  try {
    syncBus.publish([APPLICATIONS_COL, ADMIN_NOTIFICATIONS], "recruitment_apply", {
      ids: id ? [id] : [],
    });
  } catch {
    /* ignore */
  }

  try {
    void broadcastAdminWebPush(ctx.shopDb, {
      title: "📄 Hồ sơ tuyển dụng mới",
      body: `${ctx.zaloPayload.fullName} ứng tuyển ${ctx.zaloPayload.position} (${ctx.zaloPayload.phone})`,
      url: fields.link,
      tag: `recruit_${id}`,
    }).catch(() => {});
  } catch {
    /* ignore */
  }

  try {
    void zaloNotifyService.sendRecruitmentNotice(ctx.zaloPayload).catch((err) => {
      console.error("[zalo-notify] Lỗi gửi thông báo tuyển dụng:", err?.message || err);
    });
  } catch {
    /* ignore */
  }
}
