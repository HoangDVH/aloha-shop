/**
 * Persistent store for admin bell notifications (aloha_admin_notifications)
 * and per-admin server-side read state (aloha_admin_notification_reads).
 */
import type { Db } from "mongodb";
import {
  ACCOUNT_STATUS,
  ADMIN_NOTIFICATION_TYPES,
  ORDER_NEED_ACTION_STATUSES,
  ORDER_STATUS,
  PAYMENT_NEED_ACTION_STATUSES,
  SI_KV_SYNC_STATUS,
  SI_VERIFICATION_STATUS,
  isWholesalePendingReview,
  type AdminNotificationItem,
  type AdminNotificationType,
  type AdminNotificationsResponse,
} from "../../shared/opsContracts.js";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { SHOP_CTV_FRAUD_EVENTS } from "../shopOrders/commissionModels.js";
import { APPLICATIONS_COL } from "../shopRecruitment/types.js";
import { toEpochMs, toMongoDate } from "../utils/mongoDate.js";

export const ADMIN_NOTIFICATIONS = "aloha_admin_notifications";
export const ADMIN_NOTIFICATION_READS = "aloha_admin_notification_reads";

export type NotificationDisplayFields = {
  title: string;
  subtitle: string;
  detail?: string;
  link: string;
  tag?: string;
  tagColor?: string;
  needsAction: boolean;
};

export type RecordAdminNotificationInput = NotificationDisplayFields & {
  dedupeKey: string;
  entityType: AdminNotificationType;
  entityId: string;
  eventAt?: Date | string | number;
};

export type AdminReadState = {
  adminKey: string;
  readAllAt: Date | null;
  readIds: string[];
};

const MAX_STORED_READ_IDS = 500;
const FEED_LIMIT = 40;

let indexesReady = false;

export async function ensureAdminNotificationIndexes(shopDb: Db): Promise<void> {
  if (indexesReady) return;
  try {
    const notifCol = shopDb.collection(ADMIN_NOTIFICATIONS);
    const readsCol = shopDb.collection(ADMIN_NOTIFICATION_READS);
    if (typeof notifCol.createIndex === "function") {
      await Promise.all([
        notifCol.createIndex({ dedupeKey: 1 }, { unique: true }),
        notifCol.createIndex({ eventAt: -1, _id: -1 }),
        notifCol.createIndex({ entityType: 1, entityId: 1 }),
      ]);
    }
    if (typeof readsCol.createIndex === "function") {
      await readsCol.createIndex({ adminKey: 1 }, { unique: true });
    }
    indexesReady = true;
  } catch {
    // Non-fatal in lightweight test mocks or read-only replicas
  }
}

export function buildOrderNotificationFields(o: Record<string, any>): NotificationDisplayFields {
  const isSi = o.priceMode === "si";
  const isQuick = o.source === "admin_quick" || o.source === "quick_order";
  const totalVal =
    typeof o.grandTotal === "number"
      ? o.grandTotal
      : typeof o.total === "number"
      ? o.total
      : 0;
  const totalStr = totalVal > 0 ? totalVal.toLocaleString("vi-VN") + "đ" : "";
  const name = o.shippingAddress?.fullName || o.customerName || "Khách mua lẻ";
  const phone = o.shippingAddress?.phone || o.customerPhone || "";

  let stt = "Đơn mới";
  if (o.customerReportedPaidAt && o.paymentStatus === "unpaid") {
    stt = "Khách báo đã CK";
  } else if (o.backorderStatus === "pending_confirmation") {
    stt = "Đặt trước chờ xác nhận";
  } else if (o.orderStatus === "cho_xu_ly") {
    stt = "Chờ xử lý";
  } else if (o.orderStatus === "cho_thanh_toan") {
    stt = "Chờ thanh toán";
  } else if (o.orderStatus === "cho_xac_nhan") {
    stt = "Chờ xác nhận";
  } else if (o.orderStatus === "dang_giao") {
    stt = "Đang giao";
  } else if (o.orderStatus === "thieu_hang") {
    stt = "Thiếu hàng";
  } else if (o.orderStatus === "hoan_thanh") {
    stt = "Hoàn thành";
  } else if (o.orderStatus === "huy") {
    stt = "Đã hủy";
  }

  const targetCode = o.code || o.kvOrderCode || o._id;
  const displayCode = o.kvOrderCode || o.code || o._id;
  const needsAction =
    o.orderStatus !== ORDER_STATUS.HUY &&
    o.orderStatus !== ORDER_STATUS.HOAN_THANH &&
    (ORDER_NEED_ACTION_STATUSES.includes(String(o.orderStatus || "")) ||
      PAYMENT_NEED_ACTION_STATUSES.includes(String(o.paymentStatus || "")));

  const tag = isSi ? "Đơn sỉ" : isQuick ? "Đơn tạo nhanh" : "Đơn web";
  const tagColor = isSi ? "purple" : isQuick ? "blue" : "emerald";

  return {
    title: `Đơn hàng mới #${displayCode}`,
    subtitle: [name, phone, totalStr].filter(Boolean).join(" • "),
    detail: stt,
    link: `/admin/don-hang-web?code=${encodeURIComponent(String(targetCode))}`,
    tag,
    tagColor,
    needsAction,
  };
}

