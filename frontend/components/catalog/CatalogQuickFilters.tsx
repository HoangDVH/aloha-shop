"use client";
import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CatalogChipRow } from "./CatalogChipRow";
import { PRICE_PRESETS } from "./catalogLayoutUtils";

export const BADGE_TABS = [
  { value: "badge:noi_bat", label: "Nổi bật" },
  { value: "badge:moi", label: "Mới" },
  { value: "badge:ban_chay_sap_het", label: "Bán chạy" },
  { value: "badge:giam_gia", label: "Giảm giá" },
];

type Props = {
  minPrice: string; maxPrice: string; filterCount: number;
  sort: string | null;
  onSortChange: (value: string) => void;
  onPriceChange: (min: string, max: string | null) => void;
  onOpenFilters: () => void;
  navigation?: (controls: ReactNode) => ReactNode;
  results?: ReactNode;
  badgeCounts?: Partial<Record<string, number>>;
  priceSort?: string;
  onPriceSortChange?: (value: string) => void;
  sortOptions?: ReadonlyArray<{ value: string; label: string }>;
};
export function CatalogQuickFilters({ minPrice, maxPrice, filterCount, sort, onSortChange, onPriceChange, onOpenFilters, navigation, results, badgeCounts = {}, priceSort = "ban_chay", onPriceSortChange, sortOptions = BADGE_TABS }: Props) {
  const presetIndex = PRICE_PRESETS.findIndex(p => Number(minPrice || 0) === p.min && (p.max === 0 ? !maxPrice : Number(maxPrice) === p.max));
  const priceValue = !minPrice && !maxPrice ? "all" : presetIndex >= 0 ? String(presetIndex) : "custom-current";
  const priceClass = (active: boolean) => `inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-semibold sm:text-sm ${active ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light,#eef7ed)] text-[var(--aloha-green)]" : "border-stone-200 bg-white text-stone-700 hover:border-[var(--aloha-green)]"}`;
  const controls = <>
    <button type="button" onClick={onOpenFilters} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--aloha-green)] px-3 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)]">
      <SlidersHorizontal size={16} />Lọc{filterCount > 0 ? ` (${filterCount})` : ""}
    </button>
    <>
      <button type="button" data-price="all" aria-pressed={priceValue === "all"} className={priceClass(priceValue === "all")} onClick={() => onPriceChange("", null)}>Tất cả giá</button>
      {PRICE_PRESETS.map((p, i) => <button key={p.label} type="button" data-price={String(i)} data-always-visible={priceValue === String(i)} aria-pressed={priceValue === String(i)} className={priceClass(priceValue === String(i))}
        onClick={() => priceValue === String(i) ? onPriceChange("", null) : onPriceChange(String(p.min), p.max > 0 ? String(p.max) : null)}>{p.label}</button>)}
      <button type="button" data-price="custom" data-always-visible={priceValue === "custom-current"} aria-pressed={priceValue === "custom-current"} className={priceClass(priceValue === "custom-current")} onClick={onOpenFilters}>
        {priceValue === "custom-current" ? `${Number(minPrice || 0).toLocaleString("vi-VN")} – ${maxPrice ? `${Number(maxPrice).toLocaleString("vi-VN")}đ` : "Không giới hạn"}` : "Nhập giá"}
      </button>
    </>
  </>;
  return (
    <section aria-label="Lọc và sắp xếp sản phẩm" className="min-w-0 space-y-2 rounded-xl border border-[var(--aloha-line)] bg-white p-2 sm:p-3">
      {navigation ? navigation(controls) : <CatalogChipRow leading={1}>{controls}{results}</CatalogChipRow>}
      <div role="group" aria-label="Lọc theo nhãn sản phẩm" className="flex w-full items-center gap-4 overflow-x-auto whitespace-nowrap border-t border-stone-100 pt-1">
        {sortOptions.map(o => <button key={o.value} type="button" data-badge={o.value.slice(6)} aria-pressed={sort === o.value} disabled={badgeCounts[o.value.slice(6)] === 0 && sort !== o.value}
          onClick={() => onSortChange(sort === o.value ? "ban_chay" : o.value)}
          className={`min-h-11 shrink-0 px-2 text-xs sm:text-sm disabled:cursor-not-allowed disabled:opacity-40 ${sort === o.value ? "font-bold text-[var(--aloha-green)]" : "font-medium text-stone-600"}`}>
          {o.label}{badgeCounts[o.value.slice(6)] !== undefined ? ` (${badgeCounts[o.value.slice(6)]})` : ""}
        </button>)}
      </div>
      {onPriceSortChange ? <label className="flex items-center gap-2 border-t border-stone-100 pt-2 text-xs text-stone-600 sm:text-sm">
        <span>Sắp xếp giá</span>
        <select aria-label="Sắp xếp giá" value={priceSort.startsWith("price_") ? priceSort : "ban_chay"} onChange={e => onPriceSortChange(e.target.value)} className="min-h-11 min-w-0 rounded-lg border border-stone-200 bg-white px-2">
          <option value="ban_chay">Mặc định</option>
          <option value="price_asc">Giá thấp → cao</option>
          <option value="price_desc">Giá cao → thấp</option>
        </select>
      </label> : null}
    </section>
  );
}
