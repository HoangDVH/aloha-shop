"use client";

import { useMemo, useState } from "react";
import { Empty } from "antd";
import { formatVnd } from "../shared/format";

function shortMoney(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

function dayLabel(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso.slice(5) || iso;
  return `${m[3]}/${m[2]}`;
}

function expandDailySeries(
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

function niceAxisMax(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export function DailySpark({
  data,
  period,
  range,
}: {
  data: Array<{ day: string; gmv: number; commission: number }>;
  period?: string;
  range?: { from: string; to: string };
}) {
  const series = useMemo(
    () => expandDailySeries(range || period || "", data),
    [period, range, data]
  );
  const [hover, setHover] = useState<number | null>(null);

  const hasAny = series.some((d) => d.gmv > 0 || d.commission > 0);
  const totalGmv = useMemo(
    () => series.reduce((s, d) => s + (Number(d.gmv) || 0), 0),
    [series]
  );
  const totalHh = useMemo(
    () => series.reduce((s, d) => s + (Number(d.commission) || 0), 0),
    [series]
  );
  const peak = useMemo(() => {
    let best = series[0];
    for (const d of series) {
      if ((d.gmv || 0) > (best?.gmv || 0)) best = d;
    }
    return best;
  }, [series]);

  if (!hasAny) {
    return <Empty description="Chưa có doanh thu/hoa hồng theo ngày trong kỳ" />;
  }

  const W = 720;
  const H = 268;
  const pad = { top: 18, right: 48, bottom: 30, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxGmv = niceAxisMax(Math.max(...series.map((d) => d.gmv), 1));
  const maxHh = niceAxisMax(Math.max(...series.map((d) => d.commission), 1));
  const gmvTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxGmv);
  const hhTicks = [0, 0.5, 1].map((t) => t * maxHh);

  const n = series.length;
  const slot = innerW / Math.max(1, n);
  const barW = Math.max(3, Math.min(14, slot * 0.62));
  const xCenter = (i: number) => pad.left + slot * i + slot / 2;
  const yGmv = (v: number) => pad.top + innerH - (v / maxGmv) * innerH;
  const yHh = (v: number) => pad.top + innerH - (v / maxHh) * innerH;
  const baseY = pad.top + innerH;

  const hhLine = series
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yHh(d.commission)}`)
    .join(" ");

  const labelIdx = new Set<number>();
  const step = Math.max(1, Math.ceil((n - 1) / 6));
  for (let i = 0; i < n; i += step) labelIdx.add(i);
  labelIdx.add(n - 1);

  const tip = hover != null ? series[hover] : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="rounded-lg bg-[#F3F7F2] px-3 py-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Tổng DT</span>
          <span className="ml-2 text-[13px] font-extrabold text-[#2D5A27]">
            {formatVnd(totalGmv)}
          </span>
        </div>
        <div className="rounded-lg bg-[#FFF8EE] px-3 py-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Tổng HH</span>
          <span className="ml-2 text-[13px] font-extrabold text-[#c47a2c]">
            {formatVnd(totalHh)}
          </span>
        </div>
        {peak && peak.gmv > 0 ? (
          <div className="rounded-lg bg-slate-50 px-3 py-1.5">
            <span className="text-[11px] font-semibold text-slate-500">
              Ngày cao nhất
            </span>
            <span className="ml-2 text-[13px] font-extrabold text-[#1a2e1a]">
              {dayLabel(peak.day)} · {formatVnd(peak.gmv)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Doanh thu cột, hoa hồng đường theo ngày"
          onMouseLeave={() => setHover(null)}
        >
          {gmvTicks.map((t) => {
            const y = yGmv(t);
            return (
              <g key={`g-${t}`}>
                <line
                  x1={pad.left}
                  x2={W - pad.right}
                  y1={y}
                  y2={y}
                  stroke="#eef2ee"
                  strokeDasharray="3 4"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400"
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {shortMoney(t)}
                </text>
              </g>
            );
          })}
          {hhTicks.map((t) => {
            const y = yHh(t);
            return (
              <text
                key={`h-${t}`}
                x={W - pad.right + 8}
                y={y + 3}
                textAnchor="start"
                className="fill-[#c47a2c]"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {shortMoney(t)}
              </text>
            );
          })}

          {series.map((d, i) => {
            const h = Math.max(0, baseY - yGmv(d.gmv));
            const x = xCenter(i) - barW / 2;
            const active = hover === i;
            return (
              <rect
                key={`bar-${d.day}`}
                x={x}
                y={yGmv(d.gmv)}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
                fill={active ? "#1f4a1c" : "#2D5A27"}
                opacity={hover == null || active ? 1 : 0.35}
              >
                <title>
                  {dayLabel(d.day)} · DT {formatVnd(d.gmv)}
                </title>
              </rect>
            );
          })}

          <path
            d={hhLine}
            fill="none"
            stroke="#E8A017"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {series.map((d, i) =>
            d.commission > 0 || d.gmv > 0 ? (
              <circle
                key={`dot-${d.day}`}
                cx={xCenter(i)}
                cy={yHh(d.commission)}
                r={hover === i ? 4.5 : 3.2}
                fill="#fff"
                stroke="#c47a2c"
                strokeWidth={2}
              />
            ) : null
          )}

          {/* hit areas for hover */}
          {series.map((d, i) => (
            <rect
              key={`hit-${d.day}`}
              x={pad.left + slot * i}
              y={pad.top}
              width={slot}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              style={{ cursor: "crosshair" }}
            />
          ))}

          {hover != null ? (
            <line
              x1={xCenter(hover)}
              x2={xCenter(hover)}
              y1={pad.top}
              y2={baseY}
              stroke="#c5d6c3"
              strokeDasharray="3 3"
            />
          ) : null}

          {[...labelIdx].map((i) => (
            <text
              key={`x-${i}`}
              x={xCenter(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {dayLabel(series[i].day)}
            </text>
          ))}
        </svg>

        {tip && hover != null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[148px] rounded-lg border border-[#e4ebe3] bg-white px-3 py-2 shadow-lg"
            style={{
              left: `${Math.min(88, Math.max(8, (xCenter(hover) / W) * 100 - 10))}%`,
              top: 8,
            }}
          >
            <div className="text-[12px] font-bold text-[#1a2e1a]">
              {dayLabel(tip.day)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
              <span className="h-2 w-2 rounded-sm bg-[#2D5A27]" />
              DT{" "}
              <span className="font-extrabold text-[#1a2e1a]">
                {formatVnd(tip.gmv)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-[#E8A017]" />
              HH{" "}
              <span className="font-extrabold text-[#1a2e1a]">
                {formatVnd(tip.commission)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
        <span>Trục trái: Doanh thu (cột xanh)</span>
        <span className="text-[#c47a2c]">Trục phải: Hoa hồng (đường cam)</span>
      </div>
    </div>
  );

}
