/** Bộ lọc lưới SP trang tổng quan ưu đãi — URL `/uu-dai?loc=<id>`. */
export const DEALS_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "flash", label: "⚡ Flash Sale" },
  { id: "deal-hot", label: "Deal hot" },
  { id: "qua-tang", label: "Quà tặng 0đ" },
  { id: "duoi-300k", label: "Dưới 300K" },
  { id: "300-500k", label: "300–500K" },
  { id: "tren-500k", label: "Trên 500K" },
] as const;

export type DealsFilterId = (typeof DEALS_FILTERS)[number]["id"];

export type DealsFilterItem = {
  ma: string;
  dealHot: boolean;
  hasGift: boolean;
  price: number;
  slotKey?: string | null;
};

export function toDealsFilter(raw: string | null | undefined): DealsFilterId {
  const k = String(raw || "").trim().toLowerCase();
  if (k === "flash-sale" || k === "flash") return "flash";
  return (DEALS_FILTERS.find((f) => f.id === k)?.id ?? "all") as DealsFilterId;
}

export function matchesDealsFilter(
  item: DealsFilterItem,
  id: DealsFilterId,
  activeSlotKey?: string | null
): boolean {
  switch (id) {
    case "flash":
      return activeSlotKey ? item.slotKey === activeSlotKey || !item.slotKey : Boolean(item.slotKey || item.dealHot);
    case "deal-hot":
      return item.dealHot;
    case "qua-tang":
      return item.hasGift;
    case "duoi-300k":
      return item.price > 0 && item.price < 300_000;
    case "300-500k":
      return item.price >= 300_000 && item.price <= 500_000;
    case "tren-500k":
      return item.price > 500_000;
    default:
      return true;
  }
}

export function countDealsFilters(
  items: DealsFilterItem[],
  activeSlotKey?: string | null
): Record<DealsFilterId, number> {
  const out = Object.fromEntries(DEALS_FILTERS.map((f) => [f.id, 0])) as Record<DealsFilterId, number>;
  for (const it of items) {
    for (const f of DEALS_FILTERS) {
      if (matchesDealsFilter(it, f.id, activeSlotKey)) out[f.id]++;
    }
  }
  return out;
}
