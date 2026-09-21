"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { PRICE_PRESETS } from "@/components/catalog/catalogLayoutUtils";

/** Trần thanh trượt — đủ cho shop cây/chậu; preset «Trên 500k» vẫn hoạt động. */
export const PRICE_SLIDER_MAX = 5_000_000;

function parseMoney(raw: string): number {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatMoneyDots(n: number): string {
  const v = Math.max(0, Math.round(n) || 0);
  return `${v.toLocaleString("vi-VN")}đ`;
}

type Props = {
  minPrice: string;
  maxPrice: string;
  onChange: (min: string, max: string | null) => void;
};

export function PriceRangeFilter({ minPrice, maxPrice, onChange }: Props) {
  const id = useId();
  const urlMin = parseMoney(minPrice);
  const urlMax = maxPrice ? parseMoney(maxPrice) : 0;

  const [lo, setLo] = useState(urlMin);
  const [hi, setHi] = useState(urlMax > 0 ? urlMax : PRICE_SLIDER_MAX);
  const [minText, setMinText] = useState(formatMoneyDots(urlMin));
  const [maxText, setMaxText] = useState(
    formatMoneyDots(urlMax > 0 ? urlMax : PRICE_SLIDER_MAX)
  );

  useEffect(() => {
    const a = parseMoney(minPrice);
    const b = maxPrice ? parseMoney(maxPrice) : 0;
    setLo(a);
    setHi(b > 0 ? Math.min(b, PRICE_SLIDER_MAX) : PRICE_SLIDER_MAX);
    setMinText(formatMoneyDots(a));
    setMaxText(formatMoneyDots(b > 0 ? b : PRICE_SLIDER_MAX));
  }, [minPrice, maxPrice]);

  const commit = (nextLo: number, nextHi: number) => {
    let a = Math.max(0, Math.min(nextLo, PRICE_SLIDER_MAX));
    let b = Math.max(0, Math.min(nextHi, PRICE_SLIDER_MAX));
    if (a > b) [a, b] = [b, a];
    setLo(a);
    setHi(b);
    setMinText(formatMoneyDots(a));
    setMaxText(formatMoneyDots(b));
    const minOut = a > 0 ? String(a) : "0";
    const maxOut = b >= PRICE_SLIDER_MAX ? null : String(b);
    onChange(minOut, maxOut);
  };

  const pctLo = (lo / PRICE_SLIDER_MAX) * 100;
  const pctHi = (hi / PRICE_SLIDER_MAX) * 100;

  const trackStyle = useMemo(
    () => ({
      background: `linear-gradient(to right, #d1d5db 0%, #d1d5db ${pctLo}%, var(--aloha-green) ${pctLo}%, var(--aloha-green) ${pctHi}%, #d1d5db ${pctHi}%, #d1d5db 100%)`,
    }),
    [pctLo, pctHi]
  );

  return (
    <div className="border-t border-[var(--aloha-line)] pt-4">
      <h3 className="mb-3 text-sm font-extrabold text-[var(--aloha-ink)]">Giá</h3>

      <div className="flex flex-wrap gap-2">
        {PRICE_PRESETS.map((p) => {
          const active =
            String(p.min) === String(urlMin || 0) &&
            (p.max === 0 ? !maxPrice : String(p.max) === String(urlMax));
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                if (active) {
                  onChange("", null);
                  return;
                }
                onChange(String(p.min), p.max > 0 ? String(p.max) : null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-[var(--aloha-green)] bg-white text-[var(--aloha-green)]"
                  : "border-[var(--aloha-line)] bg-white text-slate-700 hover:border-[var(--aloha-green)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aloha-green)]">
          <SlidersHorizontal size={15} />
          Hoặc chọn mức giá phù hợp với bạn
        </p>
      </div>

      <div className="relative mt-3 h-6">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={trackStyle} />
        <input
          id={`${id}-lo`}
          type="range"
          min={0}
          max={PRICE_SLIDER_MAX}
          step={10000}
          value={lo}
          aria-label="Giá từ"
          className="pointer-events-none absolute inset-0 z-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--aloha-green)] [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--aloha-green)]"
          onChange={(e) => {
            const v = Number(e.target.value);
            const next = Math.min(v, hi);
            setLo(next);
            setMinText(formatMoneyDots(next));
          }}
          onMouseUp={() => commit(lo, hi)}
          onTouchEnd={() => commit(lo, hi)}
        />
        <input
          id={`${id}-hi`}
          type="range"
          min={0}
          max={PRICE_SLIDER_MAX}
          step={10000}
          value={hi}
          aria-label="Giá đến"
          className="pointer-events-none absolute inset-0 z-20 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--aloha-green)] [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--aloha-green)]"
          onChange={(e) => {
            const v = Number(e.target.value);
            const next = Math.max(v, lo);
            setHi(next);
            setMaxText(formatMoneyDots(next));
          }}
          onMouseUp={() => commit(lo, hi)}
          onTouchEnd={() => commit(lo, hi)}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={minText}
          aria-label="Giá từ"
          className="min-w-0 flex-1 rounded-lg border border-[var(--aloha-line)] px-3 py-2.5 text-center text-sm font-semibold text-slate-700 outline-none focus:border-[var(--aloha-green)]"
          onChange={(e) => setMinText(e.target.value)}
          onBlur={() => commit(parseMoney(minText), parseMoney(maxText) || hi)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="h-px w-4 shrink-0 bg-slate-300" aria-hidden />
        <input
          type="text"
          inputMode="numeric"
          value={maxText}
          aria-label="Giá đến"
          className="min-w-0 flex-1 rounded-lg border border-[var(--aloha-line)] px-3 py-2.5 text-center text-sm font-semibold text-slate-700 outline-none focus:border-[var(--aloha-green)]"
          onChange={(e) => setMaxText(e.target.value)}
          onBlur={() => commit(parseMoney(minText), parseMoney(maxText) || PRICE_SLIDER_MAX)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </div>
  );
}
