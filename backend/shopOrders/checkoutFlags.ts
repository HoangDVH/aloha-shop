/**
 * Flag server khớp shop checkoutFlags.
 * SHOP_ALLOW_TRANSFER=1 → cho phép method Transfer.
 * SHOP_REQUIRE_SHIPPING_QUOTE=1 → bắt quoteToken khi giao tận nơi.
 * Mặc định cả hai tắt (phase chỉ COD, ship fee = 0).
 *
 * SHOP_TEST_BUYER_EMAILS — email được mua SP giá 0đ (test), cách nhau bởi dấu phẩy.
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

const DEFAULT_TEST_BUYER_EMAILS = ["dauvuhoang01@gmail.com"];

/** Email được phép mua sản phẩm giá 0đ (test như sàn TMĐT). */
export function shopTestBuyerEmails(): string[] {
  const raw = String(process.env.SHOP_TEST_BUYER_EMAILS || "").trim();
  const fromEnv = raw
    ? raw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    : [];
  return [...new Set(fromEnv.length ? fromEnv : DEFAULT_TEST_BUYER_EMAILS)];
}

export function isShopTestBuyerEmail(email?: string | null): boolean {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  return Boolean(e && shopTestBuyerEmails().includes(e));
}
