/**
 * Engine hoa hồng CTV — theo dòng SP (Shopee/TikTok style).
 */
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../shopAuth/models.js";
import { SHOP_ORDERS, type ShopOrderDetail } from "./models.js";
import {
  SHOP_COMMISSIONS,
  SHOP_COMMISSION_BILLS,
  SHOP_CTV_PRODUCT_RATES,
  SHOP_CTV_FRAUD_EVENTS,
  getCtvSettings,
  type CommissionStatus,
} from "./commissionModels.js";
import { checkOrderFraudFlags } from "./ctvFraud.js";

function roundVnd(n: number): number {
  return Math.round(Number(n) || 0);
}

function lineNet(d: ShopOrderDetail): number {
  const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
  const price = Number(d.price) || 0;
  const discount = Number(d.discount) || 0;
  return Math.max(0, price * qty - discount);
}

export async function resolveRate(
  shopDb: Db,
  mainDb: Db,
  ctvCode: string,
  ma: string
): Promise<{ rate: number; source: "ctv_sp" | "sp" | "shop" | "zero" }> {
  const settings = await getCtvSettings(shopDb);
  const code = normalizeCtvCode(ctvCode);
  const sku = String(ma || "").trim().toUpperCase();
  if (!code || !sku) return { rate: 0, source: "zero" };

  const override = await shopDb.collection(SHOP_CTV_PRODUCT_RATES).findOne({
    ctvCode: code,
    ma: sku,
  });
  if (override && Number.isFinite(Number((override as any).rate))) {
    return { rate: Math.max(0, Number((override as any).rate)), source: "ctv_sp" };
  }

  const product = await mainDb.collection("aloha_products").findOne(
    {
      deletedAt: null,
      $or: [{ ma: sku }, { ma: sku.toLowerCase() }],
    },
    { projection: { ctvCommissionRate: 1, ctvExcluded: 1 } }
  );
  if (product && (product as any).ctvExcluded === true) {
    return { rate: 0, source: "zero" };
  }
  if (
    product &&
    (product as any).ctvCommissionRate != null &&
    Number.isFinite(Number((product as any).ctvCommissionRate))
  ) {
    return {
      rate: Math.max(0, Number((product as any).ctvCommissionRate)),
      source: "sp",
    };
  }

  return {
    rate: Math.max(0, settings.defaultCommissionRate),
    source: "shop",
  };
}

async function isCtvActive(shopDb: Db, ctvCode: string): Promise<boolean> {
  const code = normalizeCtvCode(ctvCode);
  const acc = await shopDb.collection(SHOP_ACCOUNTS).findOne({
    ctvCode: code,
    roles: "ctv",
    ctvStatus: "active",
    active: { $ne: false },
  });
  return Boolean(acc);
}

/** Click gần nhất trong cửa sổ attribution (ngày). */
async function clickWithinWindow(
  shopDb: Db,
  ctvCode: string,
  ma: string,
  orderCreatedAt: Date,
  windowDays: number
): Promise<boolean> {
  const since = new Date(orderCreatedAt.getTime() - windowDays * 86400_000);
  const sinceIso = since.toISOString();
  const untilIso = orderCreatedAt.toISOString();
  const ctv = normalizeCtvCode(ctvCode);
  const anyClick = await shopDb.collection("aloha_shop_ctv_clicks").findOne({
    ctv,
    $or: [
      { createdAt: { $gte: since, $lte: orderCreatedAt } },
      { createdAt: { $gte: sinceIso, $lte: untilIso } },
      { createdAtIso: { $gte: sinceIso, $lte: untilIso } },
    ],
  });
  return Boolean(anyClick);
}

/**
 * Giao thành công → tạo/ cập nhật dòng HH status held.
 */
