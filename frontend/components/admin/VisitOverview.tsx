"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Info, RefreshCw, UserRound } from "lucide-react";
import { websiteApi } from "./website/api";

type Stats = { visits: number; visitors: number; trackingSince: string | null; updatedAt: string };
const vietnamDay = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
function initialRange() {
  const now = new Date();
  return { from: vietnamDay(new Date(now.getTime() - 29 * 86400_000)), to: vietnamDay(now) };
}
const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export function VisitOverview() {
  const [range, setRange] = useState(initialRange);
  const valid = Boolean(range.from && range.to && range.from <= range.to
    && (Date.parse(range.to) - Date.parse(range.from)) / 86400_000 <= 365);
  const query = useQuery({
    queryKey: ["admin-visits", range.from, range.to],
    queryFn: () => websiteApi<Stats>(`/api/shop/admin/visits?from=${range.from}&to=${range.to}`),
    enabled: valid, staleTime: 60_000, refetchInterval: 60_000,
  });
  const presets = [{ days: 1, label: "Hôm nay" }, { days: 7, label: "7 ngày" }, { days: 30, label: "30 ngày" }];
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Thống kê truy cập">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">Truy cập website</h2>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map(({ days, label }) => (
            <button key={days} type="button" onClick={() => {
              const now = new Date();
              setRange({ from: vietnamDay(new Date(now.getTime() - (days - 1) * 86400_000)), to: vietnamDay(now) });
            }} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#EAF3E8] hover:text-[#2D5A27] transition">{label}</button>
          ))}
          <input aria-label="Từ ngày" type="date" value={range.from} max={range.to} onChange={e => setRange({ ...range, from: e.target.value })} className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2D5A27] focus:outline-none" />
          <span className="text-slate-400">–</span>
          <input aria-label="Đến ngày" type="date" value={range.to} min={range.from} onChange={e => setRange({ ...range, to: e.target.value })} className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2D5A27] focus:outline-none" />
          <button aria-label="Làm mới thống kê" type="button" disabled={!valid || query.isFetching} onClick={() => void query.refetch()} className="rounded-lg p-2 text-slate-500 hover:bg-[#F0F5EE] hover:text-[#2D5A27] disabled:opacity-40 transition">
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="p-5">
        {!valid && <p role="alert" className="mb-3 text-sm text-red-600">Chọn khoảng ngày hợp lệ, tối đa 366 ngày.</p>}
        {query.isError && <p role="alert" className="mb-3 text-sm text-red-600">{query.error.message} <button onClick={() => void query.refetch()} className="underline">Thử lại</button></p>}
        <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
          {[
            { label: "Lượt truy cập", value: query.data?.visits, Icon: Eye, style: "bg-[#EAF3E8]", iconStyle: "bg-[#2D5A27]", hint: "Số phiên bắt đầu trong khoảng ngày chọn. Sau 30 phút không hoạt động, lần truy cập tiếp theo là phiên mới." },
            { label: "Người truy cập", value: query.data?.visitors, Icon: UserRound, style: "bg-[#F4F9F2]", iconStyle: "bg-emerald-600", hint: "Số mã trình duyệt duy nhất có phiên bắt đầu trong khoảng ngày chọn. Một người dùng nhiều thiết bị có thể được tính nhiều lần." },
          ].map(({ label, value, Icon, style, iconStyle, hint }) => (
            <div key={label} className={`flex items-center gap-3 rounded-xl px-5 py-6 ${style}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${iconStyle}`}><Icon className="h-6 w-6" /></span>
              <span className="text-sm font-medium text-slate-800 sm:text-base">{label}</span>
              <button type="button" title={hint} aria-label={hint} className="text-slate-500"><Info className="h-4 w-4" /></button>
              <strong className="ml-auto text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{valid && !query.isError && value !== undefined ? formatNumber(value) : "—"}</strong>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Theo giờ Việt Nam · Cập nhật mỗi phút · Không tính trang admin và bot nhận diện được.
          {query.data?.trackingSince ? ` Có dữ liệu từ ${new Date(query.data.trackingSince).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.` : query.isSuccess ? " Chưa ghi nhận phiên truy cập nào." : ""}
        </p>
      </div>
    </section>
  );
}