export function buildWholesaleNotificationFields(a: Record<string, any>): NotificationDisplayFields {
  const isPending = isWholesalePendingReview(a);
  const isRejectedOrSuspended =
    a.siStatus === ACCOUNT_STATUS.TU_CHOI ||
    a.siStatus === ACCOUNT_STATUS.KHOA ||
    a.siStatus === ACCOUNT_STATUS.REJECTED ||
    a.siStatus === ACCOUNT_STATUS.SUSPENDED;
  const name = a.fullName || a.phone || "Khách sỉ";
  const region =
    a.siRegion === "HCM" ? "TP.HCM" : a.siRegion === "TINH" ? "Tỉnh" : "Chưa chọn vùng";
  const statusLabel = isRejectedOrSuspended
    ? a.siStatus === ACCOUNT_STATUS.TU_CHOI || a.siStatus === ACCOUNT_STATUS.REJECTED
      ? "Đã từ chối"
      : "Tạm ngưng sỉ"
    : isPending
    ? "Chờ duyệt sỉ"
    : "Đã kích hoạt";

  return {
    title: `Đăng ký Khách sỉ: ${name}`,
    subtitle: `SĐT: ${a.phone || "Chưa có"} • Email: ${a.email || "Chưa có"}`,
    detail: `Khu vực: ${region} • ${statusLabel}`,
    link: `/admin/ctv/khach-hang?id=${encodeURIComponent(String(a._id || ""))}&q=${encodeURIComponent(
      String(a.phone || a.fullName || "")
    )}&review=si`,
    tag: isRejectedOrSuspended ? "Ngưng sỉ" : isPending ? "Chờ duyệt" : "Khách sỉ",
    tagColor: isRejectedOrSuspended ? "slate" : isPending ? "amber" : "purple",
    needsAction: isPending,
  };
}

export function buildCtvNotificationFields(a: Record<string, any>): NotificationDisplayFields {
  const isPending = a.ctvStatus === ACCOUNT_STATUS.CHO_DUYET;
  const isRejectedOrSuspended =
    a.ctvStatus === ACCOUNT_STATUS.TU_CHOI ||
    a.ctvStatus === ACCOUNT_STATUS.KHOA ||
    a.ctvStatus === ACCOUNT_STATUS.REJECTED ||
    a.ctvStatus === ACCOUNT_STATUS.SUSPENDED;
  const name = a.fullName || a.phone || "Cộng tác viên";
  const idStr = String(a._id || "");
  const link = isPending
    ? `/admin/ctv/khach-hang?id=${encodeURIComponent(idStr)}&q=${encodeURIComponent(
        String(a.phone || "")
      )}&review=ctv`
    : a.ctvCode
    ? `/admin/ctv/danh-sach/${encodeURIComponent(String(a.ctvCode))}`
    : `/admin/ctv/khach-hang?id=${encodeURIComponent(idStr)}&q=${encodeURIComponent(
        String(a.phone || "")
      )}&review=ctv`;

  const detail = isRejectedOrSuspended
    ? a.ctvStatus === ACCOUNT_STATUS.TU_CHOI || a.ctvStatus === ACCOUNT_STATUS.REJECTED
      ? "Hồ sơ CTV đã bị từ chối"
      : "CTV đang tạm ngưng"
    : isPending
    ? "Hồ sơ CTV đang chờ duyệt"
    : "CTV đang hoạt động";

  return {
    title: `Đăng ký CTV: ${name}`,
    subtitle: `SĐT: ${a.phone || "Chưa có"} • Mã: ${a.ctvCode || "Mới"}`,
    detail,
    link,
    tag: isRejectedOrSuspended ? "Đã đóng" : isPending ? "Chờ duyệt" : "CTV",
    tagColor: isRejectedOrSuspended ? "slate" : isPending ? "amber" : "blue",
    needsAction: isPending,
  };
}

