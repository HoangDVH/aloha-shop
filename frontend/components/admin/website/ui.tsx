"use client";

import React from "react";
import { Loader2 } from "lucide-react";

/** Brand ALOHA — dùng thống nhất toàn bộ Website bán hàng */
export const WB = {
  accent: "#3D6B3A",
  accentSoft: "rgba(61, 107, 58, 0.08)",
  accentHover: "#345C32",
  canvas: "#FFFFFF",
  panel: "#FFFFFF",
  border: "#E8EAED",
  borderStrong: "#D6D9DE",
  text: "#1A1D21",
  muted: "#6B7280",
  subtle: "#9CA3AF",
  rowActive: "rgba(61, 107, 58, 0.06)",
} as const;

export const wbInput =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#3D6B3A]/50 focus:ring-2 focus:ring-[#3D6B3A]/15";

export const wbSelect =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-[#3D6B3A]/50 focus:ring-2 focus:ring-[#3D6B3A]/15";

export function WbBtn({
  children,
  variant = "secondary",
  className = "",
  disabled,
  type = "button",
  onClick,
  href,
  title,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  href?: string;
  title?: string;
}) {
  const base =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition disabled:pointer-events-none disabled:opacity-45";
  const variants: Record<string, string> = {
    primary:
      "border-0 bg-[#3D6B3A] text-white shadow-sm hover:bg-[#2F5530] hover:shadow-md",
    secondary:
      "border border-solid border-slate-300 bg-white text-slate-800 shadow-sm hover:border-[#3D6B3A]/45 hover:bg-[#F4F8F2] hover:text-[#2F5530]",
    ghost:
      "border border-solid border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900",
    danger:
      "border border-solid border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} title={title}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls} title={title}>
      {children}
    </button>
  );
}

export function WbToggle({
  on,
  onChange,
  title,
}: {
  on: boolean;
  onChange: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={onChange}
      className={`inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full border-0 p-[2px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D6B3A]/35 ${
        on ? "justify-end bg-[#3D6B3A]" : "justify-start bg-[#D1D5DB]"
      }`}
      style={{ border: "none", boxSizing: "border-box" }}
    >
      <span
        className="pointer-events-none block h-[18px] w-[18px] shrink-0 rounded-full bg-white"
        style={{
          boxShadow: "0 1px 2px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.04)",
        }}
      />
    </button>
  );
}

export function WbSegment<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; Icon?: React.ComponentType<{ className?: string }> }[];
  size?: "sm" | "md";
}) {
  return (
    <div
      className={`inline-flex items-center rounded-xl border border-slate-300 bg-slate-100/80 p-1 ${
        size === "sm" ? "gap-0.5" : "gap-0.5"
      }`}
    >
      {options.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border-0 font-semibold transition ${
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]"
            } ${
              active
                ? "bg-white text-[#2F5530] shadow-sm ring-1 ring-slate-200"
                : "bg-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
            style={{ border: "none" }}
          >
            {Icon ? (
              <Icon
                className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} ${
                  active ? "text-[#3D6B3A]" : ""
                }`}
              />
            ) : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function WbIconSegment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; title: string; Icon: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-100/80 p-1">
      {options.map(({ id, title, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            title={title}
            onClick={() => onChange(id)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border-0 transition ${
              active
                ? "bg-white text-[#3D6B3A] shadow-sm ring-1 ring-slate-200"
                : "bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800"
            }`}
            style={{ border: "none" }}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

export function WbSectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
        {children}
      </h3>
      {action}
    </div>
  );
}

export function WbField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-gray-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-gray-400">{hint}</span> : null}
    </label>
  );
}

export function WbLoading({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div className="flex h-[min(60vh,480px)] items-center justify-center gap-2 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin text-[#3D6B3A]" />
      {label}
    </div>
  );
}

export function WbBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn" | "info";
}) {
  const tones = {
    neutral: "bg-slate-200 text-slate-700",
    success: "bg-[#E8EFE4] text-[#2F5530] ring-1 ring-[#3D6B3A]/20",
    warn: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
    info: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
