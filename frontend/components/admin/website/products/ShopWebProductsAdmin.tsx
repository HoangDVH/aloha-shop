"use client";

import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { FilterSearchSelect } from "@/components/admin/ui/FilterSearchSelect";
import { InstantTextInput } from "@/components/admin/ui/InstantTextInput";
import { ThuMuaListPagination } from "@/components/admin/ui/ThuMuaListPagination";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import { websiteApi } from "../api";
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

export function ShopWebProductsAdmin() {
  /** Chữ đang gõ — chỉ nuôi dropdown. */
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
  const draftRef = useRef("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const suggestSeq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        visible,
      });
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      for (const n of selectedNhoms) {
        const p = String(n || "").trim();
        if (p) params.append("nhom", p);
      }
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
  }, [page, pageSize, appliedQ, visible, selectedNhoms, badgeFilter]);

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
  }, [draft, visible, selectedNhoms, badgeFilter]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
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
    try {
      const r = await websiteApi<{
        ok?: boolean;
        webPin?: number;
        webBadge?: string;
        clearedMas?: string[];
      }>(`/api/shop/admin/products/${encodeURIComponent(row.ma)}/merchandising`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      patchRow(row.ma, {
        webPin: r.webPin !== undefined ? r.webPin : patch.webPin,
        webBadge: r.webBadge !== undefined ? r.webBadge : patch.webBadge,
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
    <div className="flex min-h-[calc(100vh-10rem)] flex-col bg-white p-4 md:p-5">
      <div className="mb-4 border-b border-gray-200 pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Hàng hóa trên web</h2>
            <p className="mt-0.5 text-[12px] text-gray-500">
              Hiện/ẩn · Ghim theo nhãn đang chọn (số = vị trí trong nhãn đó; cùng số cùng
              nhãn sẽ thay SP cũ) · Đã gắn nhãn = khóa đến khi chọn «Chưa gắn» rồi «Áp nhãn
              mặc định». Mục «Sản phẩm mới» xếp theo ngày tạo, không gắn cứng nhãn Mới. 4
              nhãn: Bán chạy và sắp hết · Giảm giá · Đặt trước · Mới.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WbBtn
              type="button"
              variant="secondary"
              disabled={applyingDefaults || loading}
              onClick={() => void applyDefaultBadges()}
              className="!h-9 !text-[12px]"
            >
              {applyingDefaults ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Đang áp…
                </>
              ) : (
                "Áp nhãn mặc định"
              )}
            </WbBtn>
            <p className="text-[12px] font-medium text-gray-600">
              Tổng{" "}
              <span className="tabular-nums text-[#0F9D58]">
                {total.toLocaleString("vi-VN")}
              </span>{" "}
              hàng hóa
              {appliedQ ? (
                <span className="ml-1 text-gray-400">· lọc «{appliedQ}»</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-4 grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(180px,0.85fr)_minmax(150px,0.65fr)_minmax(150px,0.65fr)_auto]">
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
              options={BADGE_FILTER_OPTIONS}
              onChange={(v) => {
                setPage(1);
                setBadgeFilter((v as BadgeFilter) || "all");
              }}
            />
          </div>
          <WbBtn variant="secondary" onClick={() => void load()} className="!h-9">
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </WbBtn>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-gray-200 bg-white">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-gray-100 bg-[#0F9D58] text-[11px] font-semibold uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Tên hàng</th>
                <th className="px-4 py-3 font-semibold">Nhóm hàng</th>
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
                    <AdminTableRowSkeleton key={i} cols={7} />
                  ))}
                </>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-[13px] text-gray-500">
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
                        {BADGE_OPTIONS.map((o) => (
                          <option key={o.value || "auto"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={busyMa === row.ma}
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
    </div>
  );
}
