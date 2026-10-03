/**
 * Auto sửa tiền/SP shop khi NV sửa Đặt hàng trên KiotViet (trước khi hoàn thành).
 * Gọi từ webhook order.update, đối soát định kỳ (kvOrderEditSync) và nút admin.
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
import { trimCampaignHolds } from "../shopCampaigns/flash/trimHolds.js";
import { syncBus } from "../syncBus.js";

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

/** Giảm giá dòng trên KV là theo đơn vị (Giá bán = Đơn giá − Giảm giá) nên gộp vào giá. */
export function mapKvOrderDetails(
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
    const listPrice = Math.max(0, Number(it?.price ?? it?.Price ?? 0) || 0);
    const unitDiscount = Math.max(0, Number(it?.discount ?? it?.Discount ?? 0) || 0);
    const price = Math.max(0, Math.round(listPrice - unitDiscount));
    const name = String(it?.productName || it?.ProductName || ma).trim();

    if (isKvShipProductCode(ma)) {
      shippingFee = Math.max(shippingFee, Math.round(price * qty));
      continue;
    }

    // Cùng mã có thể có dòng giá flash, dòng giá thường và dòng quà 0đ: khớp thêm theo giá.
    const exact = prevDetails.find((p) => String(p.productCode || "").toUpperCase() === ma && p.price === price);
    const prev = exact || prevByMa.get(ma);
    details.push({
      productCode: ma,
      productName: name,
      quantity: Math.max(1, Math.floor(qty)),
      price,
      discount: 0,
      ctvCode: prev?.ctvCode,
      imageUrl: prev?.imageUrl,
      note: prev?.note,
      variantLabel: prev?.variantLabel,
      ...(prev?.priceKind ? { priceKind: prev.priceKind } : {}),
      ...(prev?.preOrder ? { preOrder: true } : {}),
      ...(exact?.flash ? { flash: exact.flash } : {}),
      ...(exact?.isGift ? { isGift: true, gift: exact.gift } : {}),
    });
  }

  return { details, shippingFee };
}

/** Khoá so sánh không phụ thuộc thứ tự dòng: KV có thể trả dòng khác thứ tự web gửi. */
export function linesMoneyKey(details: ShopOrderDetail[]): string {
  return details
    .map((d) => `${String(d.productCode || "").toUpperCase()}|${Math.max(1, Number(d.quantity) || 1)}|${Math.round(Number(d.price) || 0)}`)
    .sort()
    .join(";");
}

function allocateOrderDiscount(details: ShopOrderDetail[], orderDiscount: number, goodsSubtotal: number) {
  if (orderDiscount <= 0 || goodsSubtotal <= 0) return;
  let allocated = 0;
  const fractions: Array<{ idx: number; frac: number; maxVal: number }> = [];
  details.forEach((d, i) => {
    const lineVal = d.price * Math.max(1, d.quantity);
    const raw = (orderDiscount * lineVal) / goodsSubtotal;
    const flr = Math.floor(raw);
    d.discount = flr;
    allocated += flr;
    fractions.push({ idx: i, frac: raw - flr, maxVal: lineVal });
  });
  let rem = orderDiscount - allocated;
  fractions.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < fractions.length && rem > 0; i++) {
    if (details[fractions[i].idx].discount! < fractions[i].maxVal) {
      details[fractions[i].idx].discount! += 1;
      rem -= 1;
    }
  }
}

/** Web đang đẩy / sửa đơn sỉ lên KV — không kéo ngược về giữa chừng. */
function webPushInProgress(order: Record<string, any>, now = Date.now()): boolean {
  const leased = (v: unknown) => Boolean(v) && new Date(v as string).getTime() > now;
  return (
    leased(order.kvEditLeaseUntil) ||
    leased(order.kvSyncLeaseUntil) ||
    order.kvPushStatus === "sending" ||
    order.kvPushStatus === "unknown"
  );
}

export type SyncMoneyResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  code?: string;
  changed?: boolean;
  /** Khách đã trả mà tổng trên KV khác — không tự đổi, chờ NV xử lý. */
  conflict?: boolean;
};

