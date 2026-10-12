"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Banknote, ShoppingBag, ReceiptText, RefreshCw } from "lucide-react";
import { websiteApi } from "./website/api";
import { TopChartSelect } from "./TopChartSelect";
import { SalesOverviewChart } from "./SalesOverviewChart";
import { ConversionOverview } from "./ConversionOverview";
import { topChartRange, type TopPeriod } from "@/lib/topProductChart";
import { changeText, moneyText, numberText, type BusinessOverviewData } from "@/lib/businessOverview";

const options = [{ value: "today", label: "Hôm nay" }, { value: "week", label: "7 ngày" },
  { value: "30days", label: "30 ngày" }, { value: "custom", label: "Tùy chọn" }];
export function BusinessOverview() {
  const [period, setPeriod] = useState<TopPeriod>("today");
  const [custom, setCustom] = useState(() => topChartRange("today"));
  const [compare, setCompare] = useState(true);
  const [group, setGroup] = useState<"day" | "hour">("hour");
  const range = period === "custom" ? custom : topChartRange(period);
  const valid = Boolean(range.from && range.to && range.from <= range.to
    && (Date.parse(range.to) - Date.parse(range.from)) / 86400_000 <= 365);
  const query = useQuery({ queryKey: ["admin-business-overview", range.from, range.to, group],
    queryFn: () => websiteApi<BusinessOverviewData>(`/api/shop/admin/business-overview?from=${range.from}&to=${range.to}&group=${group}`),
    enabled: valid, staleTime: 60_000, refetchInterval: 60_000 });
  const data = valid && !query.isError ? query.data : undefined;
  const metrics = [{ key: "revenue" as const, label: "Doanh thu", Icon: Banknote, money: true },
    { key: "orders" as const, label: "Đơn hoàn thành", Icon: ShoppingBag, money: false },
    { key: "average" as const, label: "Trung bình / đơn", Icon: ReceiptText, money: true }];
  return <div className="mb-6 space-y-5" aria-busy={query.isFetching}>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Kết quả bán hàng">
      {/* Header card tích hợp: Tiêu đề bên trái, bộ lọc điều khiển bên phải */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">Kết quả bán hàng{period === "today" ? " hôm nay" : ""}</h2>
          <Link href="/admin/don-hang-web" className="text-xs font-medium text-blue-600 hover:underline">Xem đơn shop →</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs sm:text-sm text-slate-600 select-none">
            <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} className="h-4 w-4 accent-blue-600 rounded" />
            <span>So với kỳ trước</span>
          </label>
          <TopChartSelect label="Khoảng thời gian bán hàng và chuyển đổi" value={period} options={options} onChange={v => {
            if (v === "custom") setCustom(range);
            setPeriod(v as TopPeriod); setGroup(v === "today" ? "hour" : "day");
          }} />
          <button type="button" aria-label="Làm mới bán hàng và chuyển đổi" disabled={!valid || query.isFetching} onClick={() => void query.refetch()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition">
            <RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      {period === "custom" && <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-xs text-slate-500">
        <label>Từ ngày <input type="date" value={custom.from} max={custom.to} onChange={e => setCustom({ ...custom, from: e.target.value })} className="ml-2 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700" /></label>
        <label>Đến ngày <input type="date" value={custom.to} min={custom.from} onChange={e => setCustom({ ...custom, to: e.target.value })} className="ml-2 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700" /></label>
      </div>}
      {!valid && <p role="alert" className="mt-3 text-sm text-red-600">Chọn khoảng ngày hợp lệ, tối đa 366 ngày.</p>}
      {query.isError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">{query.error.message} <button type="button" onClick={() => void query.refetch()} className="ml-2 underline">Thử lại</button></p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3" aria-live="polite">
        {metrics.map(({ key, label, Icon, money }) => {
          const current = data?.sales.summary[key], previous = data?.sales.previous[key];
          const change = current !== undefined && previous !== undefined ? changeText(current, previous) : null;
          return <div key={key} className="rounded-xl bg-slate-50 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm text-slate-600"><Icon size={18} className="text-blue-600" />{label}</div>
            <strong className="mt-3 block break-words text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">{current === undefined ? "—" : money ? moneyText(current) : `${numberText(current)} đơn`}</strong>
            {compare && <p className={`mt-2 text-xs ${change?.direction === 1 ? "text-emerald-600" : change?.direction === -1 ? "text-red-500" : "text-slate-500"}`}>{change?.text ?? (query.isLoading ? "Đang tải dữ liệu…" : "Chưa có dữ liệu so sánh")}</p>}
          </div>;
        })}
      </div>
      {compare && data && <p className="mt-3 text-xs text-slate-500">So với {data.sales.previousFrom.split("-").reverse().join("/")} – {data.sales.previousTo.split("-").reverse().join("/")}{data.sales.partialComparison ? ", đến cùng thời điểm trong ngày" : ""}.</p>}
      <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-700">Doanh thu {data ? <span className="ml-2 rounded-lg bg-blue-50 px-2 py-1 text-blue-600">{moneyText(data.sales.summary.revenue)}</span> : null}</h3>
        <div className="flex rounded-lg bg-slate-100 p-1">{[{ key: "day" as const, label: "Theo ngày" }, { key: "hour" as const, label: "Theo giờ" }].map(tab => <button key={tab.key} type="button" aria-pressed={group === tab.key} onClick={() => setGroup(tab.key)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${group === tab.key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>{tab.label}</button>)}</div>
      </div>
      {data ? <SalesOverviewChart points={data.sales.points} group={group} /> : <div className="flex h-64 items-center justify-center text-sm text-slate-400">{query.isLoading ? "Đang tải kết quả bán hàng…" : "Chưa hiển thị được biểu đồ"}</div>}
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Đơn website đã hoàn thành và đã thanh toán · Tính theo ngày hoàn thành (đơn cũ thiếu ngày này dùng ngày tạo) · Không gồm phí vận chuyển, quà tặng, đơn test và đơn hủy.
        Chưa khấu trừ giá trị trả hàng nên chưa phải doanh thu thuần. Giờ Việt Nam · Cập nhật mỗi phút.</p>
    </section>
    <ConversionOverview data={data?.funnel} compare={compare} previousStart={data?.sales.previousFrom} />
  </div>;
}
