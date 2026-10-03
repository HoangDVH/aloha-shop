import crypto from "crypto";
import type { Db } from "mongodb";
import { SHOP_ORDERS, type ShopOrderDetail } from "../models.js";
import { resolveShopPaymentQrForOrder } from "../bankConfig.js";

type Qr = Awaited<ReturnType<typeof resolveShopPaymentQrForOrder>> | null;

/** Dữ liệu trả về sau khi tạo đơn (dùng chung cho đơn mới và đơn trùng idempotency). */
export function orderResponseData(doc: Record<string, any>, qr: Qr) {
  return {
    id: doc.id,
    code: doc.code,
    kvOrderId: doc.kvOrderId ?? null,
    kvOrderCode: doc.kvOrderCode ?? null,
    total: doc.total,
    status: doc.status,
    statusValue: doc.statusValue,
    paymentStatus: doc.paymentStatus,
    orderStatus: doc.orderStatus,
    paymentCode: doc.paymentCode,
    expiresAt: doc.expiresAt,
    method: doc.method,
    kvInvoiceId: doc.kvInvoiceId,
    kvInvoiceCode: doc.kvInvoiceCode,
    kvInvoiceMode: doc.kvInvoiceMode,
    qrUrl: qr?.qrUrl || null,
    bank: qr?.bank || null,
    qrKind: qr?.qrKind || null,
    transferContent: qr?.addInfo || null,
    kovCode: (qr as any)?.kovCode || null,
    qrString: (qr as any)?.qrString || null,
  };
}

export function readIdempotencyKey(body: any, headers: Record<string, unknown>): string {
  return String(body.idempotencyKey || headers["idempotency-key"] || "")
    .trim()
    .slice(0, 80);
}

export function orderBodyHash(input: {
  orderDetails: ShopOrderDetail[];
  customerPhone: string;
  deliveryMethod: string;
  shippingAddress: string;
  subtotal: number;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        items: input.orderDetails.map((d) => ({
          productCode: d.productCode,
          quantity: d.quantity,
          price: d.price,
        })),
        customerPhone: input.customerPhone,
        deliveryMethod: input.deliveryMethod,
        shippingAddress: input.shippingAddress,
        subtotal: input.subtotal,
      })
    )
    .digest("hex");
}

export type IdempotentReplay =
  | { kind: "none" }
  | { kind: "conflict"; body: Record<string, unknown> }
  | { kind: "reused"; body: Record<string, unknown> };

/** Tìm đơn đã tạo với cùng idempotencyKey; cùng key khác nội dung trả conflict (mục 6.2, AB15). */
export async function findIdempotentReplay(
  shopDb: Db,
  accountId: string,
  idempotencyKey: string,
  bodyHash: string
): Promise<IdempotentReplay> {
  if (!idempotencyKey) return { kind: "none" };
  const existing = await shopDb
    .collection(SHOP_ORDERS)
    .findOne({ shopAccountId: accountId, idempotencyKey });
  if (!existing) return { kind: "none" };
  if ((existing as any).bodyHash && (existing as any).bodyHash !== bodyHash) {
    return {
      kind: "conflict",
      body: {
        ok: false,
        code: "idempotency_conflict",
        error: "Nội dung yêu cầu khác với yêu cầu đã gửi trước đó cho cùng mã idempotency",
      },
    };
  }
  const { _id, ...rest } = existing as any;
  const qr =
    rest.method === "Transfer" ? await resolveShopPaymentQrForOrder(existing as any, shopDb) : null;
  return { kind: "reused", body: { ok: true, reused: true, data: orderResponseData(rest, qr) } };
}
