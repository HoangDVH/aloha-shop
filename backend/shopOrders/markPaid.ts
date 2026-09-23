/**
 * Claim unpaid → processing → Hóa đơn KV → trừ kho atomic → paid + SSE.
 */
import type { Db } from "mongodb";
import { syncBus } from "../syncBus.js";
import { SHOP_ORDERS, type ShopOrderDetail } from "./models.js";
import { applyShopOrderStockDeduct } from "./stockApply.js";
import {
  consumeShopStockHolds,
  releaseHoldsForExpiredOrders,
} from "./stockHold.js";
import {
  cancelInvoiceForOrder,
  ensurePaidInvoice,
} from "../shopInvoices/invoiceService.js";

export type MarkPaidSource = "sepay" | "admin" | "kiotqr";

export type MarkPaidResult =
  | { ok: true; alreadyPaid?: boolean; order: Record<string, unknown>; shortfall?: string[] }
  | { ok: false; error: string; code?: string };

function orderDetailsOf(doc: Record<string, unknown>): ShopOrderDetail[] {
  const raw = Array.isArray(doc.orderDetails) ? doc.orderDetails : [];
  return raw.map((it: any) => ({
    productCode: String(it?.productCode || it?.ma || "").trim().toUpperCase(),
    productName: String(it?.productName || it?.ten || "").trim(),
    quantity: Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)),
    price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
    discount: Number(it?.discount || 0) || 0,
    preOrder: Boolean(it?.preOrder) || undefined,
  }));
}

