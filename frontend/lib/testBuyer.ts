/** Email được mua SP giá 0đ (test) — khớp backend SHOP_TEST_BUYER_EMAILS. */
const DEFAULT_TEST_BUYERS = ["dauvuhoang01@gmail.com"];

export function shopTestBuyerEmails(): string[] {
  const raw = String(
    process.env.NEXT_PUBLIC_SHOP_TEST_BUYER_EMAILS || ""
  ).trim();
  const fromEnv = raw
    ? raw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    : [];
  return [...new Set(fromEnv.length ? fromEnv : DEFAULT_TEST_BUYERS)];
}

export function isShopTestBuyer(email?: string | null): boolean {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  return Boolean(e && shopTestBuyerEmails().includes(e));
}

/** SP giá 0đ chỉ test buyer mua được. */
export function canPurchaseZeroPrice(email?: string | null): boolean {
  return isShopTestBuyer(email);
}
