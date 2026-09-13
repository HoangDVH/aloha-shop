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

/** Hiện chọn CK/QR trên checkout. Mặc định tắt (chỉ COD). */
export function shopShowTransferPayment(): boolean {
  return envOn("NEXT_PUBLIC_SHOP_SHOW_TRANSFER", false);
}

/** Hiện khối vận chuyển + phí ship. Mặc định tắt (theo yêu cầu phase hiện tại). */
export function shopShowCheckoutShipping(): boolean {
  return envOn("NEXT_PUBLIC_SHOP_SHOW_CHECKOUT_SHIPPING", false);
}