export async function holdCommissionsForOrder(
  shopDb: Db,
  mainDb: Db,
  order: Record<string, unknown>
): Promise<{ ok: boolean; created: number; flagged: number; error?: string }> {
  const code = String(order.code || order.id || "").trim();
  if (!code) return { ok: false, created: 0, flagged: 0, error: "missing_order" };

  const settings = await getCtvSettings(shopDb);
  const details = Array.isArray(order.orderDetails)
    ? (order.orderDetails as ShopOrderDetail[])
    : [];
  const deliveredAt = new Date(
    String(order.deliveredAt || order.updatedAt || new Date().toISOString())
  );
  const orderCreatedAt = new Date(String(order.createdAt || deliveredAt.toISOString()));
  const eligibleAt = new Date(
    deliveredAt.getTime() + settings.returnHoldDays * 86400_000
  ).toISOString();
  const now = new Date().toISOString();

  const fraud = await checkOrderFraudFlags(shopDb, order, settings);
  let created = 0;
  let flagged = 0;

  for (const d of details) {
    const ctv = normalizeCtvCode(String(d.ctvCode || ""));
    const ma = String(d.productCode || "").trim().toUpperCase();
    if (!ctv || ctv.length < 3 || !ma) continue;
    if (!(await isCtvActive(shopDb, ctv))) continue;

    const inWindow = await clickWithinWindow(
      shopDb,
      ctv,
      ma,
      orderCreatedAt,
      settings.attributionWindowDays
    );
    // Dòng đã gắn ctvCode lúc checkout = attribution hợp lệ (không bắt buộc có click record).
    const hasLineCtv = Boolean(normalizeCtvCode(String(d.ctvCode || "")));
    const ageDays =
      (deliveredAt.getTime() - orderCreatedAt.getTime()) / 86400_000;
    if (
      !inWindow &&
      !hasLineCtv &&
      ageDays > settings.attributionWindowDays + settings.returnHoldDays
    ) {
      continue;
    }
    if (!inWindow && !hasLineCtv) {
      continue;
    }
    if (hasLineCtv && ageDays > settings.attributionWindowDays + settings.returnHoldDays) {
      continue;
    }

    const net = lineNet(d);
    if (net <= 0) continue;
    const { rate, source } = await resolveRate(shopDb, mainDb, ctv, ma);
    if (!(rate > 0)) continue;
    const amount = roundVnd((net * rate) / 100);
    if (amount <= 0) continue;

    const status: CommissionStatus = fraud.hardFlags.length ? "flagged" : "held";
    if (fraud.hardFlags.length) flagged += 1;

    const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
    const unitPrice = Math.max(0, Number(d.price) || 0);
    const imageUrl = String(d.imageUrl || "").trim() || undefined;
    try {
      await shopDb.collection(SHOP_COMMISSIONS).updateOne(
        { orderCode: code, ma, ctvCode: ctv },
        {
          $setOnInsert: {
            orderCode: code,
            ma,
            ctvCode: ctv,
            createdAt: now,
          },
          $set: {
            productName: String(d.productName || ma),
            qty,
            unitPrice,
            imageUrl: imageUrl || null,
            lineTotal: net,
            rate,
            rateSource: source,
            amount,
            status,
            fraudFlags: fraud.flags,
            fraudSoftFlags: fraud.softFlags,
            fraudDetails: fraud.details,
            fraudSeverity: fraud.severity,
            deliveredAt: deliveredAt.toISOString(),
            eligibleAt,
            updatedAt: now,
            shopAccountId: order.shopAccountId ? String(order.shopAccountId) : null,
          },
        },
        { upsert: true }
      );
      created += 1;
    } catch (e) {
      console.warn("[commission] hold upsert", code, ma, e);
    }
  }

  // Snapshot trên order
  await shopDb.collection(SHOP_ORDERS).updateOne(
    { $or: [{ code }, { id: code }] },
    {
      $set: {
        commissionHeldAt: now,
        commissionFraudFlags: fraud.flags,
        commissionFraudSoftFlags: fraud.softFlags,
        commissionFraudSeverity: fraud.severity,
        updatedAt: now,
      },
    }
  );

  return { ok: true, created, flagged };
}

