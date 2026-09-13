/**
 * Auto sửa tiền/SP shop khi NV sửa Đặt hàng trên KiotViet (trước khi hoàn thành).
 */
import type { Db } from "mongodb";
import {
  fetchKvAccessToken,
  kvApiBase,
  loadKvCreds,
} from "../services/kvApiClient.js";
import { SHOP_ORDERS, type ShopOrderDetail } from "./models.js";
import { isKvShipProductCode } from "./kvDeliveryStatus.js";
import { holdCommissionsForOrder, voidCommissionsForOrder } from "./commission.js";
import { clawbackPaidOutCommissions } from "./commissionClawback.js";
import {
  createShopStockHolds,
  releaseShopStockHolds,
  ensureShopStockHoldIndexes,
  shopStockHoldEnabled,
} from "./stockHold.js";
import { findShopOrderByKvOrderId, findShopOrderByRef } from "./findShopOrder.js";

async function fetchJson(
  url: string,
  init?: RequestInit & { timeout?: number }
): Promise<any> {
  const timeout = init?.timeout ?? 60_000;
  const { timeout: _t, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      json?.responseStatus?.message ||
      json?.message ||
      text.slice(0, 400) ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return json;
}

export async function fetchKvOrder(
  mainDb: Db,
  kvOrderId: string | number
): Promise<any> {
  const creds = await loadKvCreds(mainDb);
  if (!creds) throw new Error("Chưa cấu hình KiotViet");
  const token = await fetchKvAccessToken(creds);
  const api = kvApiBase();
  const json = await fetchJson(
    `${api}/orders/${encodeURIComponent(String(kvOrderId))}?includeOrderDelivery=true`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Retailer: creds.retailer,
      },
      timeout: 60_000,
    }
  );
  return json?.data ?? json;
}

function mapKvOrderDetails(
  kvOrder: any,
  prevDetails: ShopOrderDetail[]
): { details: ShopOrderDetail[]; shippingFee: number } {
  const prevByMa = new Map(
    prevDetails.map((d) => [String(d.productCode || "").toUpperCase(), d])
  );
  const raw = Array.isArray(kvOrder?.orderDetails)
    ? kvOrder.orderDetails
    : Array.isArray(kvOrder?.OrderDetails)
      ? kvOrder.OrderDetails
      : [];

  let shippingFee = Math.max(
    0,
    Math.round(
      Number(
        kvOrder?.orderDelivery?.price ??
          kvOrder?.OrderDelivery?.price ??
          0
      ) || 0
    )
  );

  const details: ShopOrderDetail[] = [];
  for (const it of raw) {
    const ma = String(it?.productCode || it?.ProductCode || "")
      .trim()
      .toUpperCase();
    if (!ma) continue;
    const qty = Math.max(
      0.001,
      Number(it?.quantity ?? it?.Quantity ?? 1) || 1
    );
    const price = Math.max(0, Number(it?.price ?? it?.Price ?? 0) || 0);
    const discount = Number(it?.discount ?? it?.Discount ?? 0) || 0;
    const name = String(it?.productName || it?.ProductName || ma).trim();

    if (isKvShipProductCode(ma)) {
      shippingFee = Math.max(shippingFee, Math.round(price * qty - discount));
      continue;
    }

    const prev = prevByMa.get(ma);
    details.push({
      productCode: ma,
      productName: name,
      quantity: Math.max(1, Math.floor(qty)),
      price,
      discount,
      ctvCode: prev?.ctvCode,
      imageUrl: prev?.imageUrl,
      note: prev?.note,
      variantLabel: prev?.variantLabel,
    });
  }

  return { details, shippingFee };
}

export type SyncMoneyResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  code?: string;
  changed?: boolean;
};

