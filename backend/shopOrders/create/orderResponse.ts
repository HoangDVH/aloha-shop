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

type OrderHashInput = {
  orderDetails: ShopOrderDetail[];
  customerPhone: string;
  deliveryMethod: string;
  shippingAddress: string;
  province?: string;
  district?: string;
  ward?: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  subtotal: number;
};

export function orderBodyHash(input: OrderHashInput): string {
  const ship = input.deliveryMethod === "giao_tan_noi";
  return "v2:" + crypto
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
        shippingAddress: ship ? input.shippingAddress : "",
        province: ship ? input.province || "" : "",
        district: ship ? input.district || "" : "",
        ward: ship ? input.ward || "" : "",
        ghnDistrictId: ship ? input.ghnDistrictId || null : null,
        ghnWardCode: ship ? input.ghnWardCode || "" : "",
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
  // Orders saved before v2 lack address fields in their hash. Compare their saved
  // checkout content so unchanged retries remain safe after an upgrade.
  const storedHash = String(existing.bodyHash || "");
  const comparableHash = bodyHash.startsWith("v2:") && (!storedHash || /^[a-f0-9]{64}$/.test(storedHash))
    ? orderBodyHash({
        orderDetails: existing.orderDetails || [],
        customerPhone: existing.customerPhone || "",
        deliveryMethod: existing.deliveryMethod || "",
        shippingAddress: existing.shippingAddress || "",
        province: existing.province,
        district: existing.district,
        ward: existing.ward,
        ghnDistrictId: existing.ghnDistrictId,
        ghnWardCode: existing.ghnWardCode,
        subtotal: existing.subtotal || 0,
      })
    : storedHash;
  if (comparableHash && comparableHash !== bodyHash) {
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
