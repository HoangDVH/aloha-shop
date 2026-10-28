"use client";

import React, { Fragment } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AdminTableRowSkeleton } from "@/components/admin/ui/AdminSkeleton";
import { WEB_BADGE_LABELS, type WebBadge } from "@/lib/webBadge";
import { PurchaseGroupSelect } from "../PurchaseGroupSelect";
import {
  fmtVnd,
  type AudienceType,
  type BadgeFilter,
  type Row,
} from "./catalogTypes";

export interface ProductCatalogDesktopTableProps {
  rows: Row[];
  loading: boolean;
  badgeFilter: BadgeFilter;
  badgeOptions: { value: string; label: string }[];
  audience: AudienceType;
  busyMa: string | null;
  onPatchRow: (ma: string, patch: Partial<Row>) => void;
  onSaveMerch: (row: Row, patch: { webPin?: number; webBadge?: string }) => void;
  onToggle: (row: Row) => void;
}

export function ProductCatalogDesktopTable({
  rows,
  loading,
  badgeFilter,
  badgeOptions,
  audience,
  busyMa,
  onPatchRow,
  onSaveMerch,
  onToggle,
}: ProductCatalogDesktopTableProps) {
  return (
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
                <tr className="border-b border-gray-50 transition hover:bg-gray-50/80">
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
                  <td className="px-4 py-3">
                    <PurchaseGroupSelect ma={row.ma} />
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
                        onPatchRow(row.ma, { webPin: n });
                      }}
                      onBlur={(e) => {
                        if (!row.webBadge) return;
                        const raw = e.target.value.trim();
                        const n =
                          raw === ""
                            ? 0
                            : Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
                        if (String(n) === e.currentTarget.dataset.saved) return;
                        onSaveMerch(row, { webPin: n });
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
                        onSaveMerch({ ...row, webBadge }, patch);
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
                      onClick={() => onToggle(row)}
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
  );
}
