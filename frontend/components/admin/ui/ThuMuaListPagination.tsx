"use client";

import React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/** Lựa chọn số dòng — chuẩn mọi tab Thu mua. */
export const THUMUA_PAGE_SIZE_OPTIONS = [15, 30, 50, 100, 200] as const;

/**
 * Phân trang kiểu HangHoaList:
 * Hiển thị [15 dòng ▾]   |« « [1] » »|   1 - 15 trong N …
 */
export function ThuMuaListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  itemLabel = "dòng",
  extraLabel,
  pageSizeOptions = THUMUA_PAGE_SIZE_OPTIONS,
  className = "",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  /** Ví dụ: "(2.697 mã hàng)" */
  extraLabel?: React.ReactNode;
  pageSizeOptions?: readonly number[];
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const atFirst = safePage <= 1;
  const atLast = safePage >= totalPages || total === 0;

  const sizeOptions = pageSizeOptions.includes(pageSize as never)
    ? pageSizeOptions
    : ([...pageSizeOptions, pageSize].sort((a, b) => a - b) as readonly number[]);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-4 py-3 bg-[#f0f2f5] border-t border-[#e8ecf0] text-[13px] text-[#475467] shrink-0 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span>Hiển thị</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(parseInt(e.target.value, 10));
              onPageChange(1);
            }}
            className="appearance-none bg-white border border-[#d0d5dd] rounded-md pl-3 pr-8 py-1.5 text-[13px] outline-none cursor-pointer"
          >
            {sizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} dòng
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#98a2b3] pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={atFirst}
          onClick={() => onPageChange(1)}
          className="w-8 h-8 flex items-center justify-center rounded text-[#667085] disabled:opacity-35 cursor-pointer disabled:cursor-default bg-transparent border-0 hover:bg-white"
          title="Trang đầu"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={atFirst}
          onClick={() => onPageChange(safePage - 1)}
          className="w-8 h-8 flex items-center justify-center rounded text-[#667085] disabled:opacity-35 cursor-pointer disabled:cursor-default bg-transparent border-0 hover:bg-white"
          title="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[36px] h-8 px-2 flex items-center justify-center bg-white border border-[#d0d5dd] rounded-md font-semibold text-[#1a1a1a]">
          {safePage}
        </span>
        <button
          type="button"
          disabled={atLast}
          onClick={() => onPageChange(safePage + 1)}
          className="w-8 h-8 flex items-center justify-center rounded text-[#344054] disabled:opacity-35 cursor-pointer disabled:cursor-default bg-transparent border-0 hover:bg-white"
          title="Trang sau"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={atLast}
          onClick={() => onPageChange(totalPages)}
          className="w-8 h-8 flex items-center justify-center rounded text-[#344054] disabled:opacity-35 cursor-pointer disabled:cursor-default bg-transparent border-0 hover:bg-white"
          title="Trang cuối"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      <span className="text-[#475467]">
        {total === 0 ? (
          <>0 trong 0 {itemLabel}</>
        ) : (
          <>
            {from} - {to} trong {total.toLocaleString("vi-VN")} {itemLabel}
            {extraLabel ? <span className="text-[#98a2b3]"> {extraLabel}</span> : null}
          </>
        )}
      </span>
    </div>
  );
}
