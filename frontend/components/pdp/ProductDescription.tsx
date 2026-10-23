"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";

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

export type ProductDetailInfo = {
  ma: string;
  categoryName?: string;
  dvt?: string;
  trongLuong?: number;
};

export function ProductDescription({
  text,
  productInfo,
}: {
  text: string;
  productInfo?: ProductDetailInfo;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleCopySku = () => {
    if (!productInfo?.ma) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(productInfo.ma).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

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

  if (!text && !productInfo) return null;

  return (
    <div className="rounded-none border-t-8 border-stone-100 bg-white p-4 sm:p-5 sm:rounded-2xl sm:border sm:border-stone-200/80 sm:shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-0 sm:ring-1 sm:ring-black/[0.04] space-y-6">
      {/* Bảng Chi tiết sản phẩm (Chuẩn Shopee / Tiki) */}
      {productInfo ? (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--aloha-ink)]">
            Chi tiết sản phẩm
          </h2>
          <div className="rounded-xl bg-slate-50/70 p-3.5 divide-y divide-slate-100/80 text-xs sm:text-sm">
            <div className="flex items-center justify-between py-2 sm:justify-start sm:gap-6">
              <span className="w-28 sm:w-32 shrink-0 text-slate-500">Mã sản phẩm</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900 select-all">
                  {productInfo.ma}
                </span>
                <button
                  type="button"
                  onClick={handleCopySku}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition cursor-pointer active:scale-95"
                  title="Sao chép mã sản phẩm"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span className="text-[11px] font-semibold text-emerald-600">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span className="text-[11px]">Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {productInfo.categoryName ? (
              <div className="flex items-center justify-between py-2 sm:justify-start sm:gap-6">
                <span className="w-28 sm:w-32 shrink-0 text-slate-500">Danh mục</span>
                <span className="font-medium text-slate-800">{productInfo.categoryName}</span>
              </div>
            ) : null}

            {productInfo.dvt ? (
              <div className="flex items-center justify-between py-2 sm:justify-start sm:gap-6">
                <span className="w-28 sm:w-32 shrink-0 text-slate-500">Đơn vị tính</span>
                <span className="font-medium text-slate-800">{productInfo.dvt}</span>
              </div>
            ) : null}

            {productInfo.trongLuong && productInfo.trongLuong > 0 ? (
              <div className="flex items-center justify-between py-2 sm:justify-start sm:gap-6">
                <span className="w-28 sm:w-32 shrink-0 text-slate-500">Khối lượng</span>
                <span className="font-medium text-slate-800">{productInfo.trongLuong} g</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Mô tả sản phẩm */}
      {text ? (
        <div className={productInfo ? "pt-1" : ""}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--aloha-ink)]">
            Mô tả sản phẩm
          </h2>
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
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[var(--aloha-line)] bg-[#f7f8f5] py-2.5 text-sm font-bold text-[var(--aloha-green)] transition hover:border-[var(--aloha-green)]/40 hover:bg-[var(--aloha-green-light)] cursor-pointer"
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
      ) : null}
    </div>
  );
}