export async function syncShopOrderMoneyFromKv(opts: {
  shopDb: Db;
  mainDb: Db;
  orderRef?: string;
  kvOrderId?: string | number | null;
}): Promise<SyncMoneyResult> {
  const { shopDb, mainDb } = opts;
  let order: Record<string, unknown> | null = null;
  if (opts.orderRef) {
    order = await findShopOrderByRef(shopDb, opts.orderRef);
  }
  if (!order && opts.kvOrderId != null) {
    order = await findShopOrderByKvOrderId(shopDb, opts.kvOrderId);
  }
  if (!order) return { ok: false, error: "not_found" };

  const code = String(order.code || order.id || "");
  const st = String(order.orderStatus || "");
  if (st === "hoan_thanh" || st === "huy") {
    return { ok: true, skipped: true, code };
  }

  const kvOrderId = opts.kvOrderId ?? order.kvOrderId;
  if (kvOrderId == null || kvOrderId === "") {
    return { ok: false, error: "no_kv_order", code };
  }

  let kvOrder: any;
  try {
    kvOrder = await fetchKvOrder(mainDb, kvOrderId as any);
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), code };
  }

  const prevDetails = Array.isArray(order.orderDetails)
    ? (order.orderDetails as ShopOrderDetail[])
    : [];
  const { details, shippingFee } = mapKvOrderDetails(kvOrder, prevDetails);
  if (!details.length) {
    return { ok: false, error: "empty_kv_details", code };
  }

  const subtotal = details.reduce(
    (s, d) =>
      s +
      Math.max(0, d.price * Math.max(1, d.quantity) - (Number(d.discount) || 0)),
    0
  );
  const total = Math.round(subtotal + shippingFee);
  const prevTotal = Math.round(Number(order.total || order.totalPayment) || 0);
  const prevShip = Math.round(Number(order.shippingFee) || 0);
  const sameLines =
    details.length === prevDetails.length &&
    details.every((d, i) => {
      const p = prevDetails[i];
      return (
        p &&
        p.productCode === d.productCode &&
        p.quantity === d.quantity &&
        p.price === d.price &&
        Number(p.discount || 0) === Number(d.discount || 0)
      );
    });
  if (sameLines && prevShip === shippingFee && prevTotal === total) {
    return { ok: true, skipped: true, changed: false, code };
  }

  const now = new Date().toISOString();
  const moneyMismatch = Math.abs(prevTotal - total) > 1;

  await shopDb.collection(SHOP_ORDERS).updateOne(
    { _id: (order as any)._id },
    {
      $set: {
        orderDetails: details,
        subtotal: Math.round(subtotal),
        shippingFee,
        total,
        totalPayment: total,
        moneySyncedFromKvAt: now,
        moneyMismatch: moneyMismatch || undefined,
        updatedAt: now,
      },
    }
  );

  if (shopStockHoldEnabled() && order.stockHeld) {
    await releaseShopStockHolds(shopDb, code).catch(() => 0);
    await ensureShopStockHoldIndexes(shopDb);
    await createShopStockHolds({
      shopDb,
      orderId: code,
      orderCode: code,
      details,
      expiresAt: (order as any).expiresAt || null,
    }).catch((e) => console.warn("[money-sync] rehold", code, e?.message || e));
  }

  // HH chưa chi: void + rehold với rate snapshot qua hold lại
  const held = await shopDb.collection("aloha_shop_commissions").countDocuments({
    orderCode: code,
    status: { $in: ["held", "eligible", "flagged"] },
  });
  if (held > 0) {
    await voidCommissionsForOrder(shopDb, code, { reason: "money_sync_recalc" });
    await holdCommissionsForOrder(shopDb, mainDb, {
      ...order,
      orderDetails: details,
      total,
      code,
    });
  }
  // paid_out: clawback nếu tổng giảm mạnh (đơn chưa hoàn thành hiếm khi paid_out)
  if (total < prevTotal) {
    await clawbackPaidOutCommissions(shopDb, code, {
      reason: "money_sync_reduce",
      source: "kv_order_money_sync",
    });
  }

  return { ok: true, changed: true, code };
}
