"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export type AdminDateRange = {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

export type AdminDatePreset =
  | "last_7d"
  | "last_30d"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "custom";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date | null {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatYmdVi(s: string): string {
  const d = parseYmd(s);
  if (!d) return s;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function rangeForPreset(
  preset: Exclude<AdminDatePreset, "custom">,
  now = new Date()
): AdminDateRange {
  const today = startOfDay(now);
  if (preset === "last_7d") {
    return { from: toYmd(addDays(today, -6)), to: toYmd(today) };
  }
  if (preset === "last_30d") {
    return { from: toYmd(addDays(today, -29)), to: toYmd(today) };
  }
  if (preset === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  if (preset === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  if (preset === "this_quarter") {
    const q = Math.floor(today.getMonth() / 3);
    const from = new Date(today.getFullYear(), q * 3, 1);
    const to = new Date(today.getFullYear(), q * 3 + 3, 0);
    return { from: toYmd(from), to: toYmd(to) };
  }
  // last_quarter
  const q = Math.floor(today.getMonth() / 3) - 1;
  const y = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
  const qq = (q + 4) % 4;
  const from = new Date(y, qq * 3, 1);
  const to = new Date(y, qq * 3 + 3, 0);
  return { from: toYmd(from), to: toYmd(to) };
}

export function defaultThisMonthRange(now = new Date()): AdminDateRange {
  return rangeForPreset("this_month", now);
}

function detectPreset(range: AdminDateRange): AdminDatePreset {
  const keys: Exclude<AdminDatePreset, "custom">[] = [
    "last_7d",
    "last_30d",
    "this_month",
    "last_month",
    "this_quarter",
    "last_quarter",
  ];
  for (const k of keys) {
    const r = rangeForPreset(k);
    if (r.from === range.from && r.to === range.to) return k;
  }
  return "custom";
}

const PRESETS: Array<{ id: Exclude<AdminDatePreset, "custom">; label: string }> = [
  { id: "last_7d", label: "7 ngày qua" },
  { id: "last_30d", label: "30 ngày qua" },
  { id: "this_month", label: "Tháng này" },
  { id: "last_month", label: "Tháng trước" },
  { id: "this_quarter", label: "Quý này" },
  { id: "last_quarter", label: "Quý trước" },
];

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function monthMatrix(year: number, month0: number): Array<Array<Date | null>> {
  const first = new Date(year, month0, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month0, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function inRange(day: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false;
  const t = day.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function MonthGrid({
  year,
  month0,
  draftFrom,
  draftTo,
  onPick,
}: {
  year: number;
  month0: number;
  draftFrom: Date | null;
  draftTo: Date | null;
  onPick: (d: Date) => void;
}) {
  const rows = monthMatrix(year, month0);
  const a = draftFrom && draftTo && draftFrom.getTime() > draftTo.getTime() ? draftTo : draftFrom;
  const b = draftFrom && draftTo && draftFrom.getTime() > draftTo.getTime() ? draftFrom : draftTo;

  return (
    <div className="min-w-[240px]">
      <div className="mb-2 text-center text-[13px] font-bold text-[#1a2e1a]">
        Tháng {month0 + 1} - {year}
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {rows.flatMap((row, ri) =>
          row.map((cell, ci) => {
            if (!cell) {
              return <div key={`${ri}-${ci}`} className="h-8" />;
            }
            const ymd = toYmd(cell);
            const isStart = a && toYmd(a) === ymd;
            const isEnd = b && toYmd(b) === ymd;
            const mid = inRange(cell, a, b) && !isStart && !isEnd;
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => onPick(cell)}
                className={`h-8 rounded-full text-[12px] font-semibold transition ${
                  isStart || isEnd
                    ? "bg-[#2D5A27] text-white"
                    : mid
                      ? "bg-[#E8EFE4] text-[#1a2e1a]"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {cell.getDate()}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Date range picker kiểu sàn TMĐT — preset + 2 lịch + Áp dụng.
 * Chỉ commit khi bấm Áp dụng (trừ khi chọn preset rồi Apply).
 */
export function AdminDateRangePicker({
  value,
  onChange,
  className = "",
  allowClear = false,
  placeholder = "Chọn khoảng thời gian",
}: {
  value: AdminDateRange | null;
  onChange: (next: AdminDateRange | null) => void;
  className?: string;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdminDateRange>(
    value || defaultThisMonthRange()
  );
  const [preset, setPreset] = useState<AdminDatePreset>(
    value ? detectPreset(value) : "this_month"
  );
  const [pickMode, setPickMode] = useState<"from" | "to">("from");
  const [view, setView] = useState(() => {
    const d = parseYmd(value?.from || toYmd(new Date())) || new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const next = value || defaultThisMonthRange();
    setDraft(next);
    setPreset(value ? detectPreset(value) : "this_month");
    setPickMode("from");
    const d = parseYmd(next.from) || new Date();
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }, [open, value]);

  const draftFrom = parseYmd(draft.from);
  const draftTo = parseYmd(draft.to);

  const label = useMemo(() => {
    if (!value) return placeholder;
    return `${formatYmdVi(value.from)} - ${formatYmdVi(value.to)}`;
  }, [value, placeholder]);

  function applyPreset(id: Exclude<AdminDatePreset, "custom">) {
    const r = rangeForPreset(id);
    setDraft(r);
    setPreset(id);
    const d = parseYmd(r.from)!;
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  function onPickDay(day: Date) {
    const ymd = toYmd(day);
    setPreset("custom");
    if (pickMode === "from" || !draft.from) {
      setDraft({ from: ymd, to: ymd });
      setPickMode("to");
      return;
    }
    const fromD = parseYmd(draft.from)!;
    if (day.getTime() < fromD.getTime()) {
      setDraft({ from: ymd, to: draft.from });
    } else {
      setDraft({ from: draft.from, to: ymd });
    }
    setPickMode("from");
  }

  function shiftView(delta: number) {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  const right = new Date(view.y, view.m + 1, 1);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce6da] bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-[#f5f8f4]"
      >
        <CalendarIcon size={15} className="text-slate-400" />
        <span className="tabular-nums text-[#1a2e1a]">{label}</span>
        <span className="text-slate-300">▾</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Đóng"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,560px)] rounded-xl border border-[#e4ebe3] bg-white p-4 shadow-xl">
            <div className="mb-3 text-[14px] font-bold text-[#1a2e1a]">
              Chọn khoảng thời gian
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-lg px-2.5 py-2 text-[12px] font-semibold transition ${
                    preset === p.id
                      ? "bg-[#2D5A27] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
                <CalendarIcon size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={draft.from}
                  onChange={(e) => {
                    setPreset("custom");
                    setDraft((d) => ({
                      from: e.target.value,
                      to: d.to < e.target.value ? e.target.value : d.to,
                    }));
                  }}
                  className="w-full border-0 bg-transparent font-semibold text-[#1a2e1a] outline-none"
                />
              </label>
              <span className="text-slate-400">-</span>
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
                <CalendarIcon size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={draft.to}
                  onChange={(e) => {
                    setPreset("custom");
                    setDraft((d) => ({
                      from: d.from > e.target.value ? e.target.value : d.from,
                      to: e.target.value,
                    }));
                  }}
                  className="w-full border-0 bg-transparent font-semibold text-[#1a2e1a] outline-none"
                />
              </label>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => shiftView(-1)}
                aria-label="Tháng trước"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => shiftView(1)}
                aria-label="Tháng sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <MonthGrid
                year={view.y}
                month0={view.m}
                draftFrom={draftFrom}
                draftTo={draftTo}
                onPick={onPickDay}
              />
              <MonthGrid
                year={right.getFullYear()}
                month0={right.getMonth()}
                draftFrom={draftFrom}
                draftTo={draftTo}
                onPick={onPickDay}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {allowClear ? (
                <button
                  type="button"
                  className="mr-auto rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-50"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Tất cả
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#2D5A27] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#244a20]"
                onClick={() => {
                  if (!draft.from || !draft.to) return;
                  const a = draft.from <= draft.to ? draft.from : draft.to;
                  const b = draft.from <= draft.to ? draft.to : draft.from;
                  onChange({ from: a, to: b });
                  setOpen(false);
                }}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
