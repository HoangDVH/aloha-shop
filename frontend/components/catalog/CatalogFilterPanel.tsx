"use client";

import type { ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import { FilterChipSection } from "@/components/FilterChipSection";
import { PriceRangeFilter } from "@/components/catalog/PriceRangeFilter";
import { CatalogSubcatPicker } from "@/components/catalog/CatalogSubcatBar";

export type CatalogFilterPanelProps = {
  selectedNhoms: string[];
  onNhomsChange: (paths: string[]) => void;
  dvtItems: string[];
  selectedDvts: string[];
  onToggleDvt: (value: string) => void;
  attributes: Record<string, string[]>;
  selectedAttrs: string[];
  onToggleAttr: (token: string) => void;
  facetsLoading: boolean;
  q: string;
  homeMode: boolean;
  allProductsPage?: boolean;
  hasCategoryScope?: boolean;
  lockCategory?: boolean;
  categoryLockLabel?: string;
  /** categoryId đang lọc — hiện L2/L3 trong sheet (TGDĐ) */
  categoryIds?: number[];
  minPrice: string;
  maxPrice: string;
  onPricePreset: (minPrice: string, maxPrice: string | null) => void;
  onMinPriceBlur: (value: string | null) => void;
  onMaxPriceBlur: (value: string | null) => void;
  onClearFilters: () => void;
  onClose?: () => void;
  hideClearButton?: boolean;
  embedded?: boolean;
  hideCategory?: boolean;
  afterCategory?: ReactNode;
};

export function CatalogFilterPanel({
  selectedNhoms,
  onNhomsChange,
  dvtItems,
  selectedDvts,
  onToggleDvt,
  facetsLoading,
  q,
  homeMode,
  allProductsPage = false,
  hasCategoryScope = false,
  lockCategory = false,
  categoryLockLabel = "",
  categoryIds = [],
  minPrice,
  maxPrice,
  onPricePreset,
  onMinPriceBlur: _onMinPriceBlur,
  onMaxPriceBlur: _onMaxPriceBlur,
  onClearFilters,
  onClose,
  hideClearButton = false,
  embedded = false,
  hideCategory = false,
  afterCategory,
}: CatalogFilterPanelProps) {
  const body = (
    <>
      {!embedded ? (
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-base font-extrabold text-[var(--aloha-green)]">
            <Filter size={18} className="text-[var(--aloha-gold)]" />
            Bộ lọc
          </h2>
          {onClose ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--aloha-cream)] hover:text-[var(--aloha-green)]"
              onClick={onClose}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      {hideCategory ? null : lockCategory || allProductsPage ? (
        <CatalogSubcatPicker
          categoryIds={categoryIds}
          showRootL1={allProductsPage && !lockCategory}
          inFilterSheet
          onNavigate={onClose}
        />
      ) : (
        <div>
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--aloha-ink)]">
            Nhóm hàng
          </h3>
          <ShopCategorySelect
            value={selectedNhoms}
            onChange={onNhomsChange}
            placeholder="Chọn nhóm hàng"
            showLabel={false}
          />
        </div>
      )}

      {afterCategory}

      <PriceRangeFilter
        minPrice={minPrice}
        maxPrice={maxPrice}
        onChange={(min, max) => onPricePreset(min, max)}
      />

      {dvtItems.length > 0 ? <details open={selectedDvts.length > 0 || undefined} className="rounded-xl border border-[var(--aloha-line)] p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-bold text-stone-700">Lọc theo đơn vị{selectedDvts.length > 0 ? ` (${selectedDvts.length})` : ""}</summary>
        <div className="space-y-4 pt-3">
      <FilterChipSection
        title="Đơn vị"
        defaultOpen
        largeChips
        items={dvtItems.map((d) => ({ key: d, label: d }))}
        isActive={(k) => selectedDvts.includes(k)}
        onToggle={onToggleDvt}
        hint={
          facetsLoading
            ? "Đang tải…"
            : selectedNhoms.length ||
                q ||
                homeMode ||
                allProductsPage ||
                hasCategoryScope
              ? undefined
              : "ĐVT phổ biến — chọn nhóm để chính xác hơn"
        }
      />
        </div>
      </details> : null}






      {!hideClearButton ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="w-full rounded-xl border border-[var(--aloha-line)] py-2.5 text-sm font-bold text-slate-600 transition hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)]"
        >
          Bỏ chọn
        </button>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <aside className="relative z-20 space-y-6 overflow-visible rounded-2xl border border-[var(--aloha-line)] bg-white p-4 shadow-sm">
      {body}
    </aside>
  );
}
