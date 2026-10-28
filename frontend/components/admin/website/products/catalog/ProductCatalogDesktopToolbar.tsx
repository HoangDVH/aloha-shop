"use client";

import React, { useRef, useState, useEffect } from "react";
import { HelpCircle, Loader2, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { FilterSearchSelect } from "@/components/admin/ui/FilterSearchSelect";
import { InstantTextInput } from "@/components/admin/ui/InstantTextInput";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import { WbBtn } from "../../ui";
import {
  AUDIENCE_TABS,
  VISIBLE_OPTIONS,
  fmtVnd,
  type AudienceType,
  type BadgeFilter,
  type Row,
} from "./catalogTypes";

export interface ProductCatalogDesktopToolbarProps {
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
  selectedNhoms: string[];
  setSelectedNhoms: (paths: string[]) => void;
  visible: "all" | "1" | "0";
  setVisible: (val: "all" | "1" | "0") => void;
  badgeFilter: BadgeFilter;
  setBadgeFilter: (val: BadgeFilter) => void;
  badgeFilterOptions: { value: string; label: string }[];
  onRefresh: () => void;
  onApplyDefaultBadges: () => void;
  applyingDefaults: boolean;
  loading: boolean;
  busyMa: string | null;
  setPage: (p: number) => void;
}

export function ProductCatalogDesktopToolbar({
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
  selectedNhoms,
  setSelectedNhoms,
  visible,
  setVisible,
  badgeFilter,
  setBadgeFilter,
  badgeFilterOptions,
  onRefresh,
  onApplyDefaultBadges,
  applyingDefaults,
  loading,
  busyMa,
  setPage,
}: ProductCatalogDesktopToolbarProps) {
  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showGuide) return;
    const onDocClick = (e: MouseEvent) => {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) {
        setShowGuide(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showGuide]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [setSuggestOpen]);

  return (
    <div className="hidden md:block mb-4 space-y-3.5 border-b border-gray-200 pb-4">
      {/* Hàng 1: Tiêu đề + Thống kê số lượng + Nút Hướng dẫn ghim/nhãn + Nút Áp nhãn mặc định */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-bold text-gray-900 tracking-tight">Hàng hóa trên web</h2>
          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            Tổng {total.toLocaleString("vi-VN")} hàng hóa
            {appliedQ ? <span className="ml-1 font-normal text-emerald-600">· lọc «{appliedQ}»</span> : null}
          </span>

          {/* Popover Hướng dẫn ghim & nhãn */}
          <div className="relative" ref={guideRef}>
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                showGuide
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-gray-100 hover:bg-gray-200/80 text-gray-700 border border-gray-200/80"
              }`}
              title="Xem quy tắc ghim vị trí và gắn nhãn sản phẩm"
            >
              <HelpCircle className="h-3.5 w-3.5 text-emerald-700" />
              <span>Hướng dẫn ghim & nhãn</span>
            </button>

            {showGuide ? (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-[360px] sm:w-[440px] rounded-xl border border-gray-200 bg-white p-4 shadow-xl text-xs text-gray-700 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                  <h4 className="font-bold text-gray-900 flex items-center gap-1.5 text-[13px]">
                    <HelpCircle className="h-4 w-4 text-emerald-600" />
                    Quy tắc ghim vị trí & gắn nhãn trên web
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowGuide(false)}
                    className="text-gray-400 hover:text-gray-600 rounded-full p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 leading-relaxed text-[12px]">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">1</span>
                    <p>
                      <strong className="text-gray-900">Vị trí ghim:</strong> Số nhỏ hiển thị trước trong nhãn đang gắn. Trùng số cùng nhãn sẽ tự động thay thế SP cũ.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">2</span>
                    <p>
                      <strong className="text-gray-900">Mục «Sản phẩm mới»:</strong> Hệ thống tự động ưu tiên các SP được ghim nhãn <em>Mới</em>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">3</span>
                    <p>
                      <strong className="text-gray-900">Khóa nhãn:</strong> SP đã gắn nhãn sẽ được cố định, không bị tự động ghi đè. Để đổi, chọn <em>«Chưa gắn»</em> rồi bấm <em>«Áp nhãn mặc định»</em>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">4</span>
                    <p>
                      <strong className="text-gray-900">5 nhãn hỗ trợ:</strong> Nổi bật · Bán chạy và sắp hết · Giảm giá · Đặt trước · Mới.
                    </p>
                  </div>
                </div>

                {audience !== "common" ? (
                  <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-normal">
                    <strong>Lưu ý danh sách sỉ:</strong> Chỉ áp dụng cho tài khoản sỉ HCM & sỉ tỉnh đã duyệt. Chỉnh ở danh sách này không thay đổi nhãn hay ghim của khách lẻ.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Nút Áp nhãn mặc định */}
        {audience === "common" ? (
          <WbBtn
            type="button"
            variant="secondary"
            disabled={applyingDefaults || loading}
            onClick={onApplyDefaultBadges}
            className="!h-8 !text-[12px] !px-3 font-semibold text-emerald-800 hover:bg-emerald-50 border-emerald-200"
            title="Gắn tự động các nhãn mặc định cho các sản phẩm chưa khóa nhãn"
          >
            {applyingDefaults ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Đang áp…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Áp nhãn mặc định
              </>
            )}
          </WbBtn>
        ) : null}
      </div>

      {/* Hàng 2: Segmented Tabs chọn Danh sách đang chỉnh */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Danh sách:</span>
          <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5 border border-gray-200/80">
            {AUDIENCE_TABS.map((tab) => {
              const active = audience === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={loading || Boolean(busyMa) || applyingDefaults}
                  onClick={() => onAudienceChange(tab.id)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    active
                      ? "bg-white text-emerald-800 shadow-2xs font-bold"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <span className="text-[11px] text-gray-400 italic">
          {audience === "common"
            ? "Áp dụng khách lẻ & mặc định cho khách sỉ"
            : "Chỉ áp dụng với sỉ HCM & sỉ tỉnh đã duyệt"}
        </span>
      </div>

      {/* Hàng 3: BỘ LỌC TÌM KIẾM */}
      <div className="mt-3.5 space-y-2.5 sm:space-y-0 sm:grid sm:items-center sm:gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(180px,0.85fr)_minmax(150px,0.65fr)_minmax(150px,0.65fr)_auto]">
        <div ref={wrapRef} className="relative z-20 min-w-0">
          <div className="relative flex h-9 items-center rounded-md border border-[#D4CDC0] bg-white px-2.5 transition focus-within:border-[#0F9D58] focus-within:ring-1 focus-within:ring-[#0F9D58]/25">
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
              placeholder="Tìm theo mã, tên hàng… (Enter để lọc bảng)"
              className="hh-search-input min-w-0 flex-1 border-0 bg-transparent py-1 text-[13px] outline-none shadow-none"
            />
            {(draft || appliedQ) && (
              <button
                type="button"
                onClick={onClearSearch}
                className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[#667085] hover:bg-[#EFE9DC]"
                title="Xóa tìm kiếm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {suggestOpen && draft.trim() ? (
            <div className="absolute left-0 right-0 top-full z-[80] mt-1.5 max-h-[340px] overflow-y-auto rounded-xl border border-[#e0e4e8] bg-white py-1 shadow-xl">
              {suggestLoading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-[#98a2b3]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tìm…
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-3 text-[13px] text-[#98a2b3]">
                  Không có sản phẩm khớp «{draft.trim()}»
                </div>
              ) : (
                suggestions.map((p) => (
                  <button
                    key={p.ma}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPickSuggestion(p)}
                    className="flex w-full cursor-pointer items-start gap-2.5 border-0 bg-white px-3 py-2 text-left hover:bg-[#F7F3EA]"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
                      {p.anh ? (
                        <img src={p.anh} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-[#1a1a1a]">
                        {p.ten}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#667085]">
                        <span className="font-mono">{p.ma}</span>
                        <span className="tabular-nums text-[#0F9D58]">{fmtVnd(p.gia)}</span>
                        {p.nhom ? <span className="truncate">{p.nhom}</span> : null}
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
                  className="w-full border-0 border-t border-gray-100 bg-[#F8FAFC] px-3 py-2 text-left text-[12px] font-semibold text-[#0F9D58] hover:bg-[#E8F5E9]"
                >
                  Lọc bảng theo «{draft.trim()}» · Enter
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <div className="relative z-10 min-w-0">
            <ShopCategorySelect
              value={selectedNhoms}
              placeholder="Tất cả nhóm hàng"
              showLabel={false}
              onChange={(paths) => {
                setPage(1);
                setSelectedNhoms(paths);
              }}
            />
          </div>
          <div className="min-w-0">
            <FilterSearchSelect
              value={visible === "all" ? "" : visible}
              allLabel="Tất cả trạng thái"
              placeholder="Tất cả trạng thái"
              options={VISIBLE_OPTIONS}
              onChange={(v) => {
                setPage(1);
                setVisible((v as "1" | "0") || "all");
              }}
            />
          </div>
          <div className="min-w-0">
            <FilterSearchSelect
              value={badgeFilter === "all" ? "" : badgeFilter}
              allLabel="Tất cả nhãn"
              placeholder="Tất cả nhãn"
              options={badgeFilterOptions}
              onChange={(v) => {
                setPage(1);
                setBadgeFilter((v as BadgeFilter) || "all");
              }}
            />
          </div>
          <WbBtn variant="secondary" onClick={onRefresh} className="!h-9 justify-center">
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </WbBtn>
        </div>
      </div>
    </div>
  );
}
