"use client";
import { useState } from "react";
import { chartAxis, chartNumber } from "@/lib/topProductChart";
import { moneyText, numberText, type BusinessOverviewData } from "@/lib/businessOverview";

export function SalesOverviewChart({ points, group }: { points: BusinessOverviewData["sales"]["points"]; group: "day" | "hour" }) {
  const [active, setActive] = useState<string | null>(null);
  const axis = chartAxis(Math.max(0, ...points.map(p => p.revenue)), false);
  const label = (key: string) => group === "hour" ? `${key}h` : `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  const selected = points.find(p => p.key === active);
  return <figure aria-label={`Biểu đồ doanh thu theo ${group === "hour" ? "giờ" : "ngày"}`} className="mt-4">
    <div className="mb-2 min-h-6 text-right text-xs text-slate-500" aria-live="polite">
      {selected ? `${label(selected.key)} · ${moneyText(selected.revenue)} · ${numberText(selected.orders)} đơn` : "Rê chuột, chạm hoặc dùng phím Tab để xem chi tiết"}
    </div>
    <div className="flex gap-3">
      <div aria-hidden="true" className="relative h-56 w-14 shrink-0 text-right text-[11px] text-slate-500">
        {axis.ticks.map(t => <span key={t} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(1 - t / axis.max) * 100}%` }}>{chartNumber(t, true)}</span>)}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="relative" style={{ minWidth: Math.max(240, points.length * 28) }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56" aria-hidden="true">
            {axis.ticks.map(t => <div key={t} className="absolute w-full border-t border-slate-100" style={{ top: `${(1 - t / axis.max) * 100}%` }} />)}
          </div>
          <div className="relative flex h-56 items-end justify-around gap-1">
            {points.map(point => <button key={point.key} type="button"
              aria-label={`${label(point.key)}: ${moneyText(point.revenue)}, ${point.orders} đơn`}
              title={`${label(point.key)}: ${moneyText(point.revenue)} · ${point.orders} đơn`}
              onFocus={() => setActive(point.key)} onMouseEnter={() => setActive(point.key)} onClick={() => setActive(point.key)}
              className="group flex h-full min-w-5 flex-1 items-end justify-center rounded-t outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              ><span className={`w-3/5 max-w-11 rounded-t-sm ${active === point.key ? "bg-blue-700" : "bg-[#0070f4]"}`}
                style={{ height: `${point.revenue / axis.max * 100}%`, minHeight: point.revenue > 0 ? 2 : 0 }} /></button>)}
          </div>
          <div aria-hidden="true" className="mt-2 flex justify-around gap-1 text-[10px] text-slate-500">
            {points.map((p, i) => <span key={p.key} className="min-w-5 flex-1 text-center">{i % Math.max(1, Math.ceil(points.length / 12)) === 0 ? label(p.key) : ""}</span>)}
          </div>
        </div>
      </div>
    </div>
    {!points.some(p => p.orders) && <p className="mt-3 text-center text-sm text-slate-500">Chưa có đơn hoàn thành, đã thanh toán trong kỳ.</p>}
    {group === "hour" && <p className="mt-3 text-xs text-slate-500">Cộng doanh thu cùng khung giờ của các ngày trong kỳ.</p>}
  </figure>;
}
