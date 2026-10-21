"use client";

import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, HelpCircle, Loader2, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Drawer, Modal } from "antd";
import { toast } from "@/components/admin/toast";
import { FilterSearchSelect } from "@/components/admin/ui/FilterSearchSelect";
import { InstantTextInput } from "@/components/admin/ui/InstantTextInput";
import { ThuMuaListPagination } from "@/components/admin/ui/ThuMuaListPagination";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import { websiteApi } from "../api";
import { PurchaseGroupSelect } from "./PurchaseGroupSelect";
import { WbBtn } from "../ui";
import { AdminTableRowSkeleton } from "@/components/admin/ui/AdminSkeleton";
import { WEB_BADGE_LABELS, WEB_BADGE_VALUES, type WebBadge } from "@/lib/webBadge";

type Row = {
  ma: string;
  ten: string;
  anh: string;
  nhom: string;
  nhomPath: string;
  gia: number;
  ton: number;
  hienThiWeb: boolean;
  webPin?: number;
  webBadge?: string;
};

function fmtVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")} ₫`;
}

const VISIBLE_OPTIONS = [
  { value: "1", label: "Đang hiển thị" },
  { value: "0", label: "Đang ẩn" },
];

const BADGE_OPTIONS = [
  { value: "", label: "Chưa gắn" },
  ...WEB_BADGE_VALUES.map((v) => ({ value: v, label: WEB_BADGE_LABELS[v] })),
];

const BADGE_FILTER_OPTIONS = [
  { value: "auto", label: "Chưa gắn nhãn" },
  ...WEB_BADGE_VALUES.map((v) => ({ value: v, label: WEB_BADGE_LABELS[v] })),
];

type BadgeFilter = "all" | "auto" | WebBadge;

const AUDIENCE_TABS = [
  { id: "common" as const, label: "Danh sách chung (Khách lẻ)" },
  { id: "si_noi_bat" as const, label: "Khách sỉ – Nổi bật" },
  { id: "si_uu_dai" as const, label: "Khách sỉ – Ưu đãi" },
];

