"use client";

import React, { useRef, useEffect } from "react";
import { HelpCircle, Loader2, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { InstantTextInput } from "@/components/admin/ui/InstantTextInput";
import {
  AUDIENCE_TABS,
  fmtVnd,
  type AudienceType,
  type Row,
} from "./catalogTypes";

export interface ProductCatalogMobileToolbarProps {
  audience: AudienceType;
  onAudienceChange: (val: AudienceType) => void;
  total: number;
  appliedQ: string;
  draft: string;
  setDraft: (val: string) => void;
  draftRef: React.MutableRefObject<string>;
  suggestOpen: boolean;
  setSuggestOpen: (val: boolean) => void;
  suggestions: Row[];
  suggestLoading: boolean;
  onApplySearch: (term: string) => void;
  onClearSearch: () => void;
  onPickSuggestion: (row: Row) => void;
  activeFilterCount: number;
  onOpenMobileFilter: () => void;
  onOpenMobileGuide: () => void;
  onRefresh: () => void;
  onApplyDefaultBadges: () => void;
  applyingDefaults: boolean;
  loading: boolean;
  busyMa: string | null;
}

export function ProductCatalogMobileToolbar({
  audience,
  onAudienceChange,
  total,
  appliedQ,
  draft,
  setDraft,
  draftRef,
  suggestOpen,
  setSuggestOpen,
  suggestions,
  suggestLoading,
  onApplySearch,
  onClearSearch,
  onPickSuggestion,
  activeFilterCount,
  onOpenMobileFilter,
  onOpenMobileGuide,
  onRefresh,
  onApplyDefaultBadges,
  applyingDefaults,
  loading,
  busyMa,
}: ProductCatalogMobileToolbarProps) {
  const mobileWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!mobileWrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [setSuggestOpen]);

  return (
    <div className="md:hidden mb-3 space-y-2.5 pb-2.5 border-b border-gray-100">
      {/* Hàng 1: Tiêu đề + Thống kê tổng + Hướng dẫn (?) + Áp nhãn mặc định + Làm mới */}
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="text-[15px] font-bold text-gray-900 truncate">Hàng hóa web</h1>
          <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-bold text-emerald-800 shrink-0">
            {total.toLocaleString("vi-VN")}
          </span>
          {appliedQ ? (
            <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-800 font-medium truncate max-w-[90px]">
              «{appliedQ}»
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMobileGuide}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition"
            title="Xem quy tắc ghim vị trí & gắn nhãn"
            aria-label="Hướng dẫn ghim và nhãn"
          >
            <HelpCircle className="h-4 w-4 text-emerald-700" />
          </button>

          {audience === "common" ? (
            <button
              type="button"
              disabled={applyingDefaults || loading}
              onClick={onApplyDefaultBadges}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:scale-95 transition disabled:opacity-50"
              title="Áp nhãn mặc định"
              aria-label="Áp nhãn mặc định"
            >
              {applyingDefaults ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-emerald-600" />
              )}
            </button>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition disabled:opacity-50"
            title="Làm mới danh sách"
            aria-label="Làm mới"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Hàng 2: Thanh tìm kiếm nguyên khối + Nút mở Drawer bộ lọc */}
      <div className="flex items-center gap-2">
        <div ref={mobileWrapRef} className="relative flex-1 min-w-0">
          <div className="relative flex h-9 items-center rounded-xl border border-gray-200 bg-gray-50/70 px-2.5 transition focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-600/20">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <InstantTextInput
              value={draft}
              debounceMs={200}
              onCommit={(v) => {
                draftRef.current = v;
                setDraft(v);
                setSuggestOpen(!!v.trim());
              }}
              onLiveChange={(v) => {
                draftRef.current = v;
                setDraft(v);
                setSuggestOpen(!!v.trim());
              }}
              onFocus={() => {
                if ((draft || appliedQ).trim()) setSuggestOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const typed = (draftRef.current || draft).trim();
                  if (suggestions.length === 1) {
                    onPickSuggestion(suggestions[0]!);
                    return;
                  }
                  onApplySearch(typed);
                }
                if (e.key === "Escape") setSuggestOpen(false);
              }}
              placeholder="Tìm tên, mã hàng…"
              className="hh-search-input min-w-0 flex-1 border-0 bg-transparent py-1 text-xs outline-none shadow-none"
            />
            {(draft || appliedQ) && (
              <button
                type="button"
                onClick={onClearSearch}
                className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200/60 text-gray-500 hover:bg-gray-300"
                title="Xóa tìm kiếm"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {suggestOpen && draft.trim() ? (
            <div className="absolute left-0 right-0 top-full z-[80] mt-1.5 max-h-[300px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
              {suggestLoading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tìm…
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400">
                  Không có sản phẩm khớp «{draft.trim()}»
                </div>
              ) : (
                suggestions.map((p) => (
                  <button
                    key={p.ma}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPickSuggestion(p)}
                    className="flex w-full cursor-pointer items-start gap-2.5 border-0 bg-white px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
                      {p.anh ? (
                        <img src={p.anh} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-gray-900">
                        {p.ten}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-gray-500">
                        <span className="font-mono">{p.ma}</span>
                        <span className="tabular-nums text-emerald-600 font-medium">{fmtVnd(p.gia)}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
              {draft.trim() ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onApplySearch(draft)}
                  className="w-full border-0 border-t border-gray-100 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Lọc bảng theo «{draft.trim()}» · Enter
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Nút Mở Bottom Sheet Lọc */}
        <button
          type="button"
          onClick={onOpenMobileFilter}
          className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-95 ${
            activeFilterCount > 0
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-700" />
          <span>Lọc</span>
          {activeFilterCount > 0 ? (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Hàng 3: Dải Tabs chọn tệp khách hàng */}
      <div className="flex items-stretch border-b border-gray-100 -mx-3.5 px-3.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {AUDIENCE_TABS.map((tab) => {
          const active = audience === tab.id;
          const shortLabel = tab.id === "common" ? "Khách lẻ" : tab.id === "si_noi_bat" ? "Sỉ nổi bật" : "Sỉ ưu đãi";
          return (
            <button
              key={tab.id}
              type="button"
              disabled={loading || Boolean(busyMa) || applyingDefaults}
              onClick={() => onAudienceChange(tab.id)}
              className={`relative py-2 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                active ? "text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{shortLabel}</span>
              {active ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-600" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