function fullAddressOf(doc: Record<string, unknown>): string {
  if (doc.deliveryMethod === "nhan_cua_hang") return "Nhận tại cửa hàng ALOHA";
  return [doc.shippingAddress, doc.ward, doc.district, doc.province]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Đánh dấu đã thanh toán. Idempotent.
 * - Nếu đã paid + cùng sepay id → ok alreadyPaid
 * - Claim atomic unpaid → processing
 */
export async function markShopOrderPaid(opts: {
  shopDb: Db;
  mainDb: Db;
  orderCode: string;
  source: MarkPaidSource;
  sepayTransactionId?: number | string;
  allowExpired?: boolean;
  confirmedBy?: string;
}): Promise<MarkPaidResult> {
  const col = opts.shopDb.collection(SHOP_ORDERS);
  const code = String(opts.orderCode || "").trim();
  if (!code) return { ok: false, error: "missing_code", code: "missing_code" };

  const now = new Date().toISOString();
  const nowDate = new Date();

  const existing = await col.findOne({ $or: [{ code }, { id: code }] });
  if (!existing) return { ok: false, error: "Không tìm thấy đơn", code: "not_found" };

  const { _id, ...restExisting } = existing as any;
  if ((restExisting.backorderStatus && restExisting.backorderStatus !== "confirmed_paid") || restExisting.method === "Pending") {
    return { ok: false, error: "Đơn đặt trước phải xác nhận và đối soát tiền qua luồng đặt trước", code: "backorder_manual_review" };
  }

  if (restExisting.paymentStatus === "paid") {
    if (
      opts.sepayTransactionId != null &&
      String(restExisting.sepayTransactionId || "") === String(opts.sepayTransactionId)
    ) {
      return { ok: true, alreadyPaid: true, order: restExisting };
    }
    return { ok: true, alreadyPaid: true, order: restExisting };
  }

  if (opts.sepayTransactionId != null) {
    const byTx = await col.findOne({ sepayTransactionId: opts.sepayTransactionId });
    if (byTx && String(byTx.code) !== String(restExisting.code)) {
      return { ok: false, error: "Giao dịch SePay đã gắn đơn khác", code: "tx_conflict" };
    }
  }

  const expireOk =
    opts.allowExpired ||
    !restExisting.expiresAt ||
    new Date(String(restExisting.expiresAt)) > nowDate;

  if (restExisting.paymentStatus === "unpaid" && !expireOk) {
    return { ok: false, error: "Đơn đã hết hạn thanh toán", code: "expired" };
  }

  // Claim: unpaid|underpaid|failed → processing (failed = lần tạo HĐ KV trước lỗi, cho NV bấm lại)
  let claimed = existing as Record<string, unknown>;
  const claimable = ["unpaid", "underpaid", "failed"];
  if (claimable.includes(String(restExisting.paymentStatus || ""))) {
    const claimFilter: Record<string, unknown> = {
      _id: existing._id,
      paymentStatus: { $in: claimable },
    };
    if (!opts.allowExpired && restExisting.paymentStatus === "unpaid") {
      claimFilter.$or = [{ expiresAt: { $gt: nowDate } }, { expiresAt: null }, { expiresAt: { $exists: false } }];
    }
    const claim = await col.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          paymentStatus: "processing",
          paymentClaimedAt: now,
          paymentClaimSource: opts.source,
          updatedAt: now,
          ...(opts.sepayTransactionId != null
            ? { sepayTransactionId: opts.sepayTransactionId }
            : {}),
        },
        $unset: { paymentFailReason: "" },
      },
      { returnDocument: "after" }
    );
    const claimedDoc = (claim as any)?.value ?? claim;
    if (!claimedDoc) {
      const again = await col.findOne({ _id: existing._id });
      if (again?.paymentStatus === "paid") {
        const { _id: __, ...r } = again as any;
        return { ok: true, alreadyPaid: true, order: r };
      }
      if (again?.paymentStatus === "processing") {
        claimed = again as any;
      } else {
        return { ok: false, error: "Không claim được đơn (đang xử lý hoặc hết hạn)", code: "claim_failed" };
      }
    } else {
      claimed = claimedDoc as any;
    }
  } else if (restExisting.paymentStatus === "processing") {
    claimed = existing as any;
    if (opts.sepayTransactionId != null && !claimed.sepayTransactionId) {
      await col.updateOne(
        { _id: existing._id },
        { $set: { sepayTransactionId: opts.sepayTransactionId, updatedAt: now } }
      );
    }
  } else {
    return {
      ok: false,
      error: `Không thể thanh toán khi paymentStatus=${restExisting.paymentStatus}`,
      code: "bad_status",
    };
  }

  const details = orderDetailsOf(claimed);
  const total = Number(claimed.totalPayment ?? claimed.total) || 0;
  const description = String(claimed.customerNote || claimed.description || `Shop ${claimed.code}`).slice(
    0,
    500
  );

  // HĐ KV: luôn giữ 1 mã HĐ.
  // - KiotQR: KV đã thu trên HĐ awaiting → chỉ cập nhật Mongo.
  // - NV/SePay: thu tiền trên đúng HĐ awaiting (POST /payments), không tạo HĐ mới.
  const priorStatus = String(restExisting.paymentStatus || "");
  const replaceExistingIfPresent =
    priorStatus === "unpaid" || priorStatus === "underpaid" || priorStatus === "failed";
  let kvInvoiceId = claimed.kvInvoiceId;
  let kvInvoiceCode = claimed.kvInvoiceCode;
  const keepKiotQrInvoice =
    opts.source === "kiotqr" &&
    kvInvoiceId != null &&
    kvInvoiceId !== "";

  try {
    if (keepKiotQrInvoice) {
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            kvInvoiceId,
            kvInvoiceCode,
            kvInvoiceMode: "paid",
            kvInvoiceCancelledAt: null,
            updatedAt: new Date().toISOString(),
          },
        }
      );
    } else {
      const shippingFee = Math.max(0, Math.round(Number(claimed.shippingFee) || 0));
      const paymentCode = String(claimed.paymentCode || "").trim();
      const inv = await ensurePaidInvoice({
        mainDb: opts.mainDb,
        customerId: claimed.kvCustomerId ? Number(claimed.kvCustomerId) : undefined,
      customerName: String(claimed.customerName || "Khách web"),
        customerPhone: String(claimed.customerPhone || ""),
        address: fullAddressOf(claimed),
        orderDetails: details,
        description: `${paymentCode ? paymentCode + " | " : ""}Web ${claimed.code} | ${description}`.slice(
          0,
          500
        ),
        totalPayment: total,
        shippingFee,
        existingInvoiceId: typeof kvInvoiceId === "number" || typeof kvInvoiceId === "string" ? kvInvoiceId : null,
        existingInvoiceCode: kvInvoiceCode != null ? String(kvInvoiceCode) : null,
        invoiceMode: (claimed.kvInvoiceMode as "awaiting" | "paid" | null) || null,
        replaceExistingIfPresent,
      });
      kvInvoiceId = inv.kvInvoiceId;
      kvInvoiceCode = inv.kvInvoiceCode;
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            kvInvoiceId,
            kvInvoiceCode,
            kvInvoiceMode: "paid",
            kvInvoiceCancelledAt: null,
            updatedAt: new Date().toISOString(),
          },
        }
      );
    }
  } catch (e: any) {
    const rawMsg = String(e?.message || e || "");
    let stockHint = "";
    if (/ton|tồn|stock|không đủ|khong du/i.test(rawMsg)) {
      stockHint =
        " — Trên KiotViet hãy chuyển hàng sang đúng chi nhánh đang bán (token web thường chỉ tạo HĐ ở «Chi nhánh trung tâm»). Shop hiện tổng tồn mọi kho; KV trừ theo từng chi nhánh.";
    } else if (/chi nhánh không tồn tại|branch/i.test(rawMsg)) {
      stockHint =
        " — Đặt SHOP_KV_BRANCH_ID đúng chi nhánh token được phép (xem /branches trên KV).";
    }
    const failMsg = `${rawMsg}${stockHint}`.slice(0, 400);
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          paymentStatus: "failed",
          paymentFailReason: failMsg.slice(0, 300),
          updatedAt: new Date().toISOString(),
        },
      }
    );
    return {
      ok: false,
      error: failMsg || "Không tạo được hóa đơn KiotViet",
      code: "kv_invoice_failed",
    };
  }

  // Trừ kho atomic (skip nếu đã stockApplied)
  let shortfall: string[] = [];
  if (!claimed.stockApplied) {
    const stock = await applyShopOrderStockDeduct(opts.mainDb, details);
    shortfall = stock.shortfall;
    if (stock.updated.length) {
      syncBus.publish(["aloha_products"], `shop-paid:${opts.source}`, {
        ids: stock.updated,
      });
    }
  }
  await consumeShopStockHolds(
    opts.shopDb,
    String(claimed.code || code)
  ).catch(() => 0);

  const orderStatus = shortfall.length ? "thieu_hang" : "cho_xu_ly";
  const paidAt = new Date().toISOString();
  await col.updateOne(
    { _id: existing._id },
    {
      $set: {
        paymentStatus: "paid",
        orderStatus,
        status: orderStatus === "thieu_hang" ? "thieu_hang" : "cho",
        statusValue: orderStatus === "thieu_hang" ? "Thiếu hàng" : "Chờ xử lý",
        stockApplied: true,
        stockShortfall: shortfall.length ? shortfall : undefined,
        kvInvoiceId,
        kvInvoiceCode,
        kvInvoiceMode: "paid",
        paidAt,
        paidSource: opts.source,
        confirmedBy: opts.confirmedBy || opts.source,
        updatedAt: paidAt,
        ...(opts.sepayTransactionId != null
          ? { sepayTransactionId: opts.sepayTransactionId }
          : {}),
      },
      $unset: {
        paymentFailReason: "",
        paymentReview: "",
        paymentMismatch: "",
      },
    }
  );

  const finalDoc = await col.findOne({ _id: existing._id });
  const { _id: ___, ...order } = (finalDoc || claimed) as any;

  syncBus.publish(["shop_orders", "aloha_products"], `shop-paid:${opts.source}`, {
    ids: [String(order.code || code)],
  });

  return { ok: true, order, shortfall: shortfall.length ? shortfall : undefined };
}

