"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const PREVIEW = 12;

/** Rút gọn nhãn dài (SIZE kèm kích thước) — giá trị lọc vẫn dùng full. */
export function shortFilterLabel(raw: string, max = 28): string {
  const s = String(raw || "").trim();
  if (!s) return s;
  const so = s.match(/^(SỐ\s*\d+[A-Z]?)/i);
  if (so && (s.length > max || /[(\[]/.test(s)))
    return so[1].toUpperCase().replace(/\s+/g, " ");
  const size = s.match(/^(SIZE\s*[SMLX]+)/i);
  if (size) return size[1].toUpperCase();
  const mm = s.match(/^(\d+\s*[-–]\s*\d+\s*mm)/i);
  if (mm) return mm[1].replace(/\s+/g, "");
  const code = s.match(/^([A-Z]?\d{1,3})\s*\(/i);
  if (code && s.length > max) return code[1].toUpperCase();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function FilterChipSection({
  title,
  items,
  isActive,
  onToggle,
  defaultOpen = true,
  hint,
  largeChips = false,
}: {
  title: string;
  items: { key: string; label: string; title?: string }[];
  isActive: (key: string) => boolean;
  onToggle: (key: string) => void;
  defaultOpen?: boolean;
  hint?: string;
  /** Chip to hơn (ĐVT) — dễ nhìn/chạm */
  largeChips?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [more, setMore] = useState(false);
  if (!items.length && !hint) return null;

  const preview = largeChips ? 18 : PREVIEW;
  const visible = more ? items : items.slice(0, preview);
  const rest = Math.max(0, items.length - preview);

  return (
    <div className="border-t border-[var(--aloha-line)] pt-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-left"
      >
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--aloha-ink)]">
          {title}
          {items.length ? (
            <span className="ml-1 font-bold text-slate-500">({items.length})</span>
          ) : null}
        </h3>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <>
          {hint && !items.length ? (
            <p className="text-xs leading-relaxed text-slate-400">{hint}</p>
          ) : null}
          {items.length ? (
            <div className={`flex flex-wrap ${largeChips ? "gap-2" : "gap-1.5"}`}>
              {visible.map((it) => {
                const active = isActive(it.key);
                return (
                  <button
                    key={it.key}
                    type="button"
                    title={it.title || it.label}
                    onClick={() => onToggle(it.key)}
                    className={`max-w-full border text-left font-semibold leading-snug transition ${
                      largeChips
                        ? "min-h-11 rounded-lg px-3.5 py-2.5 text-sm"
                        : "rounded-lg px-2.5 py-1.5 text-xs"
                    } ${
                      active
                        ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)] text-[var(--aloha-green)]"
                        : "border-[var(--aloha-line)] bg-white text-slate-700 hover:border-[var(--aloha-green)]"
                    }`}
                  >
                    <span className="line-clamp-2">{shortFilterLabel(it.label)}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {rest > 0 ? (
            <button
              type="button"
              onClick={() => setMore((v) => !v)}
              className="mt-2.5 text-sm font-bold text-[var(--aloha-green)] hover:underline"
            >
              {more ? "Thu gọn" : `Xem thêm ${rest}`}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
