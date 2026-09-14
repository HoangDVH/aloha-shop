/**
 * Flag server khớp shop checkoutFlags.
 * SHOP_ALLOW_TRANSFER=1 → cho phép method Transfer.
 * SHOP_REQUIRE_SHIPPING_QUOTE=1 → bắt quoteToken khi giao tận nơi.
 * Mặc định cả hai tắt (phase chỉ COD, ship fee = 0).
 */

function envOn(name: string, defaultOn = false): boolean {
  const v = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  if (!v) return defaultOn;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function shopAllowTransferPayment(): boolean {
  return envOn("SHOP_ALLOW_TRANSFER", true);
}

export function shopRequireShippingQuote(): boolean {
  return envOn("SHOP_REQUIRE_SHIPPING_QUOTE", false);
}
