"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function CatalogPagination({
  page,
  pages,
  onPageChange,
}: {
  page: number;
  pages: number;
  onPageChange: (p: number) => void;
}) {
  const pageNums = useMemo(() => {
    const maxBtn = 5;
    let start = Math.max(1, page - Math.floor(maxBtn / 2));
    let end = Math.min(pages, start + maxBtn - 1);
    start = Math.max(1, end - maxBtn + 1);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, pages]);

  if (pages <= 1) return null;

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
      aria-label="Phân trang"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--aloha-line)] bg-white px-3 text-sm font-bold text-[var(--aloha-green)] disabled:opacity-40"
      >
        <ChevronLeft size={16} /> Trước
      </button>
      {pageNums[0] > 1 && (
        <>
          <button
            type="button"
            onClick={() => onPageChange(1)}
            className="h-9 min-w-9 rounded-lg border border-[var(--aloha-line)] bg-white text-sm font-bold text-[var(--aloha-green)]"
          >
            1
          </button>
          {pageNums[0] > 2 && <span className="px-1 text-slate-400">…</span>}
        </>
      )}
      {pageNums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPageChange(n)}
          className={`h-9 min-w-9 rounded-lg text-sm font-bold ${
            n === page
              ? "bg-[var(--aloha-green)] text-white"
              : "border border-[var(--aloha-line)] bg-white text-[var(--aloha-green)]"
          }`}
        >
          {n}
        </button>
      ))}
      {pageNums[pageNums.length - 1] < pages && (
        <>
          {pageNums[pageNums.length - 1] < pages - 1 && (
            <span className="px-1 text-slate-400">…</span>
          )}
          <button
            type="button"
            onClick={() => onPageChange(pages)}
            className="h-9 min-w-9 rounded-lg border border-[var(--aloha-line)] bg-white text-sm font-bold text-[var(--aloha-green)]"
          >
            {pages}
          </button>
        </>
      )}
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--aloha-line)] bg-white px-3 text-sm font-bold text-[var(--aloha-green)] disabled:opacity-40"
      >
        Sau <ChevronRight size={16} />
      </button>
    </nav>
  );
}