/** held quá eligibleAt → eligible (lazy). Có thể hẹp theo ctvCode. */
export async function clearHeldCommissions(
  shopDb: Db,
  opts?: { ctvCode?: string }
): Promise<number> {
  const now = new Date().toISOString();
  const filter: Record<string, unknown> = {
    status: "held",
    eligibleAt: { $lte: now },
  };
  const code = String(opts?.ctvCode || "")
    .trim()
    .toUpperCase();
  if (code) filter.ctvCode = code;
  const r = await shopDb.collection(SHOP_COMMISSIONS).updateMany(filter, {
    $set: { status: "eligible", clearedAt: now, updatedAt: now },
  });
  return r.modifiedCount || 0;
}

/** Hủy HH theo đơn (hoàn/hủy) — chưa paid_out. */
export async function voidCommissionsForOrder(
  shopDb: Db,
  orderCode: string,
  opts?: { ma?: string; reason?: string }
): Promise<number> {
  const code = String(orderCode || "").trim();
  if (!code) return 0;
  const filter: Record<string, unknown> = {
    orderCode: code,
    status: { $in: ["held", "eligible", "flagged", "billed"] },
  };
  if (opts?.ma) filter.ma = String(opts.ma).trim().toUpperCase();
  const now = new Date().toISOString();
  const r = await shopDb.collection(SHOP_COMMISSIONS).updateMany(filter, {
    $set: {
      status: "cancelled",
      cancelledAt: now,
      cancelReason: opts?.reason || "order_void",
      updatedAt: now,
    },
  });
  return r.modifiedCount || 0;
}

export async function voidUnpaidCommissionsForCtv(
  shopDb: Db,
  ctvCode: string,
  reason: string
): Promise<number> {
  const code = normalizeCtvCode(ctvCode);
  const now = new Date().toISOString();
  const r = await shopDb.collection(SHOP_COMMISSIONS).updateMany(
    {
      ctvCode: code,
      status: { $in: ["held", "eligible", "flagged", "billed"] },
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: reason,
        updatedAt: now,
      },
    }
  );
  return r.modifiedCount || 0;
}

/**
 * Admin bỏ cờ gian — đưa HH về held/eligible theo eligibleAt.
 * filter: _id string hoặc { orderCode, ctvCode?, ma? }
 */
export async function clearCommissionFraudFlag(
  shopDb: Db,
  opts: {
    id?: string;
    orderCode?: string;
    ctvCode?: string;
    ma?: string;
    by?: string;
    note?: string;
  }
): Promise<{ ok: boolean; modified: number; error?: string }> {
  const { ObjectId } = await import("mongodb");
  const now = new Date().toISOString();
  const filter: Record<string, unknown> = { status: "flagged" };
  if (opts.id) {
    try {
      filter._id = new ObjectId(opts.id);
    } catch {
      return { ok: false, modified: 0, error: "invalid_id" };
    }
  } else if (opts.orderCode) {
    filter.orderCode = String(opts.orderCode).trim();
    if (opts.ctvCode) filter.ctvCode = normalizeCtvCode(opts.ctvCode);
    if (opts.ma) filter.ma = String(opts.ma).trim().toUpperCase();
  } else {
    return { ok: false, modified: 0, error: "missing_filter" };
  }

  const rows = await shopDb.collection(SHOP_COMMISSIONS).find(filter).toArray();
  let modified = 0;
  for (const row of rows) {
    const eligibleAt = String((row as any).eligibleAt || "");
    const nextStatus =
      eligibleAt && eligibleAt <= now ? "eligible" : "held";
    const r = await shopDb.collection(SHOP_COMMISSIONS).updateOne(
      { _id: (row as any)._id },
      {
        $set: {
          status: nextStatus,
          fraudFlags: [],
          fraudClearedAt: now,
          fraudClearedBy: opts.by || "admin",
          fraudClearNote: String(opts.note || "").slice(0, 300),
          updatedAt: now,
        },
      }
    );
    modified += r.modifiedCount || 0;
  }
  return { ok: true, modified };
}