export async function expireUnpaidShopOrders(
  shopDb: Db,
  mainDb?: Db
): Promise<number> {
  const now = new Date();
  const nowIso = now.toISOString();
  const col = shopDb.collection(SHOP_ORDERS);
  const expired = await col
    .find({
      paymentStatus: "unpaid",
      method: "Transfer",
      expiresAt: { $lte: now },
    })
    .limit(100)
    .toArray();

  if (mainDb) {
    for (const doc of expired) {
      const invId = (doc as any).kvInvoiceId;
      if (invId != null && invId !== "") {
        await cancelInvoiceForOrder(mainDb, invId).catch(() => false);
      }
    }
  }

  const r = await col.updateMany(
    {
      paymentStatus: "unpaid",
      method: "Transfer",
      expiresAt: { $lte: now },
    },
    {
      $set: {
        paymentStatus: "expired",
        orderStatus: "huy",
        status: "huy",
        statusValue: "Hết hạn CK",
        updatedAt: nowIso,
        kvInvoiceCancelledAt: nowIso,
      },
    }
  );
  const codes = expired
    .map((d) => String((d as any).code || (d as any).id || "").trim())
    .filter(Boolean);
  if (codes.length) {
    await releaseHoldsForExpiredOrders(shopDb, codes).catch(() => undefined);
  }
  if (r.modifiedCount > 0) {
    syncBus.publish(["shop_orders"], "shop-expire", { ids: codes });
  }
  return r.modifiedCount;
}
