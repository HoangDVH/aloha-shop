"use client";

import { WB } from "@/components/admin/website/ui";

export function SeoCharMeter({
  value,
  max,
  softIdeal,
}: {
  value: string;
  max: number;
  /** Ideal max for Google (e.g. 60 title, 160 desc) */
  softIdeal?: number;
}) {
  const n = value.length;
  const ideal = softIdeal ?? max;
  const tone =
    n > max ? "text-red-600" : n > ideal ? "text-amber-600" : "text-slate-400";
  return (
    <span className={`text-[11px] font-medium tabular-nums ${tone}`}>
      {n}/{max}
    </span>
  );
}

export function SeoCharField({
  label,
  required,
  error,
  children,
  meter,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  meter?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-800">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
        {meter}
      </span>
      {children}
      {error ? <p className="text-[12px] font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

export function SeoStatusChip({
  ok,
  warn,
  label,
}: {
  ok?: boolean;
  warn?: boolean;
  label: string;
}) {
  const cls = ok
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : warn
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-red-50 text-red-700 ring-red-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

export function SeoVarPopover({
  vars,
  onPick,
}: {
  vars: readonly string[];
  onPick: (v: string) => void;
}) {
  return (
    <details className="relative inline-block">
      <summary
        className="cursor-pointer list-none text-[12px] font-bold"
        style={{ color: WB.accent }}
      >
        + Thêm biến
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
        {vars.map((v) => (
          <button
            key={v}
            type="button"
            className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-slate-700 hover:bg-[var(--aloha-green-light)]"
            onClick={(e) => {
              e.preventDefault();
              onPick(v);
              const d = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
              if (d) d.open = false;
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </details>
  );
}