/** Admin xác nhận gian — hủy HH flagged + ghi event */
export async function confirmCommissionFraud(
  shopDb: Db,
  opts: {
    id?: string;
    orderCode?: string;
    ctvCode?: string;
    ma?: string;
    by?: string;
    reason?: string;
  }
): Promise<{ ok: boolean; modified: number; error?: string }> {
  const { ObjectId } = await import("mongodb");
  const now = new Date().toISOString();
  const reason = String(opts.reason || "admin_confirm_fraud").slice(0, 200);
  const filter: Record<string, unknown> = {
    status: { $in: ["flagged", "held", "eligible"] },
  };
  if (opts.id) {
    try {
      filter._id = new ObjectId(opts.id);
    } catch {
      return { ok: false, modified: 0, error: "invalid_id" };
    }
  } else if (opts.orderCode) {
    filter.orderCode = String(opts.orderCode).trim();
    if (opts.ctvCode) filter.ctvCode = normalizeCtvCode(opts.ctvCode);
    if (opts.ma) filter.ma = String(opts.ma).trim().toUpperCase();
  } else {
    return { ok: false, modified: 0, error: "missing_filter" };
  }

  const sample = await shopDb.collection(SHOP_COMMISSIONS).findOne(filter);
  const r = await shopDb.collection(SHOP_COMMISSIONS).updateMany(filter, {
    $set: {
      status: "cancelled",
      cancelledAt: now,
      cancelReason: reason,
      fraudConfirmedAt: now,
      fraudConfirmedBy: opts.by || "admin",
      updatedAt: now,
    },
  });

  if (sample) {
    await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).insertOne({
      type: "admin_confirm_fraud",
      severity: "high",
      ctvCode: String((sample as any).ctvCode || ""),
      orderCode: String((sample as any).orderCode || ""),
      details: [reason],
      by: opts.by || "admin",
      reviewStatus: "confirmed",
      createdAt: now,
    });
  }

  return { ok: true, modified: r.modifiedCount || 0 };
}

/**
 * Gỡ hàng loạt cờ cũ chỉ do trùng SĐT (address_match_threshold / phone_repeat)
 * — không đụng self_buy.
 */
export async function clearSoftPhoneRepeatFlags(
  shopDb: Db,
  by?: string
): Promise<number> {
  const now = new Date().toISOString();
  const rows = await shopDb
    .collection(SHOP_COMMISSIONS)
    .find({ status: "flagged" })
    .toArray();
  let n = 0;
  for (const row of rows) {
    const flags = Array.isArray((row as any).fraudFlags)
      ? (row as any).fraudFlags.map(String)
      : [];
    const onlySoft =
      flags.length > 0 &&
      flags.every(
        (f: string) =>
          f === "address_match_threshold" ||
          f === "phone_repeat_soft" ||
          f.startsWith("phone_repeat")
      );
    const hasSelf = flags.some((f: string) => f.startsWith("self_buy"));
    if (!onlySoft || hasSelf) continue;
    const eligibleAt = String((row as any).eligibleAt || "");
    const nextStatus =
      eligibleAt && eligibleAt <= now ? "eligible" : "held";
    const r = await shopDb.collection(SHOP_COMMISSIONS).updateOne(
      { _id: (row as any)._id },
      {
        $set: {
          status: nextStatus,
          fraudFlags: [],
          fraudClearedAt: now,
          fraudClearedBy: by || "admin",
          fraudClearNote: "bulk_clear_soft_phone_repeat",
          updatedAt: now,
        },
      }
    );
    n += r.modifiedCount || 0;
  }
  return n;
}

/** Chốt bill tháng kiểu AMS. */
export type EligiblePeriodPreview = {
  period: string;
  ctvLines: Array<{
    ctvCode: string;
    gross: number;
    adjustments: number;
    net: number;
    orderCount: number;
    lineCount: number;
  }>;
  totals: {
    commission: number;
    orderCount: number;
    ctvCount: number;
    adjustments: number;
    lineCount: number;
  };
  /** id dòng HH + adjustment sẽ bị chốt */
  commissionIds: unknown[];
};

/** Gom HH eligible theo kỳ (không ghi DB) — dùng preview admin + lock.
 * Hỗ trợ kỳ tháng YYYY-MM (cả tháng) và các đợt bi-weekly:
 * - YYYY-MM-K1 (Đợt 1): eligibleAt từ 01 đến hết ngày 15.
 * - YYYY-MM-K2 (Đợt 2): eligibleAt từ ngày 16 đến hết tháng (kèm đón các đơn eligible sót lại trước ngày 16 chưa chốt).
 */
