"use client";

import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { CatalogSubcatBar } from "./CatalogSubcatBar";

export function CatalogToolbar({
  filtersOnly,
  categoryLocked,
  allProductsPage,
  effectiveCategoryIds,
  activeFilters,
  secondaryFilterCount,
  onOpenFilterModal,
  onClearFilters,
  sort,
  priceMenuOpen,
  onSortClick,
  onSelectPriceSort,
}: {
  filtersOnly: boolean;
  categoryLocked: boolean;
  allProductsPage: boolean;
  effectiveCategoryIds: number[];
  activeFilters: Array<{ key: string; label: string; clear: () => void }>;
  secondaryFilterCount: number;
  onOpenFilterModal: () => void;
  onClearFilters: () => void;
  sort: string | null;
  priceMenuOpen: boolean;
  onSortClick: (key: string) => void;
  onSelectPriceSort: (sortValue: "price_asc" | "price_desc") => void;
}) {
  const clearFiltersButton = secondaryFilterCount >= 2 ? (
    <button type="button" onClick={onClearFilters} className="inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-semibold text-[var(--aloha-green)] underline-offset-2 hover:underline">
      Xóa bộ lọc
    </button>
  ) : null;
  if (filtersOnly) {
    return (
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenFilterModal}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3.5 text-sm font-bold transition ${
            secondaryFilterCount > 0
              ? "border-[var(--aloha-green)] bg-[var(--aloha-green)] text-white"
              : "border-[var(--aloha-green)] bg-white text-[var(--aloha-green)]"
          }`}
        >
          <SlidersHorizontal size={16} />
          Tất cả bộ lọc
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {categoryLocked || allProductsPage ? (
        <CatalogSubcatBar
          categoryIds={effectiveCategoryIds}
          showRootL1={allProductsPage}
          filterResultChips={
            activeFilters.length ? (
              <>
                {activeFilters.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={t.clear}
                    className="inline-flex h-10 max-w-[200px] shrink-0 items-center gap-1.5 truncate rounded-md border border-[var(--aloha-line)] bg-white px-2.5 text-xs font-semibold text-slate-700"
                  >
                    <span className="truncate">{t.label}</span>
                    <X size={14} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </>
            ) : null
          }
          filterButton={null /* Trigger is in CatalogQuickFilters. */}
          clearFiltersButton={clearFiltersButton}
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeFilters.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={t.clear}
                className="inline-flex h-10 max-w-[200px] shrink-0 items-center gap-1.5 truncate rounded-md border border-[var(--aloha-line)] bg-white px-3 text-xs font-semibold text-slate-700"
              >
                <span className="truncate">{t.label}</span>
                <X size={14} className="shrink-0 text-slate-400" />
              </button>
            ))}
            {clearFiltersButton}
          </div>
        </div>
      )}

    </div>
  );
}
