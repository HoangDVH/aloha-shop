"use client";

import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { CatalogSubcatBar } from "./CatalogSubcatBar";
import { CatalogSortBar } from "./CatalogSortBar";

export function CatalogToolbar({
  filtersOnly,
  categoryLocked,
  allProductsPage,
  effectiveCategoryIds,
  activeFilters,
  secondaryFilterCount,
  onOpenFilterModal,
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
  sort: string | null;
  priceMenuOpen: boolean;
  onSortClick: (key: string) => void;
  onSelectPriceSort: (sortValue: "price_asc" | "price_desc") => void;
}) {
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
          Lọc
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
                    className="inline-flex h-9 max-w-[200px] shrink-0 items-center gap-1.5 truncate rounded-md border border-[var(--aloha-line)] bg-white px-2.5 text-xs font-semibold text-slate-700"
                  >
                    <span className="truncate">{t.label}</span>
                    <X size={14} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </>
            ) : null
          }
          filterButton={
            <button
              type="button"
              onClick={onOpenFilterModal}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-bold transition ${
                secondaryFilterCount > 0
                  ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)] text-[var(--aloha-green)]"
                  : "rounded-xl border-stone-200 bg-white text-stone-700 hover:bg-stone-50 sm:rounded-md sm:border-[var(--aloha-green)] sm:text-[var(--aloha-green)]"
              }`}
            >
              <span className="relative">
                <SlidersHorizontal size={16} />
                {secondaryFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-500" />
                ) : null}
              </span>
              Lọc
            </button>
          }
        />
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenFilterModal}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-bold transition ${
              secondaryFilterCount > 0
                ? "border-[var(--aloha-green)] bg-[var(--aloha-green)] text-white"
                : "rounded-xl border-stone-200 bg-white text-stone-700 hover:bg-stone-50 sm:rounded-md sm:border-[var(--aloha-green)] sm:text-[var(--aloha-green)]"
            }`}
          >
            <SlidersHorizontal size={16} />
            Lọc
            {secondaryFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-black">
                {secondaryFilterCount}
              </span>
            ) : null}
          </button>
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
          </div>
        </div>
      )}

      <CatalogSortBar
        sort={sort}
        priceMenuOpen={priceMenuOpen}
        onSortClick={onSortClick}
        onSelectPriceSort={onSelectPriceSort}
      />
    </div>
  );
}
