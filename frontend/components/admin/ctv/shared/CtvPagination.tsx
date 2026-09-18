"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

function pageItems(current: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  // Mockup: < 1 2 3 4 5 … >
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }
  if (current >= totalPages - 3) {
    return [
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", totalPages];
}

const btnBase =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] font-semibold transition disabled:cursor-default disabled:opacity-40";

const btnIdle = `${btnBase} border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f3f4f6]`;
const btnActive = `${btnBase} border border-[#2D5A27] bg-[#2D5A27] text-white`;

/** Phân trang CTV — nút vuông bo góc, trang active xanh đậm (#2D5A27) */
export function CtvPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = "",
  showTotal = true,
  itemLabel = "dòng",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  showTotal?: boolean;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize)) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const atFirst = safePage <= 1;
  const atLast = safePage >= totalPages || total === 0;
  const items = pageItems(safePage, totalPages);

  if (total <= pageSize && totalPages <= 1) {
    return showTotal ? (
      <div className={`flex items-center gap-3 px-1 py-2 ${className}`}>
        <span className="text-[12px] text-slate-500">
          Tổng cộng: {total.toLocaleString("vi-VN")} {itemLabel}
        </span>
      </div>
    ) : null;
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-1 py-3 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={atFirst}
          aria-label="Trang trước"
          onClick={() => onPageChange(safePage - 1)}
          className={btnIdle}
        >
          <ChevronLeft size={16} />
        </button>
        {items.map((it, idx) =>
          it === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className={`${btnIdle} pointer-events-none select-none`}
            >
              …
            </span>
          ) : (
            <button
              key={it}
              type="button"
              aria-current={it === safePage ? "page" : undefined}
              onClick={() => onPageChange(it)}
              className={it === safePage ? btnActive : btnIdle}
            >
              {it}
            </button>
          )
        )}
        <button
          type="button"
          disabled={atLast}
          aria-label="Trang sau"
          onClick={() => onPageChange(safePage + 1)}
          className={btnIdle}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {showTotal ? (
        <span className="text-[12px] font-semibold text-slate-500">
          Tổng cộng: {total.toLocaleString("vi-VN")} {itemLabel}
        </span>
      ) : null}
    </div>
  );
}
