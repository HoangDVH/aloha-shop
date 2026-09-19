"use client";

import { Filter } from "lucide-react";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import { FilterChipSection } from "@/components/FilterChipSection";
import { ShopAttributeFilter } from "@/components/ShopAttributeFilter";
import { PRICE_PRESETS } from "@/components/catalog/catalogLayoutUtils";

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
  /** Trang /tim — hiện ĐVT + thuộc tính toàn catalog, không bắt chọn nhóm */
  allProductsPage?: boolean;
  /** URL có categoryId (navbar) — coi như đã có phạm vi danh mục */
  hasCategoryScope?: boolean;
  minPrice: string;
  maxPrice: string;
  onPricePreset: (minPrice: string, maxPrice: string | null) => void;
  onMinPriceBlur: (value: string | null) => void;
  onMaxPriceBlur: (value: string | null) => void;
  inStock: boolean;
  onInStockChange: (checked: boolean) => void;
  onClearFilters: () => void;
  onCloseMobile: () => void;
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
  minPrice,
  maxPrice,
  onPricePreset,
  onMinPriceBlur,
  onMaxPriceBlur,
  inStock,
  onInStockChange,
  onClearFilters,
  onCloseMobile,
}: CatalogFilterPanelProps) {
  return (
    <aside className="relative z-20 space-y-6 overflow-visible rounded-xl border border-[var(--aloha-line)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[var(--aloha-green)]">
          <Filter size={16} className="text-[var(--aloha-gold)]" />
          Bộ lọc
        </h2>
        <button
          type="button"
          className="text-xs font-bold text-slate-500 hover:text-[var(--aloha-green)] lg:hidden"
          onClick={onCloseMobile}
        >
          Đóng
        </button>
      </div>

      <ShopCategorySelect value={selectedNhoms} onChange={onNhomsChange} placeholder="Chọn nhóm hàng" />

      <FilterChipSection
        title="Đơn vị"
        defaultOpen
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

      <div className="border-t border-[#f0ebe3] pt-4">
        <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Khoảng giá</h3>
        <div className="space-y-1.5">
          {PRICE_PRESETS.map((p) => {
            const active =
              String(p.min) === minPrice &&
              (p.max === 0 ? !maxPrice : String(p.max) === maxPrice);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  onPricePreset(String(p.min), p.max > 0 ? String(p.max) : null)
                }
                className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm ${
                  active
                    ? "bg-[var(--aloha-green-light)] font-bold text-[var(--aloha-green)]"
                    : "text-slate-700 hover:bg-[var(--aloha-cream)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Từ"
            defaultValue={minPrice}
            key={`min-${minPrice}`}
            className="rounded-lg border border-[#D5E3D0] px-2 py-1.5 text-sm outline-none focus:border-[var(--aloha-green)]"
            onBlur={(e) => onMinPriceBlur(e.target.value.trim() || null)}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Đến"
            defaultValue={maxPrice}
            key={`max-${maxPrice}`}
            className="rounded-lg border border-[#D5E3D0] px-2 py-1.5 text-sm outline-none focus:border-[var(--aloha-green)]"
            onBlur={(e) => onMaxPriceBlur(e.target.value.trim() || null)}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-[var(--aloha-cream)]">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => onInStockChange(e.target.checked)}
          className="accent-[var(--aloha-green)]"
        />
        Chỉ hiện còn hàng
      </label>

      <button
        type="button"
        onClick={onClearFilters}
        className="w-full rounded-xl border border-[#D5E3D0] py-2 text-sm font-bold text-slate-600 hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)]"
      >
        Xóa bộ lọc
      </button>
    </aside>
  );
}
