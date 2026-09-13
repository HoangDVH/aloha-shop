/**
 * Nghiệp vụ HĐ web: chờ CK (KiotQR) lúc đặt đơn; đủ tiền sau webhook / NV xác nhận.
 * COD: Đặt hàng KV lúc đặt → Hóa đơn KV lúc giao xong.
 */
import type { Db } from "mongodb";
import type { ShopOrderDetail } from "../shopOrders/models.js";
import {
  cancelKvInvoice,
  createKvInvoice,
  createKvOrder,
  payKvInvoice,
} from "./kvInvoiceClient.js";

/** Bật HĐ chờ CK lúc đặt Transfer (webhook KiotQR → realtime). Tắt: SHOP_KIOTQR_AWAITING=0 */
export function shopKiotQrAwaitingEnabled(): boolean {
  const v = String(process.env.SHOP_KIOTQR_AWAITING ?? "1")
    .trim()
    .toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

/** Bật COD → Đặt hàng + HĐ KV. Tắt: SHOP_COD_KV=0 */
export function shopCodKvEnabled(): boolean {
  const v = String(process.env.SHOP_COD_KV ?? "1")
    .trim()
    .toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

export type EnsurePaidInvoiceInput = {
  mainDb: Db;
  customerName: string;
  customerPhone: string;
  address: string;
  orderDetails: ShopOrderDetail[];
  description: string;
  totalPayment: number;
  shippingFee?: number;
  existingInvoiceId?: number | string | null;
  existingInvoiceCode?: string | null;
  /** awaiting = HĐ chờ tiền; paid = đã tạo HĐ đủ tiền */
  invoiceMode?: "awaiting" | "paid" | null;
  /**
   * true khi vừa claim từ unpaid/underpaid và chưa có HĐ —
   * lúc đó mới tạo HĐ đủ tiền. Nếu đã có HĐ awaiting → thu trên HĐ đó.
   */
  replaceExistingIfPresent?: boolean;
};

export type EnsurePaidInvoiceResult = {
  kvInvoiceId: number | string;
  kvInvoiceCode: string;
  /** true nếu đã thu trên HĐ awaiting (không tạo mã mới) */
  paidExisting?: boolean;
};

export type EnsureAwaitingInvoiceInput = {
  mainDb: Db;
  customerName: string;
  customerPhone: string;
  address: string;
  orderDetails: ShopOrderDetail[];
  description: string;
  totalPayment: number;
  shippingFee?: number;
};

/** Tạo HĐ KV chờ CK (totalPayment=0 trên KV) — KiotQR quét → webhook invoice.update. */
export async function ensureAwaitingInvoice(
  opts: EnsureAwaitingInvoiceInput
): Promise<EnsurePaidInvoiceResult> {
  const inv = await createKvInvoice(opts.mainDb, {
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    address: opts.address,
    orderDetails: opts.orderDetails,
    usingCod: false,
    method: "Transfer",
    description: opts.description.slice(0, 500),
    totalPayment: Math.max(0, Math.round(Number(opts.totalPayment) || 0)),
    shippingFee: opts.shippingFee,
    awaitingBankTransfer: true,
  });
  return {
    kvInvoiceId: inv.kvInvoiceId,
    kvInvoiceCode: inv.kvInvoiceCode,
  };
}

/**
 * Đảm bảo có HĐ KV đã thu đủ tiền.
 * Có HĐ awaiting → POST /payments trên đúng HĐ đó (không tạo mã mới).
 * Chưa có HĐ → tạo HĐ mới với totalPayment đủ.
 */
export async function ensurePaidInvoice(
  opts: EnsurePaidInvoiceInput
): Promise<EnsurePaidInvoiceResult> {
  const existingId = opts.existingInvoiceId;
  const hasExisting = existingId != null && existingId !== "";
  const code = String(opts.existingInvoiceCode || existingId || "").trim();
  const amount = Math.max(0, Math.round(Number(opts.totalPayment) || 0));

  if (opts.invoiceMode === "paid" && hasExisting) {
    return {
      kvInvoiceId: existingId as number | string,
      kvInvoiceCode: code || String(existingId),
    };
  }

  // HĐ chờ CK (hoặc đơn unpaid đã gắn HĐ): thu trên đúng HĐ → KV chỉ 1 mã
  const shouldCollectOnExisting =
    hasExisting &&
    amount > 0 &&
    (opts.invoiceMode === "awaiting" ||
      (opts.invoiceMode !== "paid" && opts.replaceExistingIfPresent === true));

  if (shouldCollectOnExisting) {
    await payKvInvoice(opts.mainDb, {
      invoiceId: existingId as number | string,
      amount,
      method: "Transfer",
    });
    return {
      kvInvoiceId: existingId as number | string,
      kvInvoiceCode: code || String(existingId),
      paidExisting: true,
    };
  }

  if (hasExisting) {
    // Đã có HĐ (paid / retry): giữ nguyên mã
    return {
      kvInvoiceId: existingId as number | string,
      kvInvoiceCode: code || String(existingId),
    };
  }

  const inv = await createKvInvoice(opts.mainDb, {
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    address: opts.address,
    orderDetails: opts.orderDetails,
    usingCod: false,
    method: "Transfer",
    description: opts.description.slice(0, 500),
    totalPayment: amount,
    shippingFee: opts.shippingFee,
    awaitingBankTransfer: false,
  });

  return {
    kvInvoiceId: inv.kvInvoiceId,
    kvInvoiceCode: inv.kvInvoiceCode,
  };
}

export async function cancelInvoiceForOrder(
  mainDb: Db,
  kvInvoiceId: number | string | null | undefined
): Promise<boolean> {
  if (kvInvoiceId == null || kvInvoiceId === "") return false;
  return cancelKvInvoice(mainDb, kvInvoiceId);
}

export type EnsureCodKvOrderInput = {
  mainDb: Db;
  customerName: string;
  customerPhone: string;
  address: string;
  orderDetails: ShopOrderDetail[];
  description: string;
  totalPayment: number;
  shippingFee?: number;
};

export type EnsureCodKvOrderResult = {
  kvOrderId: number | string;
  kvOrderCode: string;
};

/** COD lúc đặt: tạo Đặt hàng KV (usingCod, chưa thu — totalPayment=0). */
export async function ensureCodKvOrder(
  opts: EnsureCodKvOrderInput
): Promise<EnsureCodKvOrderResult> {
  const ord = await createKvOrder(opts.mainDb, {
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    address: opts.address,
    orderDetails: opts.orderDetails,
    usingCod: true,
    method: "Cash",
    description: opts.description.slice(0, 500),
    // Chưa thu — giống HĐ awaiting: tiền thu khi giao / tạo HĐ
    totalPayment: 0,
    shippingFee: opts.shippingFee,
  });
  return {
    kvOrderId: ord.kvOrderId,
    kvOrderCode: ord.kvOrderCode,
  };
}

export type EnsureCodDeliveredInvoiceInput = {
  mainDb: Db;
  customerName: string;
  customerPhone: string;
  address: string;
  orderDetails: ShopOrderDetail[];
  description: string;
  totalPayment: number;
  shippingFee?: number;
  /** Id Đặt hàng KV để gắn HĐ (nếu có). */
  kvOrderId?: number | string | null;
  existingInvoiceId?: number | string | null;
  existingInvoiceCode?: string | null;
};

/** COD giao xong: tạo HĐ KV đã thu (usingCod) + gắn orderId nếu có. */
export async function ensureCodDeliveredInvoice(
  opts: EnsureCodDeliveredInvoiceInput
): Promise<EnsurePaidInvoiceResult> {
  const existingId = opts.existingInvoiceId;
  if (existingId != null && existingId !== "") {
    return {
      kvInvoiceId: existingId,
      kvInvoiceCode: String(opts.existingInvoiceCode || existingId),
    };
  }

  const amount = Math.max(0, Math.round(Number(opts.totalPayment) || 0));
  const inv = await createKvInvoice(opts.mainDb, {
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    address: opts.address,
    orderDetails: opts.orderDetails,
    usingCod: true,
    method: "Cash",
    description: opts.description.slice(0, 500),
    totalPayment: amount,
    shippingFee: opts.shippingFee,
    awaitingBankTransfer: false,
    orderId:
      opts.kvOrderId != null && opts.kvOrderId !== ""
        ? opts.kvOrderId
        : undefined,
  });

  return {
    kvInvoiceId: inv.kvInvoiceId,
    kvInvoiceCode: inv.kvInvoiceCode,
  };
}
