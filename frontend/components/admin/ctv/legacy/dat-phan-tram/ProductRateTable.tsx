"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { CtvPagination } from "../../shared/CtvPagination";
import { formatVnd, type ProductRateRow } from "../api";

export function ProductRateTable({
  rows,
  selected,
  setSelected,
  batchRate,
  setBatchRate,
  searchWrapRef,
  suggestLive,
  setSuggestLive,
  suggestOpen,
  setSuggestOpen,
  suggestions,
  q,
  setQ,
  applySearch,
  loading,
  saveOne,
  handleBatchSetSelected,
  handleBatchClearSelected,
  page,
  pageSize,
  total,
  setPage,
}: {
  rows: ProductRateRow[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  batchRate: string;
  setBatchRate: (v: string) => void;
  searchWrapRef: React.RefObject<HTMLDivElement | null>;
  suggestLive: string;
  setSuggestLive: (v: string) => void;
  suggestOpen: boolean;
  setSuggestOpen: (v: boolean) => void;
  suggestions: ProductRateRow[];
  q: string;
  setQ: (v: string) => void;
  applySearch: (term: string) => void;
  loading: boolean;
  saveOne: (ma: string, rate: number | null) => Promise<void>;
  handleBatchSetSelected: () => Promise<void>;
  handleBatchClearSelected: () => Promise<void>;
  page: number;
  pageSize: number;
  total: number;
  setPage: (p: number) => void;
}) {
  return (
    <>
      {/* Thao tác chọn theo nhóm SP */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every((r) => selected.has(r.ma))}
            onChange={(e) => {
              const n = new Set(selected);
              if (e.target.checked) {
                rows.forEach((r) => n.add(r.ma));
              } else {
                rows.forEach((r) => n.delete(r.ma));
              }
              setSelected(n);
            }}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-xs font-semibold text-slate-600">
            {selected.size > 0 ? (
              <span className="text-emerald-800">Đã chọn {selected.size} sản phẩm</span>
            ) : (
              "Chọn tất cả trên trang này"
            )}
          </span>
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={batchRate}
              onChange={(e) => setBatchRate(e.target.value)}
              placeholder="% áp dụng"
              className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800"
              onClick={handleBatchSetSelected}
            >
              Áp dụng {selected.size} SP
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleBatchClearSelected}
            >
              Về mặc định ({selected.size})
            </button>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setSelected(new Set())}
            >
              Bỏ chọn
            </button>
          </div>
        ) : null}
      </div>

      {/* Ô tìm kiếm */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div ref={searchWrapRef} className="relative max-w-xl">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={suggestLive}
            onChange={(e) => {
              const v = e.target.value;
              setSuggestLive(v);
              setSuggestOpen(!!v.trim());
            }}
            onFocus={() => {
              if (suggestLive.trim()) setSuggestOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions.length === 1) applySearch(suggestions[0].ma);
                else applySearch(suggestLive);
              }
              if (e.key === "Escape") setSuggestOpen(false);
            }}
            placeholder="Tìm mã / tên SP"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm outline-none focus:border-emerald-500"
          />
          {(suggestLive || q) && (
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent text-slate-500 hover:bg-[#EFE9DC] hover:text-slate-700"
              onClick={() => {
                setSuggestLive("");
                setQ("");
                setPage(1);
                setSuggestOpen(false);
              }}
              title="Xóa tìm"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}

          {suggestOpen && suggestLive.trim() ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {suggestions.length === 0 ? (
                <div className="px-3 py-3 text-[13px] text-slate-400">
                  Không có SP khớp «{suggestLive.trim()}»
                </div>
              ) : (
                suggestions.map((p) => (
                  <button
                    key={p.ma}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySearch(p.ma)}
                    className="flex w-full items-start gap-2.5 border-0 bg-white px-3 py-2 text-left hover:bg-[#F7F3EA]"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {p.anh ? (
                        <img src={p.anh} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-800">
                        {p.ten || p.ma}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {p.ma} · {formatVnd(p.gia)} · {p.effectiveRate}%
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-[280px] flex-1 overflow-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Đang tải…</p>
        ) : !rows.length ? (
          <p className="p-6 text-sm text-slate-400">Không có sản phẩm</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div
                key={r.ma}
                className="grid grid-cols-[28px_48px_minmax(0,1fr)_88px_110px] items-center gap-3 px-4 py-2.5 hover:bg-slate-50/80"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.ma)}
                  onChange={(e) => {
                    const n = new Set(selected);
                    if (e.target.checked) n.add(r.ma);
                    else n.delete(r.ma);
                    setSelected(n);
                  }}
                  className="h-[15px] w-[15px] cursor-pointer"
                />
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
                  {r.anh ? (
                    <img src={r.anh} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-5 text-slate-800">
                    {r.ten || r.ma}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">
                    {r.ma} · {formatVnd(r.gia)} ·{" "}
                    {r.rateSource === "shop"
                      ? "mặc định"
                      : r.rateSource === "excluded"
                        ? "loại trừ"
                        : "riêng SP"}
                  </div>
                </div>
                <input
                  type="number"
                  defaultValue={r.ctvCommissionRate ?? ""}
                  placeholder={String(r.effectiveRate)}
                  key={`${r.ma}-${r.ctvCommissionRate}-${r.effectiveRate}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === "") return;
                    void saveOne(r.ma, Number(v));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => void saveOne(r.ma, null)}
                >
                  Về mặc định
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CtvPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        itemLabel="SP"
      />
    </>
  );
}
