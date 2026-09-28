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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600">
            <span className="text-slate-400">Trạng thái:</span>
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabId)}
              className="border-0 bg-transparent pr-1 font-bold text-[#1a2e1a] outline-none"
              aria-label="Lọc trạng thái"
            >
              {statusOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <AdminDateRangePicker
            value={dateRange}
            allowClear
            onChange={setDateRange}
            placeholder="Thời gian: Tất cả"
          />
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A27] px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#244a20]"
          >
            <UserPlus size={15} />
            Thêm cộng tác viên
          </button>
          {onConfigClick ? (
            <button
              type="button"
              onClick={onConfigClick}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold ${
                configOpen
                  ? "border-emerald-600 bg-emerald-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Settings2 size={15} />
              Cấu hình CTV
            </button>
          ) : null}
        </div>
        {configPanel}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
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
  );
}
