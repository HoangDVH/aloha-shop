import type { Db } from "mongodb";
import { randomBytes } from "crypto";

export const SHOP_ORDERS = "aloha_shop_orders";

export type PaymentStatus =
  | "unpaid"
  | "processing"
  | "paid"
  | "underpaid"
  | "expired"
  | "cancelled"
  | "failed"
  | "cod";

export type OrderStatus =
  | "cho_thanh_toan"
  | "cho_xu_ly"
  | "dang_giao"
  | "hoan_thanh"
  | "huy"
  | "thieu_hang";

export type ShopAddress = {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  district?: string;
  ward: string;
  detail: string;
  ghnProvinceId?: number;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  label?: string;
  isDefault: boolean;
};

export type ShopOrderDetail = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
  note?: string;
  /** Biến thể (màu/size/đvt) — gắn vào tên khi lưu đơn */
  variantLabel?: string;
  imageUrl?: string;
  ctvCode?: string;
};

export function newAddressId(): string {
  return `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newShopOrderCode(): string {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WEB-${y}${m}${day}-${r}`;
}

/** Mã CK random độc lập mã đơn (đủ dài, khó đoán). */
export function newPaymentCode(_orderCode?: string): string {
  return `ALH${randomBytes(10).toString("hex").toUpperCase()}`.slice(0, 25);
}

/** Mã CK mới khi gia hạn QR. */
export function renewPaymentCode(_orderCode?: string): string {
  return newPaymentCode().slice(0, 25);
}

export function normalizePaymentCode(raw: unknown): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Mã CK cũ (ALH…) — tương thích SePay / đơn chưa có HĐ KV. */
export function extractPaymentCodeFromContent(content: string, codeField?: string): string {
  const refs = extractSepayOrderRefs(content, codeField);
  return refs.paymentCodes[0] || "";
}

/**
 * Trích mã đơn từ nội dung CK SePay / ngân hàng.
 * Ưu tiên: ALH… (paymentCode) · HD… (HĐ KV trên QR) · WEB-… (mã đơn shop).
 */
export function extractSepayOrderRefs(
  content: string,
  codeField?: string
): {
  paymentCodes: string[];
  kvInvoiceCodes: string[];
  orderCodes: string[];
} {
  const paymentCodes: string[] = [];
  const kvInvoiceCodes: string[] = [];
  const orderCodes: string[] = [];
  const seenPay = new Set<string>();
  const seenHd = new Set<string>();
  const seenWeb = new Set<string>();

  const pushPay = (raw: string) => {
    const n = normalizePaymentCode(raw);
    if (n.startsWith("ALH") && n.length >= 6 && !seenPay.has(n)) {
      seenPay.add(n);
      paymentCodes.push(n);
    }
  };
  const pushHd = (raw: string) => {
    const n = normalizePaymentCode(raw);
    if (/^HD\d{5,12}$/.test(n) && !seenHd.has(n)) {
      seenHd.add(n);
      kvInvoiceCodes.push(n);
    }
  };
  const pushWeb = (raw: string) => {
    const compact = normalizePaymentCode(raw); // WEB260907XXXX
    const mm = compact.match(/^WEB(\d{6})([A-Z0-9]{3,8})$/);
    if (!mm) return;
    const fixed = `WEB-${mm[1]}-${mm[2]}`;
    if (!seenWeb.has(fixed)) {
      seenWeb.add(fixed);
      orderCodes.push(fixed);
    }
  };

  if (codeField) {
    pushPay(String(codeField));
    pushHd(String(codeField));
    pushWeb(String(codeField));
  }
  const text = String(content || "").toUpperCase();
  for (const m of text.matchAll(/\bALH[A-Z0-9]{4,22}\b/g)) pushPay(m[0]);
  for (const m of text.matchAll(/\bHD\d{5,12}\b/g)) pushHd(m[0]);
  for (const m of text.matchAll(/\bWEB-?\d{6}-[A-Z0-9]{3,8}\b/g)) pushWeb(m[0]);

  return { paymentCodes, kvInvoiceCodes, orderCodes };
}

export function transferTtlMinutes(): number {
  const n = Number(process.env.SHOP_TRANSFER_TTL_MIN || 10);
  return Number.isFinite(n) && n > 0 ? Math.min(24 * 60, Math.floor(n)) : 10;
}

export function normalizeAddresses(raw: unknown): ShopAddress[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any) => ({
      id: String(a?.id || "").trim(),
      fullName: String(a?.fullName || "").trim(),
      phone: String(a?.phone || "").trim(),
      province: String(a?.province || "").trim(),
      district: a?.district ? String(a.district).trim() : undefined,
      ward: String(a?.ward || "").trim(),
      detail: String(a?.detail || "").trim(),
      ghnProvinceId: Number(a?.ghnProvinceId) || undefined,
      ghnDistrictId: Number(a?.ghnDistrictId) || undefined,
      ghnWardCode: a?.ghnWardCode ? String(a.ghnWardCode).trim() : undefined,
      label: a?.label ? String(a.label).trim() : undefined,
      isDefault: Boolean(a?.isDefault),
    }))
    .filter((a) => a.id && a.fullName && a.phone);
}

export function ensureOneDefault(list: ShopAddress[]): ShopAddress[] {
  if (!list.length) return list;
  const has = list.some((a) => a.isDefault);
  if (has) {
    let seen = false;
    return list.map((a) => {
      if (!a.isDefault) return { ...a, isDefault: false };
      if (seen) return { ...a, isDefault: false };
      seen = true;
      return { ...a, isDefault: true };
    });
  }
  return list.map((a, i) => ({ ...a, isDefault: i === 0 }));
}

export async function ensureShopOrderIndexes(db: Db) {
  try {
    await Promise.all([
      db.collection(SHOP_ORDERS).createIndex({ code: 1 }, { unique: true, background: true }),
      db.collection(SHOP_ORDERS).createIndex({ shopAccountId: 1, createdAt: -1 }, { background: true }),
      db.collection(SHOP_ORDERS).createIndex({ createdAt: -1 }, { background: true }),
      db.collection(SHOP_ORDERS).createIndex({ kvOrderId: 1 }, { sparse: true, background: true }),
      db.collection(SHOP_ORDERS).createIndex({ ctvCodes: 1 }, { sparse: true, background: true }),
      db
        .collection(SHOP_ORDERS)
        .createIndex({ paymentCode: 1 }, { unique: true, sparse: true, background: true }),
      db
        .collection(SHOP_ORDERS)
        .createIndex({ sepayTransactionId: 1 }, { unique: true, sparse: true, background: true }),
      db
        .collection(SHOP_ORDERS)
        .createIndex({ kvInvoiceCode: 1 }, { sparse: true, background: true }),
      db
        .collection(SHOP_ORDERS)
        .createIndex({ paymentStatus: 1, expiresAt: 1 }, { sparse: true, background: true }),
      db
        .collection(SHOP_ORDERS)
        .createIndex({ legacyCodes: 1 }, { sparse: true, background: true }),
      db
        .collection(SHOP_ORDERS)
        .createIndex({ kvOrderCode: 1 }, { sparse: true, background: true }),
    ]);
  } catch (e) {
    console.warn("[shopOrders] ensureShopOrderIndexes:", e);
  }
}