export function buildRecruitmentNotificationFields(app: Record<string, any>): NotificationDisplayFields {
  const isNew = app.status === "new" || app.status === "reviewing";
  const name = app.contact?.fullName || app.fullName || "Ứng viên";
  const phone = app.contact?.phone || app.phone || "";
  const job = app.jobSummary?.title || app.interestedPosition || "Ứng tuyển vị trí";
  const statusMap: Record<string, string> = {
    new: "Hồ sơ mới",
    reviewing: "Đang xem xét",
    interviewed: "Đã phỏng vấn",
    hired: "Đã tuyển",
    rejected: "Từ chối",
  };
  const detailStatus = statusMap[String(app.status || "")] || String(app.status || "Chờ xử lý");

  return {
    title: `Người nộp đơn tuyển dụng: ${name}`,
    subtitle: `Vị trí: ${job} • SĐT: ${phone}`,
    detail: `Trạng thái: ${detailStatus}`,
    link: `/admin/tuyen-dung/ho-so?id=${encodeURIComponent(String(app._id || ""))}&code=${encodeURIComponent(
      String(app.publicCode || "")
    )}`,
    tag: isNew ? "Ứng viên mới" : "Tuyển dụng",
    tagColor: isNew ? "cyan" : "slate",
    needsAction: isNew,
  };
}

/**
 * Inserts a new feed entry without resetting `eventAt` if the dedupeKey already exists.
 * Insert-first pattern prevents unintended updateOne side-effects on simple test mocks.
 */
export async function recordAdminNotification(
  shopDb: Db,
  input: RecordAdminNotificationInput
): Promise<void> {
  const col = shopDb.collection(ADMIN_NOTIFICATIONS);
  if (typeof col.insertOne !== "function") return;

  const now = new Date();
  const eventAt = toMongoDate(input.eventAt, now);
  const doc = {
    dedupeKey: input.dedupeKey,
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.entityType,
    title: input.title,
    subtitle: input.subtitle,
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
    link: input.link,
    ...(input.tag !== undefined ? { tag: input.tag } : {}),
    ...(input.tagColor !== undefined ? { tagColor: input.tagColor } : {}),
    needsAction: Boolean(input.needsAction),
    eventAt,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await col.insertOne(doc);
  } catch (err: any) {
    if (err?.code === 11000 && typeof col.updateOne === "function") {
      await col.updateOne(
        { dedupeKey: input.dedupeKey },
        {
          $set: {
            title: input.title,
            subtitle: input.subtitle,
            detail: input.detail,
            link: input.link,
            tag: input.tag,
            tagColor: input.tagColor,
            needsAction: Boolean(input.needsAction),
            updatedAt: now,
          },
        }
      );
    }
  }
}

/** Updates status/tag/detail on existing notification rows without changing historical `eventAt`. */
export async function syncAdminNotificationEntity(
  shopDb: Db,
  params: {
    entityType: AdminNotificationType;
    entityId: string;
    fields: NotificationDisplayFields;
  }
): Promise<void> {
  try {
    const col = shopDb.collection(ADMIN_NOTIFICATIONS);
    const filter = {
      entityType: params.entityType,
      entityId: params.entityId,
    };
    const update = {
      $set: {
        title: params.fields.title,
        subtitle: params.fields.subtitle,
        detail: params.fields.detail,
        link: params.fields.link,
        tag: params.fields.tag,
        tagColor: params.fields.tagColor,
        needsAction: Boolean(params.fields.needsAction),
        updatedAt: new Date(),
      },
    };
    if (typeof col.updateMany === "function") {
      await col.updateMany(filter, update);
    } else if (typeof col.updateOne === "function") {
      await col.updateOne(filter, update);
    }
  } catch {
    // Non-blocking sync
  }
}