export function ShopWebProductsAdmin() {
  /** Chữ đang gõ — chỉ nuôi dropdown. */
  const [audience, setAudience] = useState<"common" | "si_noi_bat" | "si_uu_dai">("common");
  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement | null>(null);

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

  const siBadge = audience === "si_noi_bat" ? "noi_bat" : "uu_dai";
  const badgeOptions = audience === "common" ? BADGE_OPTIONS : BADGE_OPTIONS.filter(o => !o.value || o.value === siBadge);
  const badgeFilterOptions = audience === "common" ? BADGE_FILTER_OPTIONS : BADGE_FILTER_OPTIONS.filter(o => o.value === "auto" || o.value === siBadge);

  const handleAudienceChange = (val: typeof audience) => {
    if (val === audience || loading || Boolean(busyMa) || applyingDefaults) return;
    setAudience(val);
    setBadgeFilter("all");
    setPage(1);
    setRows([]);
    setSuggestions([]);
    setLoading(true);
  };
  const [draft, setDraft] = useState("");
  /** Từ khóa đã áp vào bảng (Enter / chọn SP). */
  const [appliedQ, setAppliedQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Row[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [visible, setVisible] = useState<"all" | "1" | "0">("all");
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>("all");
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  /** Đường dẫn nhóm — cùng ShopCategorySelect trang chủ shop */
  const [selectedNhoms, setSelectedNhoms] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyMa, setBusyMa] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const draftRef = useRef("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mobileWrapRef = useRef<HTMLDivElement | null>(null);
  const suggestSeq = useRef(0);

  const activeFilterCount =
    (selectedNhoms.length > 0 ? 1 : 0) +
    (visible !== "all" ? 1 : 0) +
    (badgeFilter !== "all" ? 1 : 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        visible,
        audience,
      });
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      for (const n of selectedNhoms) {
        const p = String(n || "").trim();
        if (p) params.append("nhom", p);
      }
      params.set("audience", audience);
      if (badgeFilter !== "all") params.set("badge", badgeFilter);
      const r = await websiteApi<{
        items: Row[];
        total: number;
        pages: number;
      }>(`/api/shop/admin/products?${params}`);
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      toast.error(e?.message || "Không tải được danh sách");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedQ, visible, selectedNhoms, badgeFilter, audience]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Gõ → gợi ý dropdown (không lọc bảng). */
  useEffect(() => {
    const term = draft.trim();
    if (!term) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const seq = ++suggestSeq.current;
    setSuggestLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        limit: "12",
        visible,
        q: term,
      });
      for (const n of selectedNhoms) {
        const p = String(n || "").trim();
        if (p) params.append("nhom", p);
      }
      params.set("audience", audience);
      if (badgeFilter !== "all") params.set("badge", badgeFilter);
      void websiteApi<{ items: Row[] }>(`/api/shop/admin/products?${params}`)
        .then((r) => {
          if (seq !== suggestSeq.current) return;
          setSuggestions(r.items || []);
        })
        .catch(() => {
          if (seq !== suggestSeq.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (seq === suggestSeq.current) setSuggestLoading(false);
        });
    }, 220);
    return () => clearTimeout(t);
  }, [draft, visible, selectedNhoms, badgeFilter, audience]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        !wrapRef.current?.contains(e.target as Node) &&
        !mobileWrapRef.current?.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const applySearch = (term: string) => {
    const next = term.trim();
    setAppliedQ(next);
    setDraft(next);
    draftRef.current = next;
    setPage(1);
    setSuggestOpen(false);
  };

  const clearSearch = () => {
    setDraft("");
    draftRef.current = "";
    setAppliedQ("");
    setSuggestions([]);
    setSuggestOpen(false);
    setPage(1);
  };

  const pickSuggestion = (row: Row) => {
    applySearch(row.ma);
  };

  const patchRow = (ma: string, patch: Partial<Row>) => {
    setRows((list) => list.map((x) => (x.ma === ma ? { ...x, ...patch } : x)));
    setSuggestions((list) => list.map((x) => (x.ma === ma ? { ...x, ...patch } : x)));
  };

  const toggle = async (row: Row) => {
    setBusyMa(row.ma);
    try {
      await websiteApi(`/api/shop/admin/products/${encodeURIComponent(row.ma)}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ hienThiWeb: !row.hienThiWeb }),
      });
      patchRow(row.ma, { hienThiWeb: !row.hienThiWeb });
      toast.success(
        !row.hienThiWeb ? `Đã hiện ${row.ma} trên web` : `Đã ẩn ${row.ma} khỏi web`
      );
    } catch (e: any) {
      toast.error(e?.message || "Đổi trạng thái thất bại");
    } finally {
      setBusyMa(null);
    }
  };

  const saveMerch = async (
    row: Row,
    patch: { webPin?: number; webBadge?: string }
  ) => {
    setBusyMa(row.ma);
    // Optimistic — UI đổi ngay khi chọn nhãn
    if (patch.webBadge !== undefined || patch.webPin !== undefined) {
      patchRow(row.ma, {
        ...(patch.webBadge !== undefined ? { webBadge: patch.webBadge } : {}),
        ...(patch.webPin !== undefined ? { webPin: patch.webPin } : {}),
      });
    }
    try {
      const r = await websiteApi<{
        ok?: boolean;
        webPin?: number;
        webBadge?: string;
        clearedMas?: string[];
      }>(`/api/shop/admin/products/${encodeURIComponent(row.ma)}/merchandising`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, audience }),
      });
      const savedBadge =
        r.webBadge !== undefined ? r.webBadge : patch.webBadge;
      if (
        patch.webBadge !== undefined &&
        String(patch.webBadge || "").trim() &&
        !String(savedBadge || "").trim()
      ) {
        toast.error(
          "Máy chủ không nhận nhãn này — thử restart API (npm run dev) rồi gắn lại"
        );
        void load();
        return;
      }
      patchRow(row.ma, {
        webPin: r.webPin !== undefined ? r.webPin : patch.webPin,
        webBadge: savedBadge,
      });
      if (r.clearedMas?.length) {
        for (const m of r.clearedMas) {
          patchRow(m, { webPin: 0 });
        }
        toast.success(
          `Đã lưu ${row.ma}` +
            (r.clearedMas.length
              ? ` · nhả ghim: ${r.clearedMas.join(", ")}`
              : "")
        );
      } else {
        toast.success(`Đã lưu ghim/nhãn ${row.ma}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Lưu ghim/nhãn thất bại");
      void load();
    } finally {
      setBusyMa(null);
    }
  };

  const applyDefaultBadges = async () => {
    if (applyingDefaults) return;
    setApplyingDefaults(true);
    try {
      const r = await websiteApi<{
        banChaySapHet: number;
        datTruoc: number;
        moi: number;
        updated: number;
        skippedManual: number;
      }>("/api/shop/admin/products/apply-default-badges", { method: "POST" });
      toast.success(
        `Đã áp nhãn mặc định: ${r.banChaySapHet || 0} bán chạy+sắp hết · ${r.datTruoc || 0} đặt trước` +
          (r.skippedManual ? ` · bỏ qua ${r.skippedManual} đã gắn nhãn` : "")
      );
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Áp nhãn mặc định thất bại");
    } finally {
      setApplyingDefaults(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col bg-white p-3.5 md:p-5">
      {/* 1A. HEADER SECTION TRÊN DESKTOP (>= md: GIỮ NGUYÊN 100%) */}
      <div className="hidden md:block mb-4 space-y-3.5 border-b border-gray-200 pb-4">
        {/* Hàng 1: Tiêu đề + Thống kê số lượng + Nút Hướng dẫn ghim/nhãn + Nút Áp nhãn mặc định */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[16px] font-bold text-gray-900 tracking-tight">Hàng hóa trên web</h2>
            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Tổng {total.toLocaleString("vi-VN")} hàng hóa
              {appliedQ ? <span className="ml-1 font-normal text-emerald-600">· lọc «{appliedQ}»</span> : null}
            </span>

            {/* Popover Hướng dẫn ghim & nhãn — Gom gọn toàn bộ wall-of-text cũ */}
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
              onClick={() => void applyDefaultBadges()}
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

        {/* Hàng 2: Segmented Tabs chọn Danh sách đang chỉnh (Thay thế hộp xanh alert cũ) */}
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
                    onClick={() => handleAudienceChange(tab.id)}
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

        {/* Hàng 3: BỘ LỌC TÌM KIẾM (GIỮ NGUYÊN 100% TÍNH NĂNG) */}
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
                      pickSuggestion(suggestions[0]!);
                      return;
                    }
                    applySearch(typed);
                  }
                  if (e.key === "Escape") setSuggestOpen(false);
                }}
                placeholder="Tìm theo mã, tên hàng… (Enter để lọc bảng)"
                className="hh-search-input min-w-0 flex-1 border-0 bg-transparent py-1 text-[13px] outline-none shadow-none"
              />
              {(draft || appliedQ) && (
                <button
                  type="button"
                  onClick={clearSearch}
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
                      onClick={() => pickSuggestion(p)}
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
                    onClick={() => applySearch(draft)}
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
            <WbBtn variant="secondary" onClick={() => void load()} className="!h-9 justify-center">
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </WbBtn>
          </div>
        </div>
      </div>

      {/* 1B. KHỐI ĐIỀU KHIỂN GỌN GÀNG TRÊN MOBILE (< md: CHUẨN SHOPIFY / SHOPEE SELLER) */}
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
              onClick={() => setMobileGuideOpen(true)}
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
                onClick={() => void applyDefaultBadges()}
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
              onClick={() => void load()}
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
                      pickSuggestion(suggestions[0]!);
                      return;
                    }
                    applySearch(typed);
                  }
                  if (e.key === "Escape") setSuggestOpen(false);
                }}
                placeholder="Tìm tên, mã hàng…"
                className="hh-search-input min-w-0 flex-1 border-0 bg-transparent py-1 text-xs outline-none shadow-none"
              />
              {(draft || appliedQ) && (
                <button
                  type="button"
                  onClick={clearSearch}
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
                      onClick={() => pickSuggestion(p)}
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
                    onClick={() => applySearch(draft)}
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
            onClick={() => setMobileFilterOpen(true)}
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

        {/* Hàng 3: Dải Tabs chọn tệp khách hàng (Flat Underline horizontal scrollable tabs) */}
        <div className="flex items-stretch border-b border-gray-100 -mx-3.5 px-3.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {AUDIENCE_TABS.map((tab) => {
            const active = audience === tab.id;
            const shortLabel = tab.id === "common" ? "Khách lẻ" : tab.id === "si_noi_bat" ? "Sỉ nổi bật" : "Sỉ ưu đãi";
            return (
              <button
                key={tab.id}
                type="button"
                disabled={loading || Boolean(busyMa) || applyingDefaults}
                onClick={() => handleAudienceChange(tab.id)}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-gray-200 bg-white">
        {/* 1. BẢNG DỮ LIỆU ĐẦY ĐỦ TRÊN DESKTOP (TABLE CHO MÁY TÍNH >= md) */}
        <div className="hidden md:block min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-gray-100 bg-[#0F9D58] text-[11px] font-semibold uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Tên hàng</th>
                <th className="px-4 py-3 font-semibold">Nhóm hàng</th>
                <th className="px-4 py-3 font-semibold">Điều kiện sỉ</th>
                <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
                <th className="px-4 py-3 text-right font-semibold">Có sẵn</th>
                <th className="px-3 py-3 text-center font-semibold" title="Số = vị trí trong nhãn đang gắn">
                  Ghim
                </th>
                <th className="px-3 py-3 text-center font-semibold">Nhãn</th>
                <th className="px-4 py-3 text-center font-semibold">Trên web</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <>
                  {Array.from({ length: 8 }, (_, i) => (
                    <AdminTableRowSkeleton key={i} cols={8} />
                  ))}
                </>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-[13px] text-gray-500">
                    {badgeFilter === "ban_chay_sap_het" || badgeFilter === "dat_truoc" ? (
                      <div className="mx-auto max-w-md space-y-2">
                        <p className="font-medium text-gray-600">
                          Chưa có sản phẩm gắn nhãn «
                          {badgeFilter === "ban_chay_sap_het"
                            ? "Bán chạy và sắp hết"
                            : "Đặt trước"}
                          ».
                        </p>
                        <p className="text-[12px] text-gray-400">
                          Bộ lọc chỉ hiện SP đã lưu nhãn trong DB. Bấm{" "}
                          <strong className="font-semibold text-[#0F9D58]">
                            Áp nhãn mặc định
                          </strong>{" "}
                          (góc phải trên) để gắn tự động, rồi lọc lại.
                        </p>
                      </div>
                    ) : (
                      "Không có hàng hóa phù hợp"
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <Fragment key={row.ma}>
                  <tr
                    className="border-b border-gray-50 transition hover:bg-gray-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
                          {row.anh ? (
                            <img src={row.anh} alt={row.ten || ""} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-gray-900">
                            {row.ten}
                          </div>
                          <div className="truncate font-mono text-[11px] text-gray-400">
                            {row.ma}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-[13px] text-gray-600"
                      title={row.nhomPath || row.nhom}
                    >
                      {row.nhom || "—"}
                    </td>
                    <td className="px-4 py-3"><PurchaseGroupSelect ma={row.ma} /></td>
                    <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums text-gray-800">
                      {fmtVnd(row.gia)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-600">
                      {Number(row.ton || 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        disabled={busyMa === row.ma || !row.webBadge}
                        className="mx-auto h-8 w-16 rounded-md border border-gray-200 bg-white px-1.5 text-center text-[12px] tabular-nums outline-none focus:border-[#0F9D58] disabled:bg-gray-50 disabled:text-gray-400"
                        value={Number(row.webPin) > 0 ? Number(row.webPin) : ""}
                        placeholder="—"
                        title={
                          row.webBadge
                            ? "Ghim trong nhãn đang chọn: 1 = đầu danh sách khu đó"
                            : "Chọn nhãn trước khi ghim"
                        }
                        onFocus={(e) => {
                          e.currentTarget.dataset.saved = String(Number(row.webPin) || 0);
                        }}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const n =
                            raw === ""
                              ? 0
                              : Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
                          patchRow(row.ma, { webPin: n });
                        }}
                        onBlur={(e) => {
                          if (!row.webBadge) return;
                          const raw = e.target.value.trim();
                          const n =
                            raw === ""
                              ? 0
                              : Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
                          if (String(n) === e.currentTarget.dataset.saved) return;
                          void saveMerch(row, { webPin: n });
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <select
                        disabled={busyMa === row.ma}
                        className="h-8 max-w-[160px] rounded-md border border-gray-200 bg-white px-1.5 text-[12px] outline-none focus:border-[#0F9D58]"
                        value={row.webBadge || ""}
                        title={
                          row.webBadge
                            ? WEB_BADGE_LABELS[row.webBadge as WebBadge] || row.webBadge
                            : "Chưa gắn — có thể «Áp nhãn mặc định»"
                        }
                        onChange={(e) => {
                          const webBadge = e.target.value;
                          const patch: { webBadge: string; webPin?: number } = {
                            webBadge,
                          };
                          if (!webBadge) patch.webPin = 0;
                          void saveMerch({ ...row, webBadge }, patch);
                        }}
                      >
                        {badgeOptions.map((o) => (
                          <option key={o.value || "auto"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={busyMa === row.ma || audience !== "common"}
                        onClick={() => void toggle(row)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition disabled:opacity-50 ${
                          row.hienThiWeb
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {busyMa === row.ma ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : row.hienThiWeb ? (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Hiện
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Ẩn
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 2. DANH SÁCH MOBILE DẠNG HÀNG PHẲNG (< md: CHUẨN IOS / TECHCOMBANK / OPTION 2) */}
        <div className="block md:hidden">
          {loading && !rows.length ? (
            <div className="divide-y divide-gray-100 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-11 w-11 rounded-lg bg-gray-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-3/4 bg-gray-200 rounded" />
                      <div className="h-3 w-1/3 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                    <div className="h-6 w-16 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              Không có hàng hóa phù hợp
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row) => (
                <div key={row.ma} className="p-3.5 space-y-2.5 transition hover:bg-gray-50/70">
                  {/* Hàng 1: Ảnh + Tên hàng + Mã SKU + Nút Hiện/Ẩn */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
                        {row.anh ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.anh} alt={row.ten || ""} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 leading-snug line-clamp-2">
                          {row.ten}
                        </div>
                        <div className="font-mono text-[11px] text-gray-400 mt-0.5">
                          {row.ma}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyMa === row.ma || audience !== "common"}
                      onClick={() => void toggle(row)}
                      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50 ${
                        row.hienThiWeb
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {busyMa === row.ma ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : row.hienThiWeb ? (
                        <>
                          <Eye className="h-3 w-3" /> Hiện
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" /> Ẩn
                        </>
                      )}
                    </button>
                  </div>

                  {/* Hàng 2: Giá bán, Tồn kho & Nhóm hàng */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700 tabular-nums text-sm">
                        {fmtVnd(row.gia)}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500 text-[11px]">
                        Tồn: <strong className="text-gray-800 tabular-nums">{Number(row.ton || 0).toLocaleString("vi-VN")}</strong>
                      </span>
                    </div>
                    {row.nhom ? (
                      <span className="truncate max-w-[130px] rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] text-gray-600">
                        {row.nhom}
                      </span>
                    ) : null}
                  </div>

                  {/* Hàng 3: Gắn nhãn & Vị trí ghim trên mobile */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100/80">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[11px] text-gray-400 shrink-0">Nhãn:</span>
                      <select
                        disabled={busyMa === row.ma}
                        className="h-7 w-full rounded-md border border-gray-200 bg-white px-1.5 text-[11px] outline-none focus:border-[#0F9D58]"
                        value={row.webBadge || ""}
                        onChange={(e) => {
                          const webBadge = e.target.value;
                          const patch: { webBadge: string; webPin?: number } = { webBadge };
                          if (!webBadge) patch.webPin = 0;
                          void saveMerch({ ...row, webBadge }, patch);
                        }}
                      >
                        {badgeOptions.map((o) => (
                          <option key={o.value || "auto"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-gray-400">Ghim:</span>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        disabled={busyMa === row.ma || !row.webBadge}
                        className="h-7 w-12 rounded-md border border-gray-200 bg-white px-1 text-center text-[11px] tabular-nums outline-none focus:border-[#0F9D58] disabled:bg-gray-50 disabled:text-gray-400"
                        value={Number(row.webPin) > 0 ? Number(row.webPin) : ""}
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const n = raw === "" ? 0 : Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
                          patchRow(row.ma, { webPin: n });
                        }}
                        onBlur={(e) => {
                          if (!row.webBadge) return;
                          const raw = e.target.value.trim();
                          const n = raw === "" ? 0 : Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
                          void saveMerch(row, { webPin: n });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ThuMuaListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="hàng hóa"
        />
      </div>

      {/* 3. BOTTOM SHEET BỘ LỌC TRÊN MOBILE (< md) */}
      <Drawer
        title={
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">Bộ lọc hàng hóa</span>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedNhoms([]);
                  setVisible("all");
                  setBadgeFilter("all");
                  setPage(1);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Đặt lại
              </button>
            ) : null}
          </div>
        }
        placement="bottom"
        onClose={() => setMobileFilterOpen(false)}
        open={mobileFilterOpen}
        height="auto"
        className="rounded-t-2xl [&_.ant-drawer-header]:border-b-0 [&_.ant-drawer-header]:px-4 [&_.ant-drawer-header]:pt-4 [&_.ant-drawer-header]:pb-2 [&_.ant-drawer-body]:px-4 [&_.ant-drawer-body]:py-2"
        footer={
          <div className="p-3">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="w-full h-10 rounded-xl bg-emerald-700 font-semibold text-white text-xs hover:bg-emerald-800 transition active:scale-[0.99]"
            >
              Xem {total.toLocaleString("vi-VN")} kết quả
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          {/* Nhóm hàng */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Nhóm hàng</label>
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

          {/* Trạng thái hiển thị */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Trạng thái hiển thị</label>
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

          {/* Nhãn sản phẩm */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Nhãn sản phẩm</label>
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
        </div>
      </Drawer>

      {/* 4. MODAL HƯỚNG DẪN GHIM & NHÃN TRÊN MOBILE */}
      <Modal
        open={mobileGuideOpen}
        onCancel={() => setMobileGuideOpen(false)}
        footer={null}
        centered
        title={
          <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            <span>Quy tắc ghim vị trí & gắn nhãn</span>
          </div>
        }
        className="[&_.ant-modal-content]:rounded-2xl"
      >
        <div className="space-y-3 leading-relaxed text-xs text-gray-700 pt-1">
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

          {audience !== "common" ? (
            <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-normal">
              <strong>Lưu ý danh sách sỉ:</strong> Chỉ áp dụng cho tài khoản sỉ HCM & sỉ tỉnh đã duyệt. Chỉnh ở danh sách này không thay đổi nhãn hay ghim của khách lẻ.
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
