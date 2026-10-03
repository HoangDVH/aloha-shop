/** Các tab của trang /uu-dai — URL chuẩn `/uu-dai?tab=<id>`. */
export const DEALS_TAB_IDS = ["voucher", "flash-sale", "deal-hot", "qua-tang", "san-pham", "the-le"] as const;
export type DealsTabId = (typeof DEALS_TAB_IDS)[number];

const ALIASES: Record<string, DealsTabId> = {
  qua: "qua-tang",
  gift: "qua-tang",
  flash: "flash-sale",
  flashsale: "flash-sale",
  deal: "deal-hot",
  "san-pham-chuong-trinh": "san-pham",
  rules: "the-le",
};

export function toDealsTab(raw: string | null | undefined): DealsTabId | null {
  const k = String(raw || "").trim().replace(/^#/, "").toLowerCase();
  if (!k) return null;
  if ((DEALS_TAB_IDS as readonly string[]).includes(k)) return k as DealsTabId;
  return ALIASES[k] || null;
}

/**
 * Link chiến dịch đã lưu dạng `/uu-dai#voucher` → `/uu-dai?tab=voucher`
 * (đổi hash cùng trang không báo cho React nên tab sẽ không chuyển).
 */
export function dealsHref(href: string): string;
export function dealsHref(href: string | undefined): string | undefined;
export function dealsHref(href: string | undefined): string | undefined {
  if (!href) return href;
  const m = /^\/uu-dai\/?(\?[^#]*)?#(.+)$/.exec(href.trim());
  if (!m) return href;
  const tab = toDealsTab(m[2]);
  if (!tab) return href;
  const params = new URLSearchParams((m[1] || "").replace(/^\?/, ""));
  params.set("tab", tab);
  return `/uu-dai?${params.toString()}`;
}
