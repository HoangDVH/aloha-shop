/**
 * Soft-hold tồn shop — collection riêng trên shop DB.
 * Không ghi field hold lên aloha_products (tránh lệch poller KV).
 */
import type { Db } from "mongodb";
import type { ShopOrderDetail } from "./models.js";

export const SHOP_STOCK_HOLDS = "aloha_shop_stock_holds";

export function shopStockHoldEnabled(): boolean {
  const v = String(process.env.SHOP_STOCK_HOLD || "1").trim();
  return v !== "0" && v !== "false";
}

export async function ensureShopStockHoldIndexes(shopDb: Db): Promise<void> {
  const col = shopDb.collection(SHOP_STOCK_HOLDS);
  await Promise.all([
    col.createIndex({ orderId: 1, status: 1 }),
    col.createIndex({ ma: 1, status: 1 }),
    col.createIndex({ expiresAt: 1 }, { sparse: true }),
  ]);
}

/** Tổng qty đang hold (status=held) theo mã. excludeOrderId: bỏ hold của chính đơn (gia hạn CK). */
export async function sumHeldQtyByMa(
  shopDb: Db,
  mas: string[],
  excludeOrderId?: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = [
    ...new Set(mas.map((m) => String(m || "").trim().toUpperCase()).filter(Boolean)),
  ];
  if (!uniq.length || !shopStockHoldEnabled()) return out;
  const now = new Date();
  const ex = String(excludeOrderId || "").trim();
  const match: Record<string, unknown> = {
    ma: { $in: uniq },
    status: "held",
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
  if (ex) {
    match.$and = [
      { orderId: { $ne: ex } },
      { orderCode: { $ne: ex } },
    ];
  }
  const rows = await shopDb
    .collection(SHOP_STOCK_HOLDS)
    .aggregate([{ $match: match }, { $group: { _id: "$ma", qty: { $sum: "$qty" } } }])
    .toArray();
  for (const r of rows) {
    const ma = String((r as any)._id || "").trim().toUpperCase();
    if (ma) out.set(ma, Number((r as any).qty) || 0);
  }
  return out;
}

/**
 * Tồn hiển thị kiểu sàn = ton − soft-hold đang active.
 * Không sửa Mongo sản phẩm — chỉ chỉnh payload API công khai.
 */
export async function availableTonAfterHold(
  shopDb: Db,
  ma: string,
  ton: number
): Promise<number> {
  const code = String(ma || "").trim().toUpperCase();
  const raw = Math.max(0, Math.floor(Number(ton) || 0));
  if (!code || !shopStockHoldEnabled()) return raw;
  const held = await sumHeldQtyByMa(shopDb, [code]);
  return Math.max(0, raw - (held.get(code) || 0));
}

export async function subtractHeldFromPublicItems<
  T extends { ma?: string; ton?: number },
>(shopDb: Db, items: T[]): Promise<T[]> {
  if (!shopStockHoldEnabled() || !items.length) return items;
  const mas = [
    ...new Set(
      items
        .map((i) => String(i.ma || "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (!mas.length) return items;
  const held = await sumHeldQtyByMa(shopDb, mas);
  if (!held.size) return items;
  return items.map((i) => {
    const ma = String(i.ma || "").trim().toUpperCase();
    const h = held.get(ma) || 0;
    if (!h) return i;
    const next = Math.max(0, Math.floor(Number(i.ton) || 0) - h);
    if (next === Number(i.ton)) return i;
    return { ...i, ton: next };
  });
}

export async function createShopStockHolds(opts: {
  shopDb: Db;
  orderId: string;
  orderCode: string;
  details: ShopOrderDetail[];
  expiresAt?: Date | null;
}): Promise<void> {
  if (!shopStockHoldEnabled()) return;
  const now = new Date();
  const docs = opts.details
    .filter((d) => !d.preOrder)
    .map((d) => {
      const ma = String(d.productCode || "").trim().toUpperCase();
      const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
      if (!ma) return null;
      return {
        orderId: opts.orderId,
        orderCode: opts.orderCode,
        ma,
        qty,
        status: "held" as const,
        expiresAt: opts.expiresAt || null,
        createdAt: now,
        updatedAt: now,
      };
    })
    .filter(Boolean);
  if (!docs.length) return;
  await opts.shopDb.collection(SHOP_STOCK_HOLDS).insertMany(docs as any[]);
}

export async function releaseShopStockHolds(
  shopDb: Db,
  orderIdOrCode: string
): Promise<number> {
  if (!shopStockHoldEnabled()) return 0;
  const id = String(orderIdOrCode || "").trim();
  if (!id) return 0;
  const now = new Date();
  const r = await shopDb.collection(SHOP_STOCK_HOLDS).updateMany(
    {
      status: "held",
      $or: [{ orderId: id }, { orderCode: id }],
    },
    { $set: { status: "released", updatedAt: now, releasedAt: now } }
  );
  return r.modifiedCount;
}

export async function consumeShopStockHolds(
  shopDb: Db,
  orderIdOrCode: string
): Promise<number> {
  if (!shopStockHoldEnabled()) return 0;
  const id = String(orderIdOrCode || "").trim();
  if (!id) return 0;
  const now = new Date();
  const r = await shopDb.collection(SHOP_STOCK_HOLDS).updateMany(
    {
      status: "held",
      $or: [{ orderId: id }, { orderCode: id }],
    },
    { $set: { status: "consumed", updatedAt: now, consumedAt: now } }
  );
  return r.modifiedCount;
}

/** Nhả hold đơn hết hạn (gọi cùng expireUnpaid). */
export async function releaseHoldsForExpiredOrders(
  shopDb: Db,
  orderCodes: string[]
): Promise<void> {
  if (!shopStockHoldEnabled() || !orderCodes.length) return;
  const now = new Date();
  await shopDb.collection(SHOP_STOCK_HOLDS).updateMany(
    {
      status: "held",
      $or: [
        { orderCode: { $in: orderCodes } },
        { orderId: { $in: orderCodes } },
      ],
    },
    { $set: { status: "released", updatedAt: now, releasedAt: now } }
  );
}

/** Gia hạn CK → kéo expiresAt hold theo đơn. */
export async function extendShopStockHoldExpiry(
  shopDb: Db,
  orderIdOrCode: string,
  expiresAt: Date | null
): Promise<number> {
  if (!shopStockHoldEnabled()) return 0;
  const id = String(orderIdOrCode || "").trim();
  if (!id) return 0;
  const now = new Date();
  const r = await shopDb.collection(SHOP_STOCK_HOLDS).updateMany(
    {
      status: "held",
      $or: [{ orderId: id }, { orderCode: id }],
    },
    { $set: { expiresAt: expiresAt || null, updatedAt: now } }
  );
  return r.modifiedCount;
}
