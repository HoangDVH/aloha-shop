"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { websiteApi } from "./website/api";
import { TopChartSelect } from "./TopChartSelect";
import { chartAxis, chartNumber, topChartRange, type TopPeriod } from "@/lib/topProductChart";

type Row = { ma: string; name: string; unit: string; value: number; revenue?: number; quantity?: number };
type Result = { items: Row[]; updatedAt: string; trackingSince?: string | null; excludedUnresolvedReturns?: number };
const periods = [
  { value: "today", label: "Hôm nay" }, { value: "yesterday", label: "Hôm qua" }, { value: "week", label: "7 ngày qua" },
  { value: "month", label: "Tháng này" }, { value: "previousMonth", label: "Tháng trước" },
  { value: "30days", label: "30 ngày qua" }, { value: "custom", label: "Tùy chọn" },
];

function ChartCard({ kind }: { kind: "sales" | "views" }) {
  const [metric, setMetric] = useState(kind === "sales" ? "revenue" : "views");
  const [period, setPeriod] = useState<TopPeriod>("month");
  const [custom, setCustom] = useState(() => topChartRange("month"));
  const range = period === "custom" ? custom : topChartRange(period);
  const valid = Boolean(range.from && range.to && range.from <= range.to && Date.parse(range.to) - Date.parse(range.from) <= 365 * 86400_000);
  const title = kind === "sales" ? "Top 10 hàng bán chạy" : "Top 10 sản phẩm được xem nhiều";
  const query = useQuery({ queryKey: ["admin-top-products", kind, metric, range.from, range.to],
    queryFn: ({ signal }) => websiteApi<Result>(`/api/shop/admin/top-products?kind=${kind}&metric=${metric}&from=${range.from}&to=${range.to}`, { signal }),
    enabled: valid, staleTime: 60_000, refetchInterval: 60_000 });
  const items = valid && !query.isError ? query.data?.items || [] : [];
  const money = metric === "revenue", axis = chartAxis(Math.max(0, ...items.map(p => p.value)), kind === "views");
  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-white px-4 py-5 shadow-sm sm:px-6" aria-label={title}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <TopChartSelect label={`Cách xếp hạng ${title}`} value={metric} onChange={setMetric} options={kind === "sales"
            ? [{ value: "revenue", label: "Theo doanh thu thuần" }, { value: "quantity", label: "Theo số lượng" }]
            : [{ value: "views", label: "Theo lượt xem" }, { value: "visitors", label: "Theo người xem" }]} />
          <TopChartSelect label={`Thời gian ${title}`} value={period} options={periods} onChange={v => setPeriod(v as TopPeriod)} />
        </div>
      </div>
      {period === "custom" && <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <input type="date" aria-label={`Từ ngày ${title}`} value={custom.from} max={custom.to} onChange={e => setCustom({ ...custom, from: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 focus:border-[#2D5A27] focus:outline-none" />
        <span>–</span><input type="date" aria-label={`Đến ngày ${title}`} value={custom.to} min={custom.from} onChange={e => setCustom({ ...custom, to: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 focus:border-[#2D5A27] focus:outline-none" />
      </div>}
      {!valid ? <div role="alert" className="flex min-h-[420px] items-center justify-center text-sm text-red-600">Chọn khoảng ngày hợp lệ, tối đa 366 ngày.</div>
        : query.isError ? <div role="alert" className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-sm text-slate-500">
          <span>{query.error.message}</span><button type="button" onClick={() => void query.refetch()} className="rounded-lg bg-[#EAF3E8] px-4 py-2 font-semibold text-[#2D5A27] hover:bg-[#d8ebd5] transition">Thử lại</button>
        </div> : query.isPending ? <div aria-label="Đang tải biểu đồ" role="status" className="min-h-[420px] space-y-5">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="motion-safe:animate-pulse"><div className="mb-2 h-3 w-3/4 rounded bg-slate-100" /><div className="h-6 rounded bg-slate-100" style={{ width: `${85 - i * 7}%` }} /></div>)}
        </div> : !items.length ? <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
          <p>{kind === "sales" ? "Chưa có đơn shop hoàn tất và đã thanh toán trong khoảng thời gian này." : "Chưa có lượt xem sản phẩm được ghi nhận trong khoảng thời gian này."}</p>
          {kind === "views" && !query.data?.trackingSince ? <p className="text-xs">Số liệu bắt đầu từ khi bật theo dõi lượt xem.</p> : null}
        </div> : <figure aria-label={`${title}: ${metric === "revenue" ? "doanh thu thuần" : metric === "quantity" ? "số lượng" : metric === "views" ? "lượt xem" : "người xem"}`}>
          <div className="relative ml-2 mr-10 sm:ml-4 sm:mr-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {axis.ticks.map((tick, i) => <div key={tick} className={`absolute bottom-0 top-0 border-l ${i ? "border-slate-200" : "border-slate-400"}`} style={{ left: `${tick / axis.max * 100}%` }} />)}
            </div>
            <ol className="relative min-h-[420px] py-0.5">
              {items.map(row => <li key={row.ma} className="mb-3 last:mb-0" title={`${row.name} (${row.unit || row.ma}) — ${new Intl.NumberFormat("vi-VN").format(row.value)}${money ? "đ" : ""}`}>
                <p className="mb-1 truncate pl-2 text-[13px] font-medium uppercase leading-5 text-slate-500">{row.name}{row.unit ? ` (${row.unit})` : ""}</p>
                <div className="relative h-[26px]">
                  <div className="h-full rounded-r bg-[#2D5A27] transition-[width] duration-300 hover:bg-[#1b5e20] motion-reduce:transition-none" style={{ width: `${row.value / axis.max * 100}%` }} />
                  <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-xs font-semibold text-[#2D5A27]" style={{ left: `${row.value / axis.max * 100}%` }}>{chartNumber(row.value, money)}</span>
                </div>
              </li>)}
            </ol>
            <div aria-hidden="true" className="relative mt-3 h-5 text-[11px] text-slate-500">
              {axis.ticks.map(tick => <span key={tick} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${tick / axis.max * 100}%` }}>{chartNumber(tick, money)}</span>)}
            </div>
          </div>
        </figure>}
      <div className="mt-auto flex items-start justify-between gap-3 pt-5 text-[11px] leading-5 text-slate-400">
        <p>{kind === "sales" ? "Đơn website đã hoàn tất, đã thanh toán · Không gồm phí giao hàng và quà tặng · Trừ hàng hoàn theo dữ liệu hiện tại."
          : "Mỗi phiên xem cùng sản phẩm tính 1 lần · Người xem phân biệt theo trình duyệt · Không tính bot nhận diện được."}
          {kind === "views" && query.data?.trackingSince ? ` Có dữ liệu từ ${new Date(query.data.trackingSince).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.` : ""}
          {!!query.data?.excludedUnresolvedReturns && ` ${query.data.excludedUnresolvedReturns} đơn hoàn chưa có chi tiết được loại khỏi thống kê.`}
        </p>
        <button type="button" aria-label={`Làm mới ${title}`} disabled={!valid || query.isFetching} onClick={() => void query.refetch()} className="shrink-0 rounded p-1 hover:bg-[#F0F5EE] hover:text-[#2D5A27] disabled:opacity-40 transition"><RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} /></button>
      </div>
    </section>
  );
}

export function TopProductsOverview() {
  return <div className="grid gap-5 xl:grid-cols-2"><ChartCard kind="sales" /><ChartCard kind="views" /></div>;
}
