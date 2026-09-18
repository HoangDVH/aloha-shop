/**
 * Flag checkout phase COD-only.
 * Bật lại: NEXT_PUBLIC_SHOP_SHOW_TRANSFER=1 và/hoặc NEXT_PUBLIC_SHOP_SHOW_CHECKOUT_SHIPPING=1
 * Không xóa UI/code — chỉ ẩn.
 */

function envOn(name: string, defaultOn = false): boolean {
  const v = String(
    (typeof process !== "undefined" && process.env[name]) || ""
  )
    .trim()
    .toLowerCase();
  if (!v) return defaultOn;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Hiện chọn CK/QR trên checkout. Mặc định bật. */
export function shopShowTransferPayment(): boolean {
  return envOn("NEXT_PUBLIC_SHOP_SHOW_TRANSFER", true);
}

/** Hiện khối vận chuyển + phí ship. Mặc định tắt (theo yêu cầu phase hiện tại). */
export function shopShowCheckoutShipping(): boolean {
  return envOn("NEXT_PUBLIC_SHOP_SHOW_CHECKOUT_SHIPPING", false);
}

/**
 * Ngưỡng COD cho đơn có SP đặt trước (VND).
 * ≤ ngưỡng → cho COD; vượt → bắt CK. 0 = không giới hạn.
 * NEXT_PUBLIC_SHOP_PREORDER_COD_MAX_VND (mặc định 1_000_000).
 */
export function shopPreOrderCodMaxVnd(): number {
  const raw = String(
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_SHOP_PREORDER_COD_MAX_VND) ||
      ""
  ).trim();
  if (raw === "") return 1_000_000;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 1_000_000;
  return n;
}

export function shopPreOrderRequiresTransfer(totalVnd: number): boolean {
  const max = shopPreOrderCodMaxVnd();
  if (max <= 0) return false;
  return Math.max(0, Math.round(Number(totalVnd) || 0)) > max;
}