export async function buildEligiblePeriodPreview(
  shopDb: Db,
  period: string
): Promise<{ ok: true; preview: EligiblePeriodPreview } | { ok: false; error: string }> {
  const m = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(String(period || "").trim());
  if (!m) return { ok: false, error: "period_invalid" };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const cycle = m[3] as "K1" | "K2" | undefined;
  if (!(mo >= 1 && mo <= 12)) return { ok: false, error: "period_invalid" };

  await clearHeldCommissions(shopDb);

  let eligibleAtFilter: Record<string, unknown>;
  if (cycle === "K1") {
    const periodStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
    const periodEnd = new Date(Date.UTC(y, mo - 1, 16)).toISOString(); // exclusive -> hết ngày 15
    eligibleAtFilter = { $gte: periodStart, $lt: periodEnd };
  } else if (cycle === "K2") {
    // Đợt 2: gom từ ngày 16 đến hết tháng thuộc cùng tháng YYYY-MM (bao gồm đơn đợt 1 từ ngày 01 còn sót chưa vào bill)
    const periodStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
    const periodEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
    eligibleAtFilter = { $gte: periodStart, $lt: periodEnd };
  } else {
    // Cả tháng (legacy / full month)
    const periodStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
    const periodEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
    eligibleAtFilter = { $gte: periodStart, $lt: periodEnd };
  }

  const rows = await shopDb
    .collection(SHOP_COMMISSIONS)
    .find({
      status: "eligible",
      billingPeriod: { $in: [null, ""] },
      eligibleAt: eligibleAtFilter,
    })
    .toArray();

  const byCtv = new Map<
    string,
    { ctvCode: string; gross: number; orderCount: number; lineCount: number; ids: unknown[] }
  >();
  for (const r of rows) {
    const ctv = String((r as any).ctvCode || "");
    if (!ctv) continue;
    const amt = Number((r as any).amount) || 0;
    const cur = byCtv.get(ctv) || {
      ctvCode: ctv,
      gross: 0,
      orderCount: 0,
      lineCount: 0,
      ids: [],
    };
    cur.gross += amt;
    cur.lineCount += 1;
    cur.ids.push((r as any)._id);
    byCtv.set(ctv, cur);
  }

  for (const [ctv, cur] of byCtv) {
    const orders = new Set(
      rows
        .filter((r) => String((r as any).ctvCode) === ctv)
        .map((r) => String((r as any).orderCode))
    );
    cur.orderCount = orders.size;
  }

  const adjDocs = await shopDb
    .collection(SHOP_COMMISSIONS)
    .find({
      status: "eligible",
      billingPeriod: { $in: [null, ""] },
      isAdjustment: true,
      $or: [
        { billingPeriodTarget: period },
        ...(cycle === "K1" || cycle === "K2" ? [{ billingPeriodTarget: `${y}-${String(mo).padStart(2, "0")}` }] : []),
      ],
    })
    .toArray();
  for (const a of adjDocs) {
    const ctv = String((a as any).ctvCode || "");
    if (!ctv) continue;
    const amt = Number((a as any).amount) || 0;
    const cur = byCtv.get(ctv) || {
      ctvCode: ctv,
      gross: 0,
      orderCount: 0,
      lineCount: 0,
      ids: [],
    };
    cur.gross += amt;
    cur.ids.push((a as any)._id);
    byCtv.set(ctv, cur);
  }

  const ctvLines = [...byCtv.values()]
    .map((c) => ({
      ctvCode: c.ctvCode,
      gross: roundVnd(c.gross),
      adjustments: 0,
      net: roundVnd(c.gross),
      orderCount: c.orderCount,
      lineCount: c.lineCount,
    }))
    .sort((a, b) => b.net - a.net || a.ctvCode.localeCompare(b.ctvCode));

  const commissionIds = [...byCtv.values()].flatMap((c) => c.ids);

  return {
    ok: true,
    preview: {
      period,
      ctvLines,
      totals: {
        commission: roundVnd(ctvLines.reduce((s, x) => s + x.net, 0)),
        orderCount: new Set(rows.map((r) => String((r as any).orderCode))).size,
        ctvCount: ctvLines.length,
        adjustments: 0,
        lineCount: rows.length + adjDocs.length,
      },
      commissionIds,
    },
  };
}

