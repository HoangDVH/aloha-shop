/**
 * Lõi hoàn/hủy đơn — admin mark-returned + webhook/poll KV.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { voidCommissionsForOrder } from "./commission.js";
import { releaseShopStockHolds } from "./stockHold.js";
import { syncBus } from "../syncBus.js";
import { notifyOrderStatus } from "./notifyOrderStatus.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";
import { clawbackPaidOutCommissions } from "./commissionClawback.js";

export type CompleteReturnedOpts = {
  shopDb: Db;
  orderRef: string;
  confirmedBy: string;
  reason?: string;
  /** Hoàn 1 mã SP — không đổi orderStatus cả đơn */
  ma?: string;
  source?: string;
};

export type CompleteReturnedResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  code?: string;
  voided?: number;
  clawback?: { clawed: number; amount: number };
  data?: Record<string, unknown>;
};

export async function completeShopOrderReturned(
  opts: CompleteReturnedOpts
): Promise<CompleteReturnedResult> {
  const { shopDb } = opts;
  const ref = String(opts.orderRef || "").trim();
  if (!ref) return { ok: false, error: "missing_order" };

  const doc = await shopDb
    .collection(SHOP_ORDERS)
    .findOne(shopOrderLookupFilter(ref));
  if (!doc) return { ok: false, error: "not_found" };

  const code = String((doc as any).code || ref);
  const ma = opts.ma
    ? String(opts.ma).trim().toUpperCase()
    : undefined;
  const fullReturn = !ma;
  const now = new Date().toISOString();

  if (fullReturn && String((doc as any).orderStatus) === "huy") {
    // Idempotent: vẫn cố clawback nếu chưa
    const clawback = await clawbackPaidOutCommissions(shopDb, code, {
      reason: opts.reason || "hoan_hang",
      source: opts.source || opts.confirmedBy || "return",
    });
    return {
      ok: true,
      skipped: true,
      code,
      voided: 0,
      clawback,
      data: doc as any,
    };
  }

  const $set: Record<string, unknown> = {
    updatedAt: now,
    returnedAt: now,
    returnedBy: opts.confirmedBy || "system",
    confirmedBy: opts.confirmedBy || "system",
  };
  if (fullReturn) {
    $set.orderStatus = "huy";
    $set.returnReason = String(opts.reason || "hoan_hang").slice(0, 200);
  }

  await shopDb.collection(SHOP_ORDERS).updateOne({ _id: (doc as any)._id }, { $set });

  if (fullReturn) {
    await releaseShopStockHolds(shopDb, code).catch(() => 0);
  }

  const voided = await voidCommissionsForOrder(shopDb, code, {
    ma,
    reason: String(opts.reason || "return"),
  });

  const clawback = await clawbackPaidOutCommissions(shopDb, code, {
    ma,
    reason: opts.reason || "hoan_hang",
    source: opts.source || opts.confirmedBy || "return",
  });

  syncBus.publish(["shop_orders"], "mark-returned", { ids: [code] });
  void notifyOrderStatus(
    shopDb,
    { ...(doc as any), ...$set },
    "huy_hoan"
  ).catch((e) => console.warn("[shop-notify] huy_hoan", e?.message || e));

  const { _id, ...rest } = doc as Record<string, unknown>;
  return {
    ok: true,
    code,
    voided,
    clawback,
    data: { ...rest, ...$set },
  };
}