export async function syncShopOrderMoneyFromKv(opts: {
  shopDb: Db;
  mainDb: Db;
  orderRef?: string;
  kvOrderId?: string | number | null;
  /** Đơn KV đã lấy sẵn (kèm orderDelivery) — bỏ qua lần GET lẻ. */
  kvOrder?: any;
  source?: "webhook" | "poll" | "admin";
}): Promise<SyncMoneyResult> {
  const { shopDb, mainDb } = opts;
  const source = opts.source || "admin";
  let order: Record<string, any> | null = null;
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
  if (webPushInProgress(order)) {
    return { ok: true, skipped: true, code };
  }

  const kvOrderId = opts.kvOrderId ?? order.kvOrderId;
  if (kvOrderId == null || kvOrderId === "") {
    return { ok: false, error: "no_kv_order", code };
  }

  let kvOrder: any = opts.kvOrder;
  if (!kvOrder) {
    try {
      kvOrder = await fetchKvOrder(mainDb, kvOrderId);
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e), code };
    }
  }

  const prevDetails = Array.isArray(order.orderDetails)
    ? (order.orderDetails as ShopOrderDetail[])
    : [];
  const { details, shippingFee } = mapKvOrderDetails(kvOrder, prevDetails);
  if (!details.length) {
    return { ok: false, error: "empty_kv_details", code };
  }

  const rawDiscount = kvOrder?.discount ?? kvOrder?.Discount;
  const kvOrderDiscount =
    rawDiscount != null
      ? Math.max(0, Math.round(Number(rawDiscount) || 0))
      : Math.round(Number(order.discount) || 0);

  const goodsSubtotal = details.reduce(
    (s, d) => s + d.price * Math.max(1, d.quantity),
    0
  );
  const total = Math.round(Math.max(0, goodsSubtotal - kvOrderDiscount) + shippingFee);
  const prevTotal = Math.round(Number(order.total || order.totalPayment) || 0);
  const prevShip = Math.round(Number(order.shippingFee) || 0);
  const prevDiscount = Math.round(Number(order.discount) || 0);
  const sameLines = linesMoneyKey(details) === linesMoneyKey(prevDetails);
  const now = new Date().toISOString();

  if (sameLines && prevShip === shippingFee && prevTotal === total && prevDiscount === kvOrderDiscount) {
    if (order.kvMoneyConflict) {
      await shopDb.collection(SHOP_ORDERS).updateOne({ _id: order._id }, { $unset: { kvMoneyConflict: "" } });
    }
    return { ok: true, skipped: true, changed: false, code };
  }

  const paid = order.paymentStatus === "paid" || Number(order.paidAmount) > 0;
  if (paid && Math.abs(prevTotal - total) > 1) {
    await shopDb.collection(SHOP_ORDERS).updateOne(
      { _id: order._id },
      {
        $set: {
          kvMoneyConflict: { at: now, source, kvTotal: total, kvShippingFee: shippingFee, webTotal: prevTotal },
          updatedAt: now,
        },
      }
    );
    syncBus.publish(["shop_orders"], "kv-money-conflict", { ids: [code] });
    return { ok: true, conflict: true, code };
  }

  allocateOrderDiscount(details, kvOrderDiscount, goodsSubtotal);
  const moneyMismatch = Math.abs(prevTotal - total) > 1;
  const shipChanged = prevShip !== shippingFee;
  const shipDiscount = Math.max(0, Math.round(Number(order.shippingDiscount) || 0));
  const flashSavings = details.reduce(
    (n, d) => n + (d.flash ? Math.max(0, d.flash.listPrice - d.flash.salePrice) * d.quantity : 0),
    0
  );

  await shopDb.collection(SHOP_ORDERS).updateOne(
    { _id: order._id },
    {
      $set: {
        orderDetails: details,
        subtotal: Math.round(goodsSubtotal),
        discount: kvOrderDiscount,
        shippingFee,
        ...(shipChanged ? { shippingFeeOriginal: shippingFee + shipDiscount } : {}),
        ...(sameLines ? {} : { flashSavings }),
        total,
        ...(paid ? {} : { totalPayment: Math.round(Number(order.paidAmount) || 0) }),
        moneySyncedFromKvAt: now,
        moneyMismatch: moneyMismatch || undefined,
        updatedAt: now,
      },
      // Dòng đổi trên KV thì bỏ "Giảm giá sản phẩm" (giá trước KM) thay vì giữ số cũ sai.
      $unset: { kvMoneyConflict: "", ...(sameLines ? {} : { anchorSavings: "" }) },
      $push: {
        moneyChanges: {
          $each: [
            {
              at: now,
              source,
              shippingFee: { from: prevShip, to: shippingFee },
              total: { from: prevTotal, to: total },
              discount: { from: prevDiscount, to: kvOrderDiscount },
              linesChanged: !sameLines,
            },
          ],
          $slice: -20,
        },
      } as any,
    }
  );

  if (shopStockHoldEnabled() && order.stockHeld && !sameLines) {
    await releaseShopStockHolds(shopDb, code).catch(() => 0);
    await ensureShopStockHoldIndexes(shopDb);
    await createShopStockHolds({
      shopDb,
      orderId: code,
      orderCode: code,
      details,
      expiresAt: order.expiresAt || null,
    }).catch((e) => console.warn("[money-sync] rehold", code, e?.message || e));
  }
  if (!sameLines) {
    await trimCampaignHolds(shopDb, code, details).catch((e) =>
      console.warn("[money-sync] trim campaign holds", code, e?.message || e)
    );
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
      discount: kvOrderDiscount,
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

  syncBus.publish(["shop_orders"], "kv-order-edit", { ids: [code] });
  return { ok: true, changed: true, code };
}
