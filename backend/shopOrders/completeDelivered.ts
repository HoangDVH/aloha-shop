/**
 * Lõi giao thành công — dùng chung admin mark-delivered + webhook/poll KV.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS, type ShopOrderDetail } from "./models.js";
import { holdCommissionsForOrder } from "./commission.js";
import { ensureCommissionIndexes } from "./commissionModels.js";
import { applyShopOrderStockDeduct } from "./stockApply.js";
import { consumeShopStockHolds } from "./stockHold.js";
import { syncBus } from "../syncBus.js";
import {
  ensureCodDeliveredInvoice,
  ensureCodKvOrder,
  shopCodKvEnabled,
} from "../shopInvoices/invoiceService.js";
import { fullAddressForKv } from "./orderRouteShared.js";
import { notifyOrderStatus } from "./notifyOrderStatus.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";

export type CompleteDeliveredOpts = {
  shopDb: Db;
  mainDb: Db;
  /** Mã đơn shop hoặc legacy */
  orderRef: string;
  confirmedBy: string;
  /** Đã có HĐ KV từ sync — không tạo HĐ mới */
  kvInvoiceId?: string | number | null;
  kvInvoiceCode?: string | null;
  kvOrderId?: string | number | null;
  kvOrderCode?: string | null;
  /** true = chỉ gắn HĐ đã có, không gọi tạo HĐ KV (webhook/poll) */
  skipCreateKvInvoice?: boolean;
};

export type CompleteDeliveredResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  code?: string;
  data?: Record<string, unknown>;
  commission?: { ok: boolean; created: number; flagged: number };
  shortfall?: string[];
};

function mapDetails(raw: unknown): ShopOrderDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it: any) => ({
    productCode: String(it?.productCode || it?.ma || "")
      .trim()
      .toUpperCase(),
    productName: String(it?.productName || it?.ten || "").trim(),
    quantity: Math.max(
      1,
      Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)
    ),
    price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
    discount: Number(it?.discount || 0) || 0,
    ctvCode: it?.ctvCode ? String(it.ctvCode) : undefined,
    imageUrl: it?.imageUrl ? String(it.imageUrl) : undefined,
    note: it?.note ? String(it.note) : undefined,
    variantLabel: it?.variantLabel ? String(it.variantLabel) : undefined,
    preOrder: Boolean(it?.preOrder) || undefined,
  }));
}

