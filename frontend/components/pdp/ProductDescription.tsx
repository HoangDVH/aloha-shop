"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

export function plainDescription(raw: string): string {
  return String(raw || "")
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Chiều cao preview mô tả (kiểu Shopee/Lazada) — ~8–9 dòng. */
const DESC_COLLAPSE_PX = 220;

export function ProductDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      setNeedsToggle(el.scrollHeight > DESC_COLLAPSE_PX + 8);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text]);

  return (
    <div className="rounded-2xl bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
      <h2 className="mb-2 text-sm font-bold text-[var(--aloha-ink)]">Mô tả sản phẩm</h2>
      <div className="relative">
        <div
          ref={bodyRef}
          className={`whitespace-pre-wrap transition-[max-height] duration-300 ease-out ${
            expanded || !needsToggle ? "max-h-none" : "max-h-[220px] overflow-hidden"
          }`}
        >
          {text}
        </div>
        {needsToggle && !expanded ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent"
          />
        ) : null}
      </div>
      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[var(--aloha-line)] bg-[#f7f8f5] py-2.5 text-sm font-bold text-[var(--aloha-green)] transition hover:border-[var(--aloha-green)]/40 hover:bg-[var(--aloha-green-light)]"
          aria-expanded={expanded}
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
          <ChevronRight
            size={16}
            className={`transition-transform ${expanded ? "-rotate-90" : "rotate-90"}`}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}
