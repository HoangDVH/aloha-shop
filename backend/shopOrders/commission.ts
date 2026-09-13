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

    const status: CommissionStatus = fraud.flags.length ? "flagged" : "held";
    if (fraud.flags.length) flagged += 1;

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
        updatedAt: now,
      },
    }
  );

  return { ok: true, created, flagged };
}

/** held quá eligibleAt → eligible (lazy). */
export async function clearHeldCommissions(shopDb: Db): Promise<number> {
  const now = new Date().toISOString();
  const r = await shopDb.collection(SHOP_COMMISSIONS).updateMany(
    {
      status: "held",
      eligibleAt: { $lte: now },
    },
    { $set: { status: "eligible", clearedAt: now, updatedAt: now } }
  );
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

/** Chốt bill tháng kiểu AMS. */
export async function lockMonthlyBill(
  shopDb: Db,
  period: string,
  lockedBy: string
): Promise<{ ok: boolean; bill?: Record<string, unknown>; error?: string }> {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || "").trim());
  if (!m) return { ok: false, error: "period_invalid" };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!(mo >= 1 && mo <= 12)) return { ok: false, error: "period_invalid" };

  await clearHeldCommissions(shopDb);

  const existing = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
  if (existing && (existing as any).status === "locked") {
    return { ok: false, error: "already_locked" };
  }
  if (existing && (existing as any).status === "paid") {
    return { ok: false, error: "already_paid" };
  }

  // eligibleAt thuộc tháng period (hoặc eligible trước cuối tháng và chưa billed)
  const periodStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
  const periodEnd = new Date(Date.UTC(y, mo, 1)).toISOString();

  const rows = await shopDb
    .collection(SHOP_COMMISSIONS)
    .find({
      status: "eligible",
      eligibleAt: { $gte: periodStart, $lt: periodEnd },
    })
    .toArray();

  const byCtv = new Map<
    string,
    { ctvCode: string; gross: number; orderCount: number; lineCount: number; ids: string[] }
  >();
  for (const r of rows) {
    const ctv = String((r as any).ctvCode || "");
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
    cur.ids.push(String((r as any)._id));
    byCtv.set(ctv, cur);
  }

  // order count unique per ctv
  for (const [ctv, cur] of byCtv) {
    const orders = new Set(
      rows.filter((r) => String((r as any).ctvCode) === ctv).map((r) => String((r as any).orderCode))
    );
    cur.orderCount = orders.size;
  }

  // Adjustments từ kỳ trước (âm)
  const adjDocs = await shopDb
    .collection(SHOP_COMMISSIONS)
    .find({
      status: "eligible",
      isAdjustment: true,
      billingPeriodTarget: period,
    })
    .toArray();
  for (const a of adjDocs) {
    const ctv = String((a as any).ctvCode || "");
    const amt = Number((a as any).amount) || 0;
    const cur = byCtv.get(ctv) || {
      ctvCode: ctv,
      gross: 0,
      orderCount: 0,
      lineCount: 0,
      ids: [],
    };
    cur.gross += amt;
    cur.ids.push(String((a as any)._id));
    byCtv.set(ctv, cur);
  }

  const ctvLines = [...byCtv.values()].map((c) => ({
    ctvCode: c.ctvCode,
    gross: roundVnd(c.gross),
    adjustments: 0,
    net: roundVnd(c.gross),
    orderCount: c.orderCount,
    lineCount: c.lineCount,
  }));

  const settings = await getCtvSettings(shopDb);
  const now = new Date().toISOString();
  const billId = `BILL-${period}`;
  const totalCommission = roundVnd(ctvLines.reduce((s, x) => s + x.net, 0));

  const bill = {
    id: billId,
    period,
    status: "locked" as const,
    settleDay: settings.settleDay,
    lockedAt: now,
    lockedBy: lockedBy || "admin",
    totals: {
      commission: totalCommission,
      orderCount: new Set(rows.map((r) => String((r as any).orderCode))).size,
      ctvCount: ctvLines.length,
      adjustments: 0,
      lineCount: rows.length + adjDocs.length,
    },
    ctvLines,
    updatedAt: now,
    createdAt: (existing as any)?.createdAt || now,
  };

  await shopDb.collection(SHOP_COMMISSION_BILLS).updateOne(
    { period },
    { $set: bill },
    { upsert: true }
  );

  const ids = rows.map((r) => (r as any)._id).concat(adjDocs.map((a) => (a as any)._id));
  if (ids.length) {
    await shopDb.collection(SHOP_COMMISSIONS).updateMany(
      { _id: { $in: ids } },
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
