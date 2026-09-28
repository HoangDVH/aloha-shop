"use client";

import React from "react";
import { ChevronUp } from "lucide-react";
import { SORT_TOOLBAR } from "./catalogLayoutUtils";

export function CatalogSortBar({
  sort,
  priceMenuOpen,
  onSortClick,
  onSelectPriceSort,
}: {
  sort: string | null;
  priceMenuOpen: boolean;
  onSortClick: (key: string) => void;
  onSelectPriceSort: (sortValue: "price_asc" | "price_desc") => void;
}) {
  return (
    <div className="-mx-4 border-y border-[#eee] bg-white sm:mx-0 sm:border-0 sm:bg-transparent">
      <div className="flex w-full items-center justify-between gap-3 overflow-x-auto px-3 [scrollbar-width:none] sm:justify-start sm:gap-8 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <span className="hidden shrink-0 text-sm font-semibold text-slate-500 sm:inline">
          Sắp xếp theo:
        </span>
        {SORT_TOOLBAR.map((o) => {
          const isPrice = o.value === "price";
          const active = isPrice
            ? sort === "price_asc" || sort === "price_desc"
            : sort === o.value;
          return (
            <span key={o.value} className="inline-flex shrink-0 items-center">
              {isPrice ? (
                <div className="relative shrink-0" data-price-sort-menu>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSortClick("price");
                    }}
                    className={`inline-flex h-10 items-center gap-0.5 px-1 text-[13px] transition sm:h-11 sm:px-0 sm:text-sm ${
                      active || priceMenuOpen
                        ? "font-bold text-[var(--aloha-green)]"
                        : "font-medium text-[#444] hover:text-[var(--aloha-green)]"
                    }`}
                  >
                    Giá
                    <ChevronUp
                      size={14}
                      className={`transition ${priceMenuOpen ? "" : "rotate-180 opacity-70"}`}
                    />
                  </button>
                  {priceMenuOpen ? (
                    <div className="absolute right-0 top-full z-[60] mt-1 min-w-[168px] overflow-hidden rounded-2xl bg-white py-1.5 shadow-lg ring-1 ring-black/8">
                      <button
                        type="button"
                        className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--aloha-cream)] ${
                          sort === "price_asc"
                            ? "font-bold text-[var(--aloha-green)]"
                            : "font-medium text-slate-600"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPriceSort("price_asc");
                        }}
                      >
                        Giá thấp - cao
                      </button>
                      <button
                        type="button"
                        className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--aloha-cream)] ${
                          sort === "price_desc"
                            ? "font-bold text-[var(--aloha-green)]"
                            : "font-medium text-slate-600"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPriceSort("price_desc");
                        }}
                      >
                        Giá cao - thấp
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSortClick(o.value)}
                  className={`inline-flex h-10 shrink-0 items-center px-1 text-[13px] transition sm:h-11 sm:px-0 sm:text-sm ${
                    active
                      ? "font-bold text-[var(--aloha-green)]"
                      : "font-medium text-[#444] hover:text-[var(--aloha-green)]"
                  }`}
                >
                  {o.label}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
