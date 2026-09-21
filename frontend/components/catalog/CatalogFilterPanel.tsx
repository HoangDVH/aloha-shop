"use client";

import { Filter, X } from "lucide-react";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import { FilterChipSection } from "@/components/FilterChipSection";
import { ShopAttributeFilter } from "@/components/ShopAttributeFilter";
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
  inStock: boolean;
  onInStockChange: (checked: boolean) => void;
  onClearFilters: () => void;
  onClose?: () => void;
  hideClearButton?: boolean;
  embedded?: boolean;
};

export function CatalogFilterPanel({
  selectedNhoms,
  onNhomsChange,
  dvtItems,
  selectedDvts,
  onToggleDvt,
  attributes,
  selectedAttrs,
  onToggleAttr,
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
  inStock,
  onInStockChange,
  onClearFilters,
  onClose,
  hideClearButton = false,
  embedded = false,
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

      {lockCategory || allProductsPage ? (
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

      <ShopAttributeFilter
        attributes={attributes}
        selected={selectedAttrs}
        onToggle={onToggleAttr}
        loading={facetsLoading}
        needCategory={
          !homeMode &&
          !allProductsPage &&
          !hasCategoryScope &&
          !selectedNhoms.length &&
          !q
        }
      />

      <PriceRangeFilter
        minPrice={minPrice}
        maxPrice={maxPrice}
        onChange={(min, max) => onPricePreset(min, max)}
      />

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-1 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--aloha-cream)]">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => onInStockChange(e.target.checked)}
          className="h-4 w-4 accent-[var(--aloha-green)]"
        />
        Chỉ hiện còn hàng
      </label>

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
