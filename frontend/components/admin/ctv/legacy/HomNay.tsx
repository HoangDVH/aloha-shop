"use client";

import React from "react";
import { currentPeriod, formatVnd, type HubTab } from "./api";

export function HomNay({
  stats,
  onGo,
}: {
  stats: any;
  onGo: (t: HubTab) => void;
}) {
  const cards = [
    {
      label: "Chờ duyệt CTV",
      value: String(stats?.ctvPending ?? "—"),
      sub: "Tài khoản",
      go: "duyet-ctv" as HubTab,
      accent: "border-l-amber-400",
      valueCls: "text-amber-800",
    },
    {
      label: "Cảnh báo mới (7 ngày)",
      value: String(stats?.fraudNew ?? "—"),
      sub: "Cần xem",
      go: "canh-bao" as HubTab,
      accent: "border-l-rose-400",
      valueCls: "text-rose-700",
    },
    {
      label: "Hoa hồng đang giữ",
      value: formatVnd(Number(stats?.heldAmount) || 0),
      sub: `${stats?.heldCount || 0} dòng · chờ hết đổi trả`,
      go: "ky-thang" as HubTab,
      accent: "border-l-orange-400",
      valueCls: "text-orange-800",
    },
    {
      label: "Đủ điều kiện (chưa vào kỳ)",
      value: formatVnd(Number(stats?.eligibleAmount) || 0),
      sub: `${stats?.eligibleCount || 0} dòng`,
      go: "ky-thang" as HubTab,
      accent: "border-l-emerald-500",
      valueCls: "text-emerald-800",
    },
    {
      label: `Kỳ ${stats?.currentPeriod || currentPeriod()}`,
      value:
        stats?.currentBillStatus === "locked"
          ? "Đã chốt"
          : stats?.currentBillStatus === "paid"
            ? "Đã chi"
            : "Chưa chốt",
      sub: "Bill tháng AMS",
      go: "ky-thang" as HubTab,
      accent: "border-l-sky-400",
      valueCls: "text-sky-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onGo(c.go)}
          className={`flex min-h-[108px] flex-col rounded-xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow ${c.accent}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {c.label}
          </div>
          <div
            className={`mt-2 text-[22px] font-bold leading-none tracking-tight tabular-nums ${c.valueCls}`}
          >
            {c.value}
          </div>
          <div className="mt-auto pt-3 text-[12px] leading-snug text-slate-500">{c.sub}</div>
        </button>
      ))}
    </div>
  );
}