export async function getAdminReadState(
  shopDb: Db,
  adminKey: string
): Promise<AdminReadState> {
  const readsCol = shopDb.collection(ADMIN_NOTIFICATION_READS);
  if (typeof readsCol.findOne !== "function") {
    return { adminKey, readAllAt: null, readIds: [] };
  }
  const doc: any = await readsCol.findOne({ adminKey });
  if (!doc) return { adminKey, readAllAt: null, readIds: [] };
  return {
    adminKey,
    readAllAt: doc.readAllAt ? toMongoDate(doc.readAllAt) : null,
    readIds: Array.isArray(doc.readIds) ? doc.readIds.map(String) : [],
  };
}

export async function markNotificationRead(
  shopDb: Db,
  adminKey: string,
  notificationId: string
): Promise<AdminReadState> {
  const id = String(notificationId || "").trim();
  const readsCol = shopDb.collection(ADMIN_NOTIFICATION_READS);
  if (!id || typeof readsCol.updateOne !== "function") {
    return getAdminReadState(shopDb, adminKey);
  }
  const existing: any =
    typeof readsCol.findOne === "function" ? await readsCol.findOne({ adminKey }) : null;
  const currentIds: string[] = Array.isArray(existing?.readIds)
    ? existing.readIds.map(String)
    : [];
  const nextIds = currentIds.includes(id)
    ? currentIds
    : [...currentIds, id].slice(-MAX_STORED_READ_IDS);

  const now = new Date();
  await readsCol.updateOne(
    { adminKey },
    {
      $set: {
        adminKey,
        readIds: nextIds,
        updatedAt: now,
      },
      $setOnInsert: {
        readAllAt: null,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  return {
    adminKey,
    readAllAt: existing?.readAllAt ? toMongoDate(existing.readAllAt) : null,
    readIds: nextIds,
  };
}

export async function markAllNotificationsRead(
  shopDb: Db,
  adminKey: string
): Promise<AdminReadState> {
  const readsCol = shopDb.collection(ADMIN_NOTIFICATION_READS);
  const now = new Date();
  if (typeof readsCol.updateOne === "function") {
    await readsCol.updateOne(
      { adminKey },
      {
        $set: {
          adminKey,
          readAllAt: now,
          readIds: [],
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }
  return { adminKey, readAllAt: now, readIds: [] };
}

export function isNotificationReadByState(
  eventAt: Date,
  itemId: string,
  state: AdminReadState
): boolean {
  if (state.readIds.includes(itemId)) return true;
  if (state.readAllAt && eventAt.getTime() <= state.readAllAt.getTime()) return true;
  return false;
}

function runSortedLimit<T>(
  col: any,
  filter: Record<string, unknown>,
  projection: Record<string, 1>,
  sortSpec: Record<string, 1 | -1>,
  limit: number
): Promise<T[]> {
  let cursor = col.find(filter, { projection });
  if (cursor && typeof cursor.sort === "function") cursor = cursor.sort(sortSpec);
  if (cursor && typeof cursor.limit === "function") cursor = cursor.limit(limit);
  return cursor && typeof cursor.toArray === "function"
    ? cursor.toArray()
    : Promise.resolve([]);
}

export async function backfillNotificationsIfEmpty(shopDb: Db): Promise<number> {
  const notifCol = shopDb.collection(ADMIN_NOTIFICATIONS);
  if (typeof notifCol.find !== "function" || typeof notifCol.insertOne !== "function") {
    return 0;
  }
  const existing = await runSortedLimit(notifCol, {}, { _id: 1 }, { eventAt: -1 }, 1);
  if (existing.length > 0) return 0;

  const [orders, wholesaleAccounts, ctvAccounts, applications] = await Promise.all([
    runSortedLimit<Record<string, any>>(
      shopDb.collection(SHOP_ORDERS),
      {},
      {
        code: 1,
        kvOrderCode: 1,
        kvInvoiceCode: 1,
        orderStatus: 1,
        paymentStatus: 1,
        backorderStatus: 1,
        customerReportedPaidAt: 1,
        source: 1,
        shippingAddress: 1,
        customerName: 1,
        customerPhone: 1,
        grandTotal: 1,
        total: 1,
        priceMode: 1,
        createdAt: 1,
      },
      { createdAt: -1 },
      25
    ),
    runSortedLimit<Record<string, any>>(
      shopDb.collection(SHOP_ACCOUNTS),
      { $or: [{ roles: "si" }, { siStatus: { $exists: true, $ne: null } }] },
      {
        fullName: 1,
        phone: 1,
        email: 1,
        roles: 1,
        siStatus: 1,
        siRegion: 1,
        siVerificationStatus: 1,
        siVerification: 1,
        siKvSyncStatus: 1,
        siAppliedAt: 1,
        siProfile: 1,
        applicationRevision: 1,
        createdAt: 1,
      },
      { createdAt: -1 },
      20
    ),
    runSortedLimit<Record<string, any>>(
      shopDb.collection(SHOP_ACCOUNTS),
      { $or: [{ roles: "ctv" }, { ctvStatus: { $exists: true, $ne: null } }] },
      {
        fullName: 1,
        phone: 1,
        email: 1,
        roles: 1,
        ctvStatus: 1,
        ctvCode: 1,
        ctvAppliedAt: 1,
        createdAt: 1,
      },
      { createdAt: -1 },
      20
    ),
    runSortedLimit<Record<string, any>>(
      shopDb.collection(APPLICATIONS_COL),
      {},
      {
        publicCode: 1,
        contact: 1,
        fullName: 1,
        phone: 1,
        interestedPosition: 1,
        "jobSummary.title": 1,
        status: 1,
        createdAt: 1,
      },
      { createdAt: -1 },
      20
    ),
  ]);

  const seeds: RecordAdminNotificationInput[] = [];

  for (const o of orders) {
    const entityId = String(o.code || o.kvOrderCode || o._id);
    seeds.push({
      dedupeKey: `order:${entityId}`,
      entityType: ADMIN_NOTIFICATION_TYPES.ORDER,
      entityId,
      eventAt: toMongoDate(o.createdAt),
      ...buildOrderNotificationFields(o),
    });
  }
  for (const a of wholesaleAccounts) {
    const id = String(a._id);
    const rev = Number(a.applicationRevision || 1) || 1;
    seeds.push({
      dedupeKey: `wholesale:${id}:rev${rev}`,
      entityType: ADMIN_NOTIFICATION_TYPES.WHOLESALE,
      entityId: id,
      eventAt: toMongoDate(a.siAppliedAt ?? a.siProfile?.acceptedTermsAt ?? a.createdAt),
      ...buildWholesaleNotificationFields(a),
    });
  }
  for (const a of ctvAccounts) {
    const id = String(a._id);
    seeds.push({
      dedupeKey: `ctv:${id}`,
      entityType: ADMIN_NOTIFICATION_TYPES.CTV,
      entityId: id,
      eventAt: toMongoDate(a.ctvAppliedAt ?? a.createdAt),
      ...buildCtvNotificationFields(a),
    });
  }
  for (const app of applications) {
    const id = String(app._id);
    seeds.push({
      dedupeKey: `recruitment:${id}`,
      entityType: ADMIN_NOTIFICATION_TYPES.RECRUITMENT,
      entityId: id,
      eventAt: toMongoDate(app.createdAt),
      ...buildRecruitmentNotificationFields(app),
    });
  }

  seeds.sort((a, b) => toEpochMs(b.eventAt) - toEpochMs(a.eventAt));
  let inserted = 0;
  for (const seed of seeds) {
    await recordAdminNotification(shopDb, seed);
    inserted += 1;
  }
  return inserted;
}

export async function getAdminOpsCounts(shopDb: Db): Promise<{
  ordersNeedAction: number;
  siPending: number;
  ctvPending: number;
  recruitmentNew: number;
  fraudOpen: number;
}> {
  const [ordersNeedAction, siPending, ctvPending, recruitmentNew, fraudOpen] =
    await Promise.all([
      shopDb.collection(SHOP_ORDERS).countDocuments({
        orderStatus: { $nin: [ORDER_STATUS.HUY, ORDER_STATUS.HOAN_THANH] },
        $or: [
          { paymentStatus: { $in: [...PAYMENT_NEED_ACTION_STATUSES] } },
          { orderStatus: { $in: [...ORDER_NEED_ACTION_STATUSES] } },
        ],
      }),
      shopDb.collection(SHOP_ACCOUNTS).countDocuments({
        $and: [
          { $or: [{ roles: "si" }, { siStatus: { $exists: true, $ne: null } }] },
          {
            siStatus: {
              $nin: [
                ACCOUNT_STATUS.TU_CHOI,
                ACCOUNT_STATUS.KHOA,
                ACCOUNT_STATUS.REJECTED,
                ACCOUNT_STATUS.SUSPENDED,
              ],
            },
          },
          {
            $or: [
              { siStatus: ACCOUNT_STATUS.CHO_DUYET },
              { siVerificationStatus: SI_VERIFICATION_STATUS.PENDING },
              { "siVerification.status": SI_VERIFICATION_STATUS.PENDING },
              { siKvSyncStatus: SI_KV_SYNC_STATUS.AWAITING_VERIFICATION },
            ],
          },
        ],
      }),
      shopDb.collection(SHOP_ACCOUNTS).countDocuments({
        roles: "ctv",
        ctvStatus: ACCOUNT_STATUS.CHO_DUYET,
      }),
      shopDb.collection(APPLICATIONS_COL).countDocuments({
        status: { $in: ["new", "reviewing"] },
      }),
      shopDb.collection(SHOP_CTV_FRAUD_EVENTS).countDocuments({
        $or: [{ reviewStatus: "open" }, { reviewStatus: { $exists: false } }],
      }),
    ]);

  return { ordersNeedAction, siPending, ctvPending, recruitmentNew, fraudOpen };
}

export async function listAdminNotificationsFeed(
  shopDb: Db,
  adminKey: string
): Promise<AdminNotificationsResponse> {
  await ensureAdminNotificationIndexes(shopDb);
  await backfillNotificationsIfEmpty(shopDb);

  const notifCol = shopDb.collection(ADMIN_NOTIFICATIONS);
  const [rawDocs, readState, counts] = await Promise.all([
    runSortedLimit<Record<string, any>>(
      notifCol,
      {},
      {
        dedupeKey: 1,
        type: 1,
        title: 1,
        subtitle: 1,
        detail: 1,
        link: 1,
        tag: 1,
        tagColor: 1,
        needsAction: 1,
        eventAt: 1,
        createdAt: 1,
      },
      { eventAt: -1, _id: -1 },
      FEED_LIMIT
    ),
    getAdminReadState(shopDb, adminKey),
    getAdminOpsCounts(shopDb),
  ]);

  const sortedDocs = [...rawDocs]
    .sort((a, b) => toEpochMs(b.eventAt ?? b.createdAt) - toEpochMs(a.eventAt ?? a.createdAt))
    .slice(0, FEED_LIMIT);

  let unreadCount = 0;
  const items: AdminNotificationItem[] = sortedDocs.map((doc) => {
    const id = String(doc.dedupeKey || doc.id || doc._id);
    const eventDate = toMongoDate(doc.eventAt ?? doc.createdAt);
    const iso = eventDate.toISOString();
    const isRead = isNotificationReadByState(eventDate, id, readState);
    if (!isRead) unreadCount += 1;

    return {
      id,
      type: doc.type,
      title: String(doc.title || ""),
      subtitle: String(doc.subtitle || ""),
      ...(doc.detail ? { detail: String(doc.detail) } : {}),
      eventAt: iso,
      createdAt: iso,
      link: String(doc.link || "/admin"),
      ...(doc.tag ? { tag: String(doc.tag) } : {}),
      ...(doc.tagColor ? { tagColor: String(doc.tagColor) } : {}),
      needsAction: Boolean(doc.needsAction),
      isRead,
    };
  });

  return {
    ok: true,
    items,
    counts: {
      total:
        counts.ordersNeedAction +
        counts.siPending +
        counts.ctvPending +
        counts.recruitmentNew,
      orders: counts.ordersNeedAction,
      wholesale: counts.siPending,
      ctv: counts.ctvPending,
      recruitment: counts.recruitmentNew,
    },
    readAllAt: readState.readAllAt ? readState.readAllAt.toISOString() : null,
    unreadCount,
    at: Date.now(),
  };
}