export async function completeShopOrderDelivered(
  opts: CompleteDeliveredOpts
): Promise<CompleteDeliveredResult> {
  const { shopDb, mainDb } = opts;
  const ref = String(opts.orderRef || "").trim();
  if (!ref) return { ok: false, error: "missing_order" };

  await ensureCommissionIndexes(shopDb);

  const existing = await shopDb
    .collection(SHOP_ORDERS)
    .findOne(shopOrderLookupFilter(ref));
  if (!existing) return { ok: false, error: "not_found" };

  const orderStatus = String((existing as any).orderStatus || "");
  if (orderStatus === "huy") {
    return { ok: false, skipped: true, error: "already_cancelled", code: String((existing as any).code) };
  }
  if (orderStatus === "hoan_thanh") {
    return {
      ok: true,
      skipped: true,
      code: String((existing as any).code),
      data: existing as any,
    };
  }

  const isCod =
    Boolean((existing as any).usingCod) ||
    String((existing as any).paymentStatus || "") === "cod" ||
    String((existing as any).method || "") === "Cash";

  let kvOrderId =
    opts.kvOrderId ?? (existing as any).kvOrderId ?? null;
  let kvOrderCode =
    opts.kvOrderCode ?? (existing as any).kvOrderCode ?? null;
  let kvInvoiceId =
    opts.kvInvoiceId ?? (existing as any).kvInvoiceId ?? null;
  let kvInvoiceCode =
    opts.kvInvoiceCode ?? (existing as any).kvInvoiceCode ?? null;
  let kvInvoiceMode = (existing as any).kvInvoiceMode ?? null;

  const code = String((existing as any).code || ref);
  const now = new Date().toISOString();

  if (
    isCod &&
    shopCodKvEnabled() &&
    !kvInvoiceId &&
    !opts.skipCreateKvInvoice
  ) {
    const details = mapDetails((existing as any).orderDetails);
    const total = Math.max(
      0,
      Math.round(
        Number((existing as any).total ?? (existing as any).totalPayment) || 0
      )
    );
    const shippingFee = Math.max(
      0,
      Math.round(Number((existing as any).shippingFee) || 0)
    );
    const addr = fullAddressForKv({
      deliveryMethod: String((existing as any).deliveryMethod || ""),
      shippingAddress: String((existing as any).shippingAddress || ""),
      ward: String((existing as any).ward || ""),
      district: String((existing as any).district || ""),
      province: String((existing as any).province || ""),
    });

    try {
      if (kvOrderId == null || kvOrderId === "") {
        const ord = await ensureCodKvOrder({
          mainDb,
          customerName: String((existing as any).customerName || ""),
          customerPhone: String((existing as any).customerPhone || ""),
          address: addr,
          orderDetails: details,
          description: `Web ${code} | COD | giao`.slice(0, 500),
          totalPayment: total,
          shippingFee,
        });
        kvOrderId = ord.kvOrderId;
        kvOrderCode = ord.kvOrderCode;
      }
      const inv = await ensureCodDeliveredInvoice({
        mainDb,
        customerName: String((existing as any).customerName || ""),
        customerPhone: String((existing as any).customerPhone || ""),
        address: addr,
        orderDetails: details,
        description: `Web ${code} | COD thu khi giao | ${kvOrderCode || ""}`.slice(
          0,
          500
        ),
        totalPayment: total,
        shippingFee,
        kvOrderId,
      });
      kvInvoiceId = inv.kvInvoiceId;
      kvInvoiceCode = inv.kvInvoiceCode;
      kvInvoiceMode = "cod_delivered";
    } catch (e: any) {
      // Test tay / ĐH KV không convert được: vẫn hoàn tất đơn shop (kho + HH),
      // không chặn nút «Giao thành công»; ghi lỗi KV để kiểm tra sau.
      const msg = String(e?.message || e || "kv_cod_invoice_failed");
      console.warn("[shop-delivered] kv invoice skipped", code, msg);
      await shopDb.collection(SHOP_ORDERS).updateOne(
        { _id: (existing as any)._id },
        {
          $set: {
            kvPushError: msg.slice(0, 500),
            updatedAt: new Date().toISOString(),
          },
        }
      );
    }
  }

  // Gắn HĐ từ webhook nếu chưa có trên đơn
  if (opts.kvInvoiceId && !kvInvoiceId) {
    kvInvoiceId = opts.kvInvoiceId;
    kvInvoiceCode = opts.kvInvoiceCode || null;
    kvInvoiceMode = kvInvoiceMode || "kv_sync";
  }

  const r = await shopDb.collection(SHOP_ORDERS).findOneAndUpdate(
    {
      _id: (existing as any)._id,
      orderStatus: { $nin: ["huy", "hoan_thanh"] },
    },
    {
      $set: {
        orderStatus: "hoan_thanh",
        deliveredAt: now,
        updatedAt: now,
        deliveredBy: opts.confirmedBy || "system",
        confirmedBy: opts.confirmedBy || "system",
        ...(kvOrderId != null && kvOrderId !== ""
          ? { kvOrderId, kvOrderCode }
          : {}),
        ...(kvInvoiceId != null && kvInvoiceId !== ""
          ? { kvInvoiceId, kvInvoiceCode, kvInvoiceMode }
          : {}),
      },
    },
    { returnDocument: "after" }
  );
  const doc = (r as any)?.value ?? r;
  if (!doc || !(doc as any)._id) {
    // Race: đã hoàn thành hoặc hủy
    const again = await shopDb
      .collection(SHOP_ORDERS)
      .findOne({ _id: (existing as any)._id });
    if (String((again as any)?.orderStatus) === "hoan_thanh") {
      return { ok: true, skipped: true, code, data: again as any };
    }
    return { ok: false, error: "update_failed", code };
  }

  let shortfall: string[] = [];
  if (!(doc as any).stockApplied) {
    const details = mapDetails((doc as any).orderDetails);
    const stock = await applyShopOrderStockDeduct(mainDb, details);
    shortfall = stock.shortfall;
    if (stock.updated.length) {
      syncBus.publish(["aloha_products"], "shop-cod-delivered", {
        ids: stock.updated,
      });
    }
    await shopDb.collection(SHOP_ORDERS).updateOne(
      { _id: (doc as any)._id },
      {
        $set: {
          stockApplied: true,
          stockShortfall: shortfall.length ? shortfall : undefined,
          updatedAt: new Date().toISOString(),
        },
      }
    );
    (doc as any).stockApplied = true;
    if (shortfall.length) (doc as any).stockShortfall = shortfall;
  }
  await consumeShopStockHolds(shopDb, code).catch(() => 0);

  const hold = await holdCommissionsForOrder(shopDb, mainDb, doc as any);
  syncBus.publish(["shop_orders", "aloha_shop_commissions"], "delivered", {
    ids: [code],
  });
  void notifyOrderStatus(shopDb, doc as any, "giao_thanh_cong").catch((e) =>
    console.warn("[shop-notify] giao_thanh_cong", e?.message || e)
  );

  const { _id, ...rest } = doc as Record<string, unknown>;
  return {
    ok: true,
    code,
    data: rest,
    commission: hold,
    shortfall: shortfall.length ? shortfall : undefined,
  };
}
