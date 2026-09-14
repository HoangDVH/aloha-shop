/** Trạng thái thanh toán — tách khỏi orderStatus (fulfillment). */
export type ShopPaymentStatus =
  | "unpaid"
  | "processing"
  | "paid"
  | "underpaid"
  | "expired"
  | "cancelled"
  | "failed"
  | "cod";

/** Trạng thái xử lý đơn — không dùng chung enum với payment. */
export type ShopOrderStatus =
  | "cho_thanh_toan"
  | "cho_xu_ly"
  | "dang_giao"
  | "hoan_thanh"
  | "huy"
  | "thieu_hang";

export function transferTtlMinutes(): number {
  const n = Number(process.env.SHOP_TRANSFER_TTL_MIN || 10);
  return Number.isFinite(n) && n > 0 ? Math.min(24 * 60, Math.floor(n)) : 10;
}

/** Mã CK duy nhất cho SePay / VietQR addInfo. */
export function buildPaymentCode(orderCode: string): string {
  const raw = String(orderCode || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  // ALH + phần cuối mã đơn (bỏ WEB prefix nếu có) — đủ ngắn cho nội dung CK
  const body = raw.replace(/^WEB/, "").slice(-14) || raw.slice(-14);
  return `ALH${body}`.slice(0, 25);
}

export function normalizePaymentCodeFromContent(raw: string): string | null {
  const up = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ");
  const m = up.match(/\b(ALH[A-Z0-9]{4,20})\b/);
  return m?.[1] || null;
}
