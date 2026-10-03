import type { StepFail } from "./stepResult.js";
import type { Db, ObjectId } from "mongodb";
import { SHOP_ORDERS, type ShopOrderDetail } from "../models.js";
import {
  createShopStockHolds,
  ensureShopStockHoldIndexes,
  releaseShopStockHolds,
  shopStockHoldEnabled,
} from "../stockHold.js";
import {
  ensureAwaitingInvoice,
  ensureCodKvOrder,
  ensureReviewKvOrder,
  shopCodKvEnabled,
  shopKiotQrAwaitingEnabled,
} from "../../shopInvoices/invoiceService.js";
import { renameRedemptionOrderCode } from "../../shopPromotions/redemptionService.js";
import { fullAddressForKv } from "../orderRouteShared.js";
import { releaseOrderPromotions } from "./promotionHolds.js";

export type KvPushContext = {
  shopDb: Db;
  mainDb: Db;
  mongoId: ObjectId;
  doc: Record<string, any>;
  code: string;
  user: any;
  orderDetails: ShopOrderDetail[];
  customerName: string;
  customerPhone: string;
  customerNote: string;
  address: {
    deliveryMethod: string;
    shippingAddress: string;
    ward: string;
    district: string;
    province: string;
  };
  hasPreOrder: boolean;
  isNewWebPromo: boolean;
  isTest: boolean;
  reviewFirst: boolean;
  isTransfer: boolean;
  ctvNote: string;
  kvPreOrderHint: string;
  reviewKvDescription: string;
  paymentCode?: string;
  total: number;
  shippingFeeCharged: number;
  discount: number;
  expiresAt?: Date;
};

export type KvPushResult =
  | { ok: true; code: string }
  | StepFail;

async function patchOrder(ctx: KvPushContext, patch: Record<string, unknown>) {
  await ctx.shopDb.collection(SHOP_ORDERS).updateOne({ _id: ctx.mongoId }, { $set: patch });
  Object.assign(ctx.doc, patch);
}

/** Soft-hold tồn shop ngay khi đơn đã được lưu trên Mongo. */
export async function holdOrderStock(ctx: KvPushContext): Promise<void> {
  if (!shopStockHoldEnabled()) return;
  const holdDetails = ctx.orderDetails.filter((d) => !d.preOrder);
  if (!holdDetails.length) return;
  try {
    await ensureShopStockHoldIndexes(ctx.shopDb);
    await createShopStockHolds({
      shopDb: ctx.shopDb,
      orderId: ctx.code,
      orderCode: ctx.code,
      details: holdDetails,
      expiresAt: ctx.expiresAt || null,
    });
    await ctx.shopDb
      .collection(SHOP_ORDERS)
      .updateOne(
        { _id: ctx.mongoId },
        { $set: { stockHeld: true, updatedAt: new Date().toISOString() } }
      );
    ctx.doc.stockHeld = true;
  } catch (e: any) {
    console.warn("[shop-order] stock hold failed", ctx.code, e?.message || e);
  }
}

/** Đẩy KV lỗi mà đơn không đặt trước: nhả tồn, nhả ưu đãi, xoá đơn Mongo. */
async function rollbackOrder(ctx: KvPushContext, code: string): Promise<void> {
  if (ctx.doc.stockHeld) await releaseShopStockHolds(ctx.shopDb, code).catch(() => {});
  await releaseOrderPromotions(ctx.shopDb, code, ctx.isNewWebPromo);
  await ctx.shopDb.collection(SHOP_ORDERS).deleteOne({ _id: ctx.mongoId }).catch(() => {});
}

function kvAddress(ctx: KvPushContext): string {
  return fullAddressForKv(ctx.address);
}