export async function lockMonthlyBill(
  shopDb: Db,
  period: string,
  lockedBy: string
): Promise<{ ok: boolean; bill?: Record<string, unknown>; error?: string }> {
  const built = await buildEligiblePeriodPreview(shopDb, period);
  if (!built.ok) return { ok: false, error: built.error };

  const existing = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  if (existing && (existing as any).status === "locked") {
    return { ok: false, error: "already_locked" };
  }
  if (existing && (existing as any).status === "paid") {
    return { ok: false, error: "already_paid" };
  }

  const { preview } = built;
  const settings = await getCtvSettings(shopDb);
  const now = new Date().toISOString();
  const billId = `BILL-${period}`;

  const bill = {
    id: billId,
    period,
    status: "locked" as const,
    settleDay: settings.settleDay,
    lockedAt: now,
    lockedBy: lockedBy || "admin",
    totals: preview.totals,
    ctvLines: preview.ctvLines,
    updatedAt: now,
    createdAt: (existing as any)?.createdAt || now,
  };

  await shopDb.collection(SHOP_COMMISSION_BILLS).updateOne(
    { period },
    { $set: bill },
    { upsert: true }
  );

  if (preview.commissionIds.length) {
    await shopDb.collection(SHOP_COMMISSIONS).updateMany(
      { _id: { $in: preview.commissionIds as any[] } },
      {
        $set: {
          status: "billed",
          billId,
          billingPeriod: period,
          billedAt: now,
          updatedAt: now,
        },
      }
    );
  }

  return { ok: true, bill };
}

export async function markBillPaid(
  shopDb: Db,
  period: string,
  opts?: { ctvCode?: string; paidBy?: string }
): Promise<{ ok: boolean; error?: string; modified?: number }> {
  const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  if (!bill) return { ok: false, error: "bill_not_found" };
  if ((bill as any).status === "paid" && !opts?.ctvCode) {
    return { ok: false, error: "already_paid" };
  }
  if ((bill as any).status !== "locked" && (bill as any).status !== "paid") {
    return { ok: false, error: "bill_not_locked" };
  }

  const now = new Date().toISOString();
  const filter: Record<string, unknown> = {
    billingPeriod: period,
    status: "billed",
  };
  if (opts?.ctvCode) filter.ctvCode = normalizeCtvCode(opts.ctvCode);

  const r = await shopDb.collection(SHOP_COMMISSIONS).updateMany(filter, {
    $set: {
      status: "paid_out",
      paidOutAt: now,
      paidOutBy: opts?.paidBy || "admin",
      updatedAt: now,
    },
  });

  if (opts?.ctvCode) {
    const ctvLines = Array.isArray((bill as any).ctvLines) ? [...(bill as any).ctvLines] : [];
    const next = ctvLines.map((l: any) =>
      String(l.ctvCode) === normalizeCtvCode(opts.ctvCode!)
        ? { ...l, paidAt: now }
        : l
    );
    const allPaid = next.every((l: any) => l.paidAt);
    await shopDb.collection(SHOP_COMMISSION_BILLS).updateOne(
      { period },
      {
        $set: {
          ctvLines: next,
          ...(allPaid ? { status: "paid", paidAt: now } : {}),
          updatedAt: now,
        },
      }
    );
  } else {
    await shopDb.collection(SHOP_COMMISSION_BILLS).updateOne(
      { period },
      {
        $set: {
          status: "paid",
          paidAt: now,
          paidBy: opts?.paidBy || "admin",
          updatedAt: now,
          ctvLines: (Array.isArray((bill as any).ctvLines) ? (bill as any).ctvLines : []).map(
            (l: any) => ({ ...l, paidAt: l.paidAt || now })
          ),
        },
      }
    );
  }

  return { ok: true, modified: r.modifiedCount || 0 };
}
