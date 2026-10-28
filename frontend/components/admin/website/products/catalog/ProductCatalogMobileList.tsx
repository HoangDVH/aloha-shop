"use client";

import React from "react";
import { ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { WEB_BADGE_LABELS, type WebBadge } from "@/lib/webBadge";
import {
  fmtVnd,
  type AudienceType,
  type Row,
} from "./catalogTypes";

export interface ProductCatalogMobileListProps {
  rows: Row[];
  loading: boolean;
  audience: AudienceType;
  busyMa: string | null;
  onPatchRow: (ma: string, patch: Partial<Row>) => void;
  onSaveMerch: (row: Row, patch: { webPin?: number; webBadge?: string }) => void;
  onToggle: (row: Row) => void;
  onSetBadgeTargetRow: (row: Row) => void;
}

export function ProductCatalogMobileList({
  rows,
  loading,
  audience,
  busyMa,
  onPatchRow,
  onSaveMerch,
  onToggle,
  onSetBadgeTargetRow,
}: ProductCatalogMobileListProps) {
  return (
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
                  onClick={() => onToggle(row)}
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
                  <button
                    type="button"
                    disabled={busyMa === row.ma}
                    onClick={() => onSetBadgeTargetRow(row)}
                    className={`h-7 w-full rounded-md border px-2 text-[11px] font-medium flex items-center justify-between gap-1 transition active:scale-[0.98] outline-none cursor-pointer ${
                      row.webBadge
                        ? "border-emerald-300 bg-emerald-50/70 text-emerald-800 font-semibold"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    title="Chạm để đổi nhãn sản phẩm"
                  >
                    <span className="truncate">
                      {row.webBadge ? (WEB_BADGE_LABELS[row.webBadge as WebBadge] || row.webBadge) : "Chưa gắn"}
                    </span>
                    <ChevronDown size={12} className="text-gray-400 shrink-0" />
                  </button>
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
                      onPatchRow(row.ma, { webPin: n });
                    }}
                    onBlur={(e) => {
                      if (!row.webBadge) return;
                      const raw = e.target.value.trim();
                      const n = raw === "" ? 0 : Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
                      void onSaveMerch(row, { webPin: n });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
