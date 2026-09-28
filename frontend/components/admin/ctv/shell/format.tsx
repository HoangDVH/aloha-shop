"use client";

import React from "react";
import { Tag } from "antd";
import { COMMISSION_STATUS_LABEL } from "../shared/format";

export function changeTag(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) {
    return (
      <span className="text-[11px] font-semibold text-slate-300">—</span>
    );
  }
  const up = v >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        up ? "text-[#2D5A27]" : "text-rose-500"
      }`}
    >
      {up ? "↑" : "↓"} {Math.abs(v)}% so với tháng trước
    </span>
  );
}

export function shortMoney(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

export function dayLabel(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso.slice(5) || iso;
  return `${m[3]}/${m[2]}`;
}

export function expandDailySeries(
  range: { from: string; to: string } | string,
  data: Array<{ day: string; gmv: number; commission: number }>
) {
  const map = new Map(data.map((d) => [d.day, d]));
  const out: Array<{ day: string; gmv: number; commission: number }> = [];

  // Legacy: period YYYY-MM
  if (typeof range === "string") {
    const [y, m] = String(range || "").split("-").map(Number);
    if (!y || !m) return data;
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const day = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const hit = map.get(day);
      out.push(hit || { day, gmv: 0, commission: 0 });
    }
    return out;
  }

  const from = String(range.from || "");
  const to = String(range.to || "");
  const fm = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fm || !tm) return data;
  let cur = new Date(Number(fm[1]), Number(fm[2]) - 1, Number(fm[3]));
  const end = new Date(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]));
  while (cur.getTime() <= end.getTime()) {
    const day = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    const hit = map.get(day);
    out.push(hit || { day, gmv: 0, commission: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function niceAxisMax(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export function statusTag(s: string) {
  const map: Record<string, { color: string; label: string }> = {
    held: { color: "orange", label: COMMISSION_STATUS_LABEL.held },
    eligible: { color: "green", label: COMMISSION_STATUS_LABEL.eligible },
    billed: { color: "blue", label: COMMISSION_STATUS_LABEL.billed },
    paid_out: { color: "cyan", label: COMMISSION_STATUS_LABEL.paid_out },
    cancelled: { color: "red", label: COMMISSION_STATUS_LABEL.cancelled },
    flagged: { color: "magenta", label: COMMISSION_STATUS_LABEL.flagged },
  };
  const m = map[s] || { color: "default", label: COMMISSION_STATUS_LABEL[s] || s };
  return <Tag color={m.color}>{m.label}</Tag>;
}
