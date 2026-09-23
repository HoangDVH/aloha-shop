export type PriceMode = "web" | "si";
export type SiRegion = "HCM" | "TINH";
export const SI_TERMS_VERSION = "2026-09-23";

export function isActiveWholesale(account: any): boolean {
  return account?.active !== false && Array.isArray(account?.roles) &&
    account.roles.includes("si") && account.siStatus === "active";
}

export function wholesaleMinimum(region: unknown): number {
  if (region !== "TINH") return 0;
  const configured = Number(process.env.SHOP_SI_TINH_MIN_ORDER || 2000000);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 2000000;
}

export function normalizeWholesalePhone(raw: unknown): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
}

export function stockAllocation(quantity: number, available: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
    throw new Error("Số lượng phải từ 1 đến 10.000");
  }
  const ready = Number.isFinite(available) ? Math.max(0, Math.floor(available)) : 0;
  const availableQty = Math.min(quantity, ready);
  return { requestedQty: quantity, availableQty, pendingQty: quantity - availableQty,
    preOrder: quantity > ready, reason: ready === 0 ? "out_of_stock" : "low_stock" };
}
