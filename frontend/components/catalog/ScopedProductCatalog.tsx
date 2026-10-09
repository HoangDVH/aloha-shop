"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import type { ShopProduct } from "@/lib/api";
import { useLiveProductPrices } from "@/lib/useLiveProductPrices";
import { ProductGrid } from "@/components/ProductCard";
import { CatalogChipRow } from "./CatalogChipRow";
import { BADGE_TABS, CatalogQuickFilters } from "./CatalogQuickFilters";
import { CatalogFilterModal } from "./CatalogFilterModal";
import type { DraftState } from "./draft";
import { emptyScopedFilters, filterScopedGroups, filterScopedProducts, scopedProductFacets, type ScopedFilters } from "./scopedProductFilters";

/** A complete, bounded collection: filter before pagination and never leave its page. */
export function ScopedProductCatalog({ products, columns = 4, variant = "default", pageSize = 20, initialMinPrice = "", initialMaxPrice = "" }: {
  products: ShopProduct[]; columns?: 4 | 5 | 6; variant?: "default" | "deal"; pageSize?: number;
  initialMinPrice?: string; initialMaxPrice?: string;
}) {
  const live = useLiveProductPrices(products);
  const current = useMemo(() => products.map(p => {
    const row = live[p.ma.toUpperCase()];
    return row ? { ...p, ...row, campaignPromo: row.campaignPromo === undefined ? p.campaignPromo : row.campaignPromo } : p;
  }), [products, live]);
  const [filters, setFilters] = useState<ScopedFilters>(() => ({ ...emptyScopedFilters(), minPrice: initialMinPrice, maxPrice: initialMaxPrice }));
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const groups = useMemo(() => [...new Set(current.map(p => p.nhom).filter(Boolean))], [current]);
  const scoped = useMemo(() => filterScopedGroups(current, selectedGroups), [current, selectedGroups]);
  const [badge, setBadge] = useState("ban_chay");
  const [sort, setSort] = useState("ban_chay");
  const [shown, setShown] = useState(pageSize);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const facets = useMemo(() => scopedProductFacets(current), [current]);
  const matched = useMemo(() => filterScopedProducts(filterScopedProducts(scoped, filters, badge), emptyScopedFilters(), sort), [scoped, filters, badge, sort]);
  const badgeCounts = useMemo(() => Object.fromEntries(["noi_bat", "moi", "ban_chay_sap_het", "giam_gia"].map(value => [value, filterScopedProducts(scoped, filters, "badge:" + value).length])), [scoped, filters]);
  const preview = draft ? filterScopedProducts(scoped, draft, badge).length : null;
  const count = filters.attrs.length + filters.dvts.length + Number(Boolean(filters.minPrice || filters.maxPrice));
  const update = (next: ScopedFilters) => { setFilters(next); setShown(pageSize); };
  const chips = [
    ...(badge.startsWith("badge:") ? [{ key: "badge", label: BADGE_TABS.find(tab => tab.value === badge)?.label || badge, remove: () => { setBadge("ban_chay"); setShown(pageSize); } }] : []),
    ...(filters.minPrice || filters.maxPrice ? [{ key: "price", label: `Giá ${Number(filters.minPrice || 0).toLocaleString("vi-VN")}đ – ${filters.maxPrice ? `${Number(filters.maxPrice).toLocaleString("vi-VN")}đ` : "Không giới hạn"}`, remove: () => update({ ...filters, minPrice: "", maxPrice: "" }) }] : []),
    ...filters.dvts.map(d => ({ key: `dvt:${d}`, label: d, remove: () => update({ ...filters, dvts: filters.dvts.filter(v => v !== d) }) })),
    ...filters.attrs.map(a => ({ key: a, label: a, remove: () => update({ ...filters, attrs: filters.attrs.filter(v => v !== a) }) })),
  ];
  const themeStyle = variant === "deal" ? {
    "--aloha-green": "var(--campaign-primary, #C8102E)",
    "--aloha-green-hover": "color-mix(in srgb, var(--campaign-primary, #C8102E) 85%, black)",
  } as CSSProperties : undefined;
  return <div className="space-y-3" style={themeStyle}>
    <CatalogQuickFilters minPrice={filters.minPrice} maxPrice={filters.maxPrice} filterCount={count + Number(badge.startsWith("badge:"))} sort={badge} badgeCounts={badgeCounts} priceSort={sort} onPriceSortChange={v => { setSort(v); setShown(pageSize); }}
      onSortChange={v => { setBadge(v); setShown(pageSize); }}
      onPriceChange={(minPrice, maxPrice) => update({ ...filters, minPrice, maxPrice: maxPrice || "" })}
      onOpenFilters={() => setDraft({ ...filters, nhoms: [], gift: "" })}
      navigation={controls => <div className="min-w-0 space-y-2">
        <CatalogChipRow leading={1}>
          {controls}
          {selectedGroups.map(g => <button key={g} type="button" data-always-visible className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-stone-100 px-3 text-xs" onClick={() => { setSelectedGroups(v => v.filter(x => x !== g)); setShown(pageSize); }}>{g}<X size={14} /></button>)}
      {chips.map(c => <button key={c.key} type="button" onClick={c.remove} data-always-visible aria-label={`Bỏ lọc ${c.label}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3">{c.label}<X size={14} /></button>)}

          {!selectedGroups.length && !count && !badge.startsWith("badge:") ? groups.map(g => <button key={g} type="button" className="h-11 shrink-0 rounded-md border border-stone-200 px-3 text-xs" onClick={() => { setSelectedGroups([g]); setShown(pageSize); }}>{g}</button>) : null}
          {selectedGroups.length || count || badge.startsWith("badge:") ? <button type="button" data-always-visible className="h-11 shrink-0 px-2 text-sm text-[var(--aloha-green)]" onClick={() => { setSelectedGroups([]); setBadge("ban_chay"); update(emptyScopedFilters()); }}>Xóa tất cả</button> : null}
        </CatalogChipRow>
        {selectedGroups.length > 0 ? <CatalogChipRow>
          {groups.map(g => <button key={g} type="button" aria-pressed={selectedGroups.includes(g)} className={`h-11 shrink-0 rounded-md border px-3 text-xs ${selectedGroups.includes(g) ? "border-[var(--aloha-green)] text-[var(--aloha-green)]" : "border-stone-200"}`} onClick={() => { setSelectedGroups(v => v.includes(g) ? v.filter(x => x !== g) : [...v, g]); setShown(pageSize); }}>{g}</button>)}
        </CatalogChipRow> : null}
      </div>} />
    <p className="text-sm text-stone-500">{matched.length} sản phẩm</p>
    {matched.length ? <ProductGrid products={matched.slice(0, shown)} shopee columns={columns} variant={variant} /> : <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-600">Không có sản phẩm phù hợp. Hãy đổi khoảng giá hoặc bỏ bớt bộ lọc.</p>}
    {!matched.length ? <div className="flex flex-wrap gap-2">
      {badge.startsWith("badge:") ? <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => { setBadge("ban_chay"); setShown(pageSize); }}>Bỏ lọc nhãn</button> : null}
      {filters.minPrice || filters.maxPrice ? <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => update({ ...filters, minPrice: "", maxPrice: "" })}>Bỏ lọc giá</button> : null}
    </div> : null}
    {shown < matched.length ? <div className="flex justify-center"><button type="button" onClick={() => setShown(n => n + pageSize)} className="min-h-11 rounded-full border border-[var(--aloha-green)] bg-white px-6 text-sm font-bold text-[var(--aloha-green)]">Xem thêm {Math.min(pageSize, matched.length - shown)} sản phẩm</button></div> : null}
    <CatalogFilterModal scoped open={draft !== null} onClose={() => setDraft(null)} activeDraft={draft} setDraft={setDraft}
      facets={facets} facetsLoading={false} filterNhoms={[]} effectiveCategoryIds={[]} categoryLocked nhomTitle="" q="" homeMode={false} allProductsPage={false}
      clearDraftSecondary={() => setDraft({ ...emptyScopedFilters(), nhoms: [], gift: "" })}
      onCommit={() => { if (draft) update({ minPrice: draft.minPrice, maxPrice: draft.maxPrice, attrs: draft.attrs, dvts: draft.dvts }); setDraft(null); }}
      draftTotalLoading={false} draftTotal={preview} />
  </div>;
}
