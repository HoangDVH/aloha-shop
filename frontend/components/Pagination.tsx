"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pages,
  total,
}: {
  page: number;
  pages: number;
  total: number;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  if (pages <= 1) return null;

  const hrefFor = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const windowPages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) windowPages.push(i);

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold ${
          page <= 1
            ? "pointer-events-none border-slate-200 text-slate-300"
            : "border-[#D5E3D0] text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        }`}
      >
        <ChevronLeft size={16} /> Trước
      </Link>

      {start > 1 && (
        <>
          <Link
            href={hrefFor(1)}
            className="rounded-md border border-[#D5E3D0] px-3 py-2 text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
          >
            1
          </Link>
          {start > 2 && <span className="text-slate-400">…</span>}
        </>
      )}

      {windowPages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          className={`min-w-10 rounded-md px-3 py-2 text-center text-sm font-bold ${
            p === page
              ? "bg-[var(--aloha-green)] text-white"
              : "border border-[#D5E3D0] text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
          }`}
        >
          {p}
        </Link>
      ))}

      {end < pages && (
        <>
          {end < pages - 1 && <span className="text-slate-400">…</span>}
          <Link
            href={hrefFor(pages)}
            className="rounded-md border border-[#D5E3D0] px-3 py-2 text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
          >
            {pages}
          </Link>
        </>
      )}

      <Link
        href={hrefFor(Math.min(pages, page + 1))}
        aria-disabled={page >= pages}
        className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold ${
          page >= pages
            ? "pointer-events-none border-slate-200 text-slate-300"
            : "border-[#D5E3D0] text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
        }`}
      >
        Sau <ChevronRight size={16} />
      </Link>

      <span className="w-full text-center text-xs text-slate-500 sm:w-auto sm:ml-2">
        Trang {page}/{pages} · {total} SP
      </span>
    </div>
  );
}
