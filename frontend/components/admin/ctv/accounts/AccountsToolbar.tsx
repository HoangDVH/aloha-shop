import React from "react";
import { Search, Settings2, UserPlus } from "lucide-react";
import {
  AdminDateRangePicker,
  type AdminDateRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import type { AccountsScope, TabId } from "./accountsApi";

export function AccountsToolbar({
  scope,
  tab,
  setTab,
  tabs,
  statusOptions,
  q,
  setQ,
  searchPlaceholder,
  dateRange,
  setDateRange,
  onOpenAdd,
  onConfigClick,
  configOpen,
  configPanel,
}: {
  scope: AccountsScope;
  tab: TabId;
  setTab: (t: TabId) => void;
  tabs: readonly { id: TabId; label: string; count?: number }[];
  statusOptions: readonly { id: TabId; label: string }[];
  q: string;
  setQ: (v: string) => void;
  searchPlaceholder: string;
  dateRange: AdminDateRange | null;
  setDateRange: (r: AdminDateRange | null) => void;
  onOpenAdd: () => void;
  onConfigClick?: () => void;
  configOpen?: boolean;
  configPanel?: React.ReactNode;
}) {
  if (scope === "ctv") {
    return (
      <>
        {/* 1A. TOOLBAR TRÊN DESKTOP (>= md: CHUẨN SHOPIFY / STRIPE) */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Thanh tìm kiếm nguyên khối */}
            <div className="relative w-72 shrink-0">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs outline-none focus:bg-white focus:border-[#2D5A27] transition"
              />
            </div>

            {/* Dải Tabs trạng thái dạng Segmented trực quan */}
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
              {statusOptions.map((o) => {
                const active = tab === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setTab(o.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      active
                        ? "bg-white text-[#2D5A27] shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AdminDateRangePicker
              value={dateRange}
              allowClear
              onChange={setDateRange}
              placeholder="Thời gian: Tất cả"
            />
          </div>
        </div>

        {/* 1B. TOOLBAR GỌN GÀNG TRÊN MOBILE (< md: CHUẨN IOS / SHOPEE) */}
        <div className="md:hidden space-y-2.5">
          {/* Hàng 1: Nút Thao tác & Bộ lọc thời gian */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <AdminDateRangePicker
                value={dateRange}
                allowClear
                onChange={setDateRange}
                placeholder="Thời gian: Tất cả"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onOpenAdd}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2D5A27] px-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#244a20] active:scale-95 transition"
              >
                <UserPlus size={14} />
                <span>Thêm CTV</span>
              </button>
              {onConfigClick ? (
                <button
                  type="button"
                  onClick={onConfigClick}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition active:scale-95 ${
                    configOpen
                      ? "border-emerald-600 bg-emerald-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  title="Cấu hình CTV"
                  aria-label="Cấu hình CTV"
                >
                  <Settings2 size={15} />
                </button>
              ) : null}
            </div>
          </div>

          {/* Hàng 2: Thanh tìm kiếm nguyên khối */}
          <div className="relative w-full">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs outline-none focus:bg-white focus:border-[#2D5A27] transition"
            />
          </div>

          {/* Hàng 3: Dải Tabs gạch chân lướt ngang mượt mà */}
          <div className="flex items-stretch border-b border-slate-200 -mx-1 px-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {statusOptions.map((o) => {
              const isActive = tab === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setTab(o.id)}
                  className={`relative py-2 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-[#2D5A27]"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span>{o.label}</span>
                  {isActive ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#2D5A27]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {configPanel}
      </>
    );
  }

  return (
    <>
      {/* TOOLBAR DESKTOP CHO KHÁCH HÀNG / TẤT CẢ (>= md) */}
      <div className="hidden md:flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t.id
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
            {t.count != null ? <span className="ml-1 opacity-80">({t.count})</span> : null}
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* TOOLBAR MOBILE CHO KHÁCH HÀNG / TẤT CẢ (< md) */}
      <div className="md:hidden space-y-2.5">
        <div className="relative w-full">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs outline-none focus:bg-white focus:border-[#2D5A27] transition"
          />
        </div>

        <div className="flex items-stretch border-b border-slate-200 -mx-1 px-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative py-2 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-[#2D5A27]"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>{t.label}</span>
                {t.count != null ? <span className="ml-1 opacity-80">({t.count})</span> : null}
                {isActive ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#2D5A27]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