/** Đồng ý chính sách → Đặt hàng KV, chưa hóa đơn. COD cũ giữ nhánh dưới. */
async function pushCodOrReviewOrder(ctx: KvPushContext, code: string): Promise<KvPushResult> {
  const { reviewFirst, isTest, customerNote, kvPreOrderHint, ctvNote } = ctx;
  try {
    const ord = await (reviewFirst ? ensureReviewKvOrder : ensureCodKvOrder)({
      mainDb: ctx.mainDb,
      customerName: ctx.customerName,
      customerId: ctx.user?.kvCustomerId ? Number(ctx.user.kvCustomerId) : undefined,
      customerPhone: ctx.customerPhone,
      address: kvAddress(ctx),
      orderDetails: ctx.orderDetails,
      description: reviewFirst
        ? ctx.reviewKvDescription
        : `Shop COD | ${ctvNote} | ${kvPreOrderHint ? kvPreOrderHint + " | " : ""}${isTest ? "[TEST-WEB] " : ""}${customerNote || "Shop COD"}`.slice(
            0,
            500
          ),
      totalPayment: 0,
      shippingFee: ctx.shippingFeeCharged,
      discount: ctx.discount,
    });
    const kvOrderCode = String(ord.kvOrderCode || "").trim() || null;
    const patch: Record<string, unknown> = {
      kvOrderId: ord.kvOrderId,
      kvOrderCode,
      updatedAt: new Date().toISOString(),
    };
    let nextCode = code;
    if (kvOrderCode && kvOrderCode !== code) {
      patch.legacyCodes = [code];
      patch.code = kvOrderCode;
      patch.id = kvOrderCode;
      await renameRedemptionOrderCode(ctx.shopDb, code, kvOrderCode);
      nextCode = kvOrderCode;
    }
    await patchOrder(ctx, patch);
    return { ok: true, code: nextCode };
  } catch (e: any) {
    const msg = String(e?.message || e || "Không tạo được đơn đặt hàng trên KiotViet");
    if (ctx.hasPreOrder) {
      console.warn("[shop-order] kv COD soft-fail (preOrder)", code, msg);
      await patchOrder(ctx, { kvPushError: msg.slice(0, 500), updatedAt: new Date().toISOString() });
      return { ok: true, code };
    }
    await rollbackOrder(ctx, code);
    return {
      ok: false,
      status: 400,
      body: {
        error: msg,
        code: "kv_cod_order_failed",
        hint: "Kiểm tra kết nối KiotViet / tồn chi nhánh, rồi đặt lại. Đơn chưa được tạo trên shop.",
      },
    };
  }
}

/** Transfer + KiotQR: HĐ chờ CK sau khi đã có đơn Mongo. */
async function pushAwaitingInvoice(ctx: KvPushContext, code: string): Promise<KvPushResult> {
  ctx.doc.kvInvoiceId = null;
  ctx.doc.kvInvoiceCode = null;
  ctx.doc.kvInvoiceMode = null;
  if (!shopKiotQrAwaitingEnabled()) return { ok: true, code };
  try {
    const inv = await ensureAwaitingInvoice({
      mainDb: ctx.mainDb,
      customerName: ctx.customerName,
      customerPhone: ctx.customerPhone,
      address: kvAddress(ctx),
      orderDetails: ctx.orderDetails,
      description:
        `${ctx.paymentCode} | Web ${code} | ${ctx.ctvNote} | ${ctx.kvPreOrderHint ? ctx.kvPreOrderHint + " | " : ""}${ctx.customerNote || "Shop CK"}`.slice(
          0,
          500
        ),
      totalPayment: ctx.total,
      shippingFee: ctx.shippingFeeCharged,
    });
    await patchOrder(ctx, {
      kvInvoiceId: inv.kvInvoiceId,
      kvInvoiceCode: inv.kvInvoiceCode,
      kvInvoiceMode: "awaiting",
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, code };
  } catch (e: any) {
    const msg = String(e?.message || e || "Không tạo được hóa đơn chờ CK");
    // Đơn đặt trước: giữ Mongo + QR ngân hàng dù KV từ chối vì hết tồn
    if (ctx.hasPreOrder) {
      console.warn("[shop-order] kv awaiting soft-fail (preOrder)", code, msg);
      await patchOrder(ctx, { kvPushError: msg.slice(0, 500), updatedAt: new Date().toISOString() });
      return { ok: true, code };
    }
    await rollbackOrder(ctx, code);
    return {
      ok: false,
      status: 400,
      body: {
        error: msg,
        code: "kv_awaiting_failed",
        hint: "Kiểm tra tồn đúng chi nhánh bán trên KiotViet, hoặc tạm tắt SHOP_KIOTQR_AWAITING=0.",
      },
    };
  }
}

/** Đẩy đơn sang KiotViet theo loại đơn; trả mã đơn cuối cùng (có thể đổi sang mã KV). */
export async function pushOrderToKv(ctx: KvPushContext): Promise<KvPushResult> {
  let code = ctx.code;
  const isSi = ctx.doc.priceMode === "si";
  if (!isSi && (ctx.reviewFirst || !ctx.isTransfer) && shopCodKvEnabled()) {
    const r = await pushCodOrReviewOrder(ctx, code);
    if (!r.ok) return r;
    code = r.code;
  }
  if (ctx.isTransfer && !isSi) {
    const r = await pushAwaitingInvoice(ctx, code);
    if (!r.ok) return r;
  }
  return { ok: true, code };
}
