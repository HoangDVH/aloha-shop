"use client";
import { GiftFilterSection } from "./GiftFilterSection";

import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { ShopFacets } from "@/lib/api";
import { normPath } from "./catalogLayoutUtils";
import type { DraftState } from "./draft";
import { CatalogFilterPanel } from "./CatalogFilterPanel";

export function CatalogFilterModal({
  open,
  onClose,
  activeDraft,
  setDraft,
  facets,
  facetsLoading,
  filterNhoms,
  effectiveCategoryIds,
  categoryLocked,
  nhomTitle,
  q,
  homeMode,
  allProductsPage,
  clearDraftSecondary,
  onCommit,
  draftTotalLoading,
  draftTotal,
  scoped = false,
}: {
  open: boolean;
  onClose: () => void;
  activeDraft: DraftState | null;
  setDraft: React.Dispatch<React.SetStateAction<DraftState | null>>;
  facets: ShopFacets;
  facetsLoading: boolean;
  filterNhoms: string[];
  effectiveCategoryIds: number[];
  categoryLocked: boolean;
  nhomTitle: string;
  q: string;
  homeMode: boolean;
  allProductsPage: boolean;
  clearDraftSecondary: () => void;
  onCommit: () => void;
  draftTotalLoading: boolean;
  draftTotal: number | null;
  scoped?: boolean;
}) {
  if (!open) return null;

  const attrMap = facets.attributes || {};

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
        aria-label="Đóng bộ lọc"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-filter-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--aloha-line)] px-4 py-3">
          <h2
            id="catalog-filter-title"
            className="inline-flex items-center gap-2 text-base font-extrabold text-[var(--aloha-ink)]"
          >
            <SlidersHorizontal size={18} className="text-[var(--aloha-green)]" />
            Bộ lọc
          </h2>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--aloha-cream)]"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {activeDraft ? (
            <>
            {!scoped ? <GiftFilterSection value={activeDraft.gift} onChange={gift => setDraft(d => d ? { ...d, gift } : d)} onNavigate={onClose} /> : null}
            <CatalogFilterPanel
              embedded
              hideCategory={scoped}
              hideClearButton
              selectedNhoms={categoryLocked ? filterNhoms : activeDraft.nhoms}
              onNhomsChange={(paths) => {
                if (categoryLocked) return;
                setDraft((d) => (d ? { ...d, nhoms: paths.map(normPath).filter(Boolean), attrs: [], dvts: [] } : d));
              }}
              dvtItems={facets.dvt}
              selectedDvts={activeDraft.dvts}
              onToggleDvt={(k) =>
                setDraft((d) => {
                  if (!d) return d;
                  const has = d.dvts.includes(k);
                  return { ...d, dvts: has ? d.dvts.filter((x) => x !== k) : [...d.dvts, k] };
                })
              }
              attributes={attrMap}
              selectedAttrs={activeDraft.attrs}
              onToggleAttr={(token) =>
                setDraft((d) => {
                  if (!d) return d;
                  const has = d.attrs.includes(token);
                  return { ...d, attrs: has ? d.attrs.filter((x) => x !== token) : [...d.attrs, token] };
                })
              }
              facetsLoading={facetsLoading}
              q={q}
              homeMode={homeMode}
              allProductsPage={allProductsPage}
              hasCategoryScope={effectiveCategoryIds.length > 0 || categoryLocked}
              lockCategory={categoryLocked}
              categoryIds={effectiveCategoryIds}
              categoryLockLabel={nhomTitle ? `Danh mục: ${nhomTitle}` : "Đang lọc trong danh mục này"}
              minPrice={activeDraft.minPrice}
              maxPrice={activeDraft.maxPrice}
              onPricePreset={(min, max) =>
                setDraft((d) => (d ? { ...d, minPrice: min, maxPrice: max || "" } : d))
              }
              onMinPriceBlur={(v) => setDraft((d) => (d ? { ...d, minPrice: v || "" } : d))}
              onMaxPriceBlur={(v) => setDraft((d) => (d ? { ...d, maxPrice: v || "" } : d))}
              onClearFilters={clearDraftSecondary}
              onClose={onClose}
            />
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-[var(--aloha-line)] bg-white px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={clearDraftSecondary}
            className="min-h-11 flex-1 rounded-full border border-[var(--aloha-line)] text-sm font-bold text-slate-600 transition hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)]"
          >
            Bỏ chọn
          </button>
          <button
            type="button"
            onClick={onCommit}
            className="min-h-11 flex-[1.4] rounded-full bg-[var(--aloha-green)] text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green-hover)]"
          >
            {draftTotalLoading
              ? "Đang đếm…"
              : draftTotal != null
                ? `Xem ${draftTotal} kết quả`
                : "Xem kết quả"}
          </button>
        </div>
      </div>
    </div>
  );
}
