"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/** Khối pulse — nền xám nhạt kiểu sàn TMĐT */
export function Skel({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#e8eee8] ${className}`}
      style={style}
      aria-hidden
    />
  );
}

/** Indicator nhỏ khi refetch — giữ data cũ trên màn */
export function AdminRefreshingBadge({
  show,
  className = "",
}: {
  show: boolean;
  className?: string;
}) {
  if (!show) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#E8EFE4] px-2.5 py-1 text-[11px] font-bold text-[#2D5A27] ${className}`}
    >
      <RefreshCw size={12} className="animate-spin" />
      Đang cập nhật…
    </span>
  );
}

/** 1 KPI card skeleton — khớp layout icon trái + title / số / trend */
export function AdminKpiCardSkeleton() {
  return (
    <div className="flex h-full min-h-[118px] flex-col rounded-xl border border-[#e8ece8] bg-white p-4">
      <div className="flex items-center gap-2.5">
        <Skel className="h-9 w-9 shrink-0 rounded-lg" />
        <Skel className="h-3 w-24" />
      </div>
      <Skel className="mt-3 h-6 w-28" />
      <Skel className="mt-auto h-3 w-32 pt-2.5" />
    </div>
  );
}

export function AdminKpiRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      aria-busy
      aria-label="Đang tải chỉ số"
    >
      {Array.from({ length: count }, (_, i) => (
        <AdminKpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Khối chart / card lớn */
export function AdminChartSkeleton({
  height = 260,
  title,
}: {
  height?: number;
  title?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-[#e4ebe3] bg-white p-4 shadow-sm"
      aria-busy
      aria-label="Đang tải biểu đồ"
    >
      {title !== false ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skel className="h-4 w-48" />
          <Skel className="h-3 w-28" />
        </div>
      ) : null}
      <div className="mb-3 flex gap-2">
        <Skel className="h-6 w-24 rounded-lg" />
        <Skel className="h-6 w-24 rounded-lg" />
        <Skel className="h-6 w-32 rounded-lg" />
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-1.5 px-1 pb-6">
          {Array.from({ length: 16 }, (_, i) => (
            <Skel
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${28 + ((i * 17) % 55)}%` }}
            />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-2.5 w-8" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Vòng chuyển đổi / card phụ */
export function AdminDonutSkeleton() {
  return (
    <div
      className="rounded-xl border border-[#e4ebe3] bg-white p-4 shadow-sm"
      aria-busy
    >
      <Skel className="mb-4 h-4 w-36" />
      <div className="flex items-center gap-4">
        <Skel className="h-[152px] w-[152px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skel className="h-2.5 w-full rounded-full" />
          <Skel className="h-2.5 w-[80%] rounded-full" />
          <Skel className="h-8 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Hàng trong bảng */
export function AdminTableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-[#eef2ee]">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-3 py-3">
          <Skel
            className={`h-3.5 ${i === 0 ? "w-32" : i === cols - 1 ? "w-16 ml-auto" : "w-20"}`}
          />
        </td>
      ))}
    </tr>
  );
}

export function AdminTableSkeleton({
  rows = 8,
  cols = 6,
  headers,
}: {
  rows?: number;
  cols?: number;
  headers?: string[];
}) {
  const colCount = headers?.length || cols;
  return (
    <div
      className="overflow-hidden rounded-xl border border-[#e4ebe3] bg-white shadow-sm"
      aria-busy
      aria-label="Đang tải bảng"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e4ebe3] bg-[#f3f7f2] text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {headers
                ? headers.map((h) => (
                    <th key={h} className="px-3 py-3">
                      {h}
                    </th>
                  ))
                : Array.from({ length: colCount }, (_, i) => (
                    <th key={i} className="px-3 py-3">
                      <Skel className="h-3 w-16" />
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <AdminTableRowSkeleton key={i} cols={colCount} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** List hàng kiểu Top CTV */
export function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#eef2ee]" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-3">
          <Skel className="h-7 w-7 rounded-full" />
          <Skel className="h-9 w-9 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skel className="h-3.5 w-36" />
            <Skel className="h-3 w-20" />
          </div>
          <Skel className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Overview CTV: KPI + chart + conversion */
export function CtvOverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Đang tải tổng quan CTV">
      <AdminKpiRowSkeleton count={6} />
      <div className="grid gap-3.5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3.5">
          <AdminChartSkeleton height={240} />
          <div className="rounded-xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <Skel className="h-4 w-44" />
              <Skel className="h-3 w-20" />
            </div>
            <AdminListSkeleton rows={5} />
          </div>
        </div>
        <AdminDonutSkeleton />
      </div>
    </div>
  );
}

/** Chi tiết CTV */
export function CtvDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Đang tải chi tiết CTV">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skel className="h-6 w-40" />
          <Skel className="h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <Skel className="h-9 w-44 rounded-lg" />
          <Skel className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <Skel className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skel className="h-4 w-40" />
              <Skel className="h-3 w-28" />
              <Skel className="h-3 w-36" />
            </div>
          </div>
        </div>
        <AdminKpiRowSkeleton count={4} />
      </div>
      <AdminTableSkeleton rows={6} cols={5} />
    </div>
  );
}

/** Toolbar + bảng list */
export function AdminListPageSkeleton({
  kpiCount = 4,
  cols = 6,
  rows = 10,
}: {
  kpiCount?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-4" aria-busy aria-label="Đang tải danh sách">
      {kpiCount > 0 ? <AdminKpiRowSkeleton count={kpiCount} /> : null}
      <div className="flex flex-wrap gap-2">
        <Skel className="h-9 min-w-[220px] flex-1 rounded-lg sm:max-w-md" />
        <Skel className="h-9 w-36 rounded-lg" />
        <Skel className="h-9 w-40 rounded-lg" />
        <Skel className="h-9 w-36 rounded-lg" />
      </div>
      <AdminTableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

/** Wrapper: lần đầu skeleton; refetch thì children + badge */
export function AdminQueryGate({
  isLoading,
  isFetching,
  hasData,
  skeleton,
  children,
  className = "",
}: {
  isLoading: boolean;
  isFetching?: boolean;
  hasData: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (isLoading && !hasData) return <>{skeleton}</>;
  return (
    <div className={`relative ${className}`}>
      {isFetching && hasData ? (
        <div className="pointer-events-none absolute right-0 top-0 z-10 -translate-y-1">
          <AdminRefreshingBadge show />
        </div>
      ) : null}
      {children}
    </div>
  );
}
