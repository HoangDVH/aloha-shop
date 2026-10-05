"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flame, Sparkles, Zap } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { flashStageText, stageChips } from "@/lib/campaign/flashSlots";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { fetchLivePrices, type LivePriceRow } from "@/lib/livePrices";
import { isPromoSelling } from "@/components/campaign/CardPromo";
import { ProductGrid } from "@/components/ProductCard";
import {
  DEALS_FILTERS,
  countDealsFilters,
  matchesDealsFilter,
  toDealsFilter,
  type DealsFilterId,
  type DealsFilterItem,
} from "@/lib/campaign/dealsFilters";
import { liveRowToProduct } from "./DealsProducts";

const PAGE = 20;
/** Chiến dịch lớn: chỉ nạp giá tối đa ngần này mã để lọc theo mức giá. */
const MAX_MAS = 400;

function priceOf(r: LivePriceRow): number {
  const promo = r.campaignPromo;
  return isPromoSelling(promo) && promo?.salePrice != null ? promo.salePrice : Number(r.gia) || 0;
}

function getSlotEndTargetMs(slot: { start: string; end: string } | undefined, nowMs: number): number | null {
  if (!slot) return null;
  const d = new Date(nowMs + 7 * 3600_000);
  const [endH, endM] = slot.end.split(":").map(Number);
  const [startH] = slot.start.split(":").map(Number);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  let endUtc = Date.UTC(y, m, day, endH || 0, endM || 0) - 7 * 3600_000;
  if ((endH || 0) < (startH || 0) && d.getUTCHours() >= (startH || 0)) {
    endUtc += 86_400_000;
  }
  return endUtc;
}

/** Lưới hợp nhất SP chiến dịch + Flash Sale theo khung giờ (Hub sản phẩm duy nhất). */
export function DealsProductTabs({
  campaign,
  offsetMs = 0,
  initialSlot = null,
  mode = "default",
}: {
  campaign: CampaignUI;
  offsetMs?: number;
  initialSlot?: string | null;
  mode?: "default" | "flash-only";
}) {
  const router = useRouter();
  const pathname = usePathname() || "/uu-dai";
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<Record<string, LivePriceRow> | null>(null);
  const [shown, setShown] = useState(PAGE);

  // Logic tính toán Flash Sale
  const nowMs = Date.now() + offsetMs;
  const chips = useMemo(
    () => stageChips(campaign.slots || [], campaign.phase, nowMs, Date.parse(campaign.endAt)),
    [campaign.slots, campaign.phase, nowMs, campaign.endAt]
  );
  const chipOf = useMemo(() => new Map(chips.map((c) => [c.key, c])), [chips]);
  const allSlots = useMemo(
    () => chips.flatMap((c) => (campaign.slots || []).filter((s) => s.key === c.key)),
    [chips, campaign.slots]
  );
  const openKey = useMemo(() => chips.find((c) => c.status === "open")?.key ?? null, [chips]);
  const slots = allSlots;
  const openSlot = slots.find((s) => s.key === openKey);
  const endTarget = getSlotEndTargetMs(openSlot, nowMs);
  const cd = useCountdown(endTarget, offsetMs);

  const [pickedSlot, setPickedSlot] = useState<string | null>(() =>
    initialSlot && slots.some((s) => s.key === initialSlot) ? initialSlot : null
  );
  const activeSlotKey = pickedSlot || (openSlot ? openKey : null) || slots[0]?.key || null;
  const activeSlot = slots.find((s) => s.key === activeSlotKey);

  const locParam = searchParams.get("loc");
  const tabParam = searchParams.get("tab");
  const isFlashPage = mode === "flash-only" || tabParam === "flash-sale" || tabParam === "flash";
  const stage = flashStageText(campaign.display.flashStage);
  const rawActive = locParam
    ? toDealsFilter(locParam)
    : isFlashPage || searchParams.get("slot")
      ? "flash"
      : "all";

  const list = useMemo(() => {
    const seen = new Set<string>();
    return campaign.products
      .filter((p) => {
        const k = p.ma.toUpperCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, MAX_MAS);
  }, [campaign.products]);
  const key = list.map((p) => p.ma).join(",");

  useEffect(() => {
    let alive = true;
    setRows(null);
    fetchLivePrices(list.map((p) => p.ma))
      .then((res) => {
        if (!alive) return;
        const next: Record<string, LivePriceRow> = {};
        for (const r of res) next[String(r.ma).toUpperCase()] = r;
        setRows(next);
      })
      .catch(() => alive && setRows({}));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const items = useMemo(() => {
    if (!rows) return [];
    return list.flatMap((p) => {
      const r = rows[p.ma.toUpperCase()];
      if (!r || r.isActive === false) return [];
      return [
        {
          item: {
            ma: p.ma,
            dealHot: p.dealHot,
            hasGift: p.hasGift,
            price: priceOf(r),
            slotKey: p.slotKey,
          } as DealsFilterItem,
          row: r,
        },
      ];
    });
  }, [list, rows]);

  const counts = useMemo(() => countDealsFilters(items.map((x) => x.item), activeSlotKey), [items, activeSlotKey]);
  const filters = DEALS_FILTERS.filter(
    (f) => (f.id !== "flash" || slots.length > 0) && (f.id === "all" || f.id === "flash" || counts[f.id] > 0)
  );
  const effective: DealsFilterId = rows && rawActive !== "all" && !counts[rawActive] && rawActive !== "flash" ? "all" : rawActive;

  const matched = useMemo(() => {
    if (isFlashPage || effective === "flash") {
      const inSlot = items.filter((x) => x.item.slotKey && x.item.slotKey === activeSlotKey);
      if (inSlot.length > 0) return inSlot;
      // Nếu không có mã gắn cứng slot, hiển thị các mã ưu đãi
      return items.filter((x) => !x.item.slotKey || x.item.dealHot);
    }
    return items.filter((x) => matchesDealsFilter(x.item, effective, activeSlotKey));
  }, [items, isFlashPage, effective, activeSlotKey]);

  const products = useMemo(() => matched.slice(0, shown).map((x) => liveRowToProduct(x.row)), [matched, shown]);

  useEffect(() => setShown(PAGE), [effective, activeSlotKey]);

  const pick = (id: DealsFilterId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") {
      if (params.get("tab") === "flash-sale") params.set("loc", "all");
      else params.delete("loc");
    } else {
      params.set("loc", id);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const el = sectionRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!list.length) return null;

  return (
    <section
      id="san-pham"
      ref={sectionRef}
      className={`relative scroll-mt-[calc(var(--shop-chrome-h,64px)+8px)] space-y-3 sm:space-y-4 rounded-3xl bg-white ${
        isFlashPage ? "p-3 sm:p-6" : "p-4 sm:p-6"
      } shadow-sm border border-rose-100/80`}
    >
      {/* Anchor hỗ trợ link nhảy tới #flash-sale */}
      <span id="flash-sale" className="pointer-events-none absolute -top-24 left-0 block h-1 w-1 opacity-0" aria-hidden />

      {/* HEADER HỢP NHẤT: TIÊU ĐỀ + ĐỒNG HỒ ĐẾM NGƯỢC FLASH SALE (GỌN 1 HÀNG TRÊN MOBILE) */}
      <div className="flex items-center justify-between gap-2 border-b border-rose-100/60 pb-2.5 sm:pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl ${
              isFlashPage
                ? "bg-[#C8102E]/10 text-[#C8102E]"
                : "bg-[var(--campaign-primary,#C8102E)]/10 text-[var(--campaign-primary,#C8102E)]"
            }`}
          >
            {isFlashPage ? (
              <Zap size={16} className="fill-[#C8102E] text-[#C8102E] sm:w-[18px] sm:h-[18px]" aria-hidden />
            ) : (
              <Sparkles size={16} strokeWidth={2.5} className="sm:w-[18px] sm:h-[18px]" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-sm sm:text-lg font-black uppercase text-slate-900 tracking-tight truncate">
                {isFlashPage ? (
                  <>
                    <span className="sm:hidden">Flash Sale</span>
                    <span className="hidden sm:inline">{stage.title}</span>
                  </>
                ) : (
                  "Sản phẩm ưu đãi chương trình"
                )}
              </h2>
              {isFlashPage && stage.badge ? (
                <span className="hidden sm:inline-flex shrink-0 items-center rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-xs font-black uppercase text-[#92400E] shadow-xs">
                  {stage.badge}
                </span>
              ) : null}
            </div>
            {isFlashPage ? (
              stage.subtitle?.trim() ? (
                <p className="hidden sm:block text-xs text-slate-500 font-medium">{stage.subtitle}</p>
              ) : null
            ) : (
              <p className="hidden sm:block text-xs text-slate-500 font-medium">
                Giảm giá giờ vàng, quà tặng 0Đ và áp dụng thêm voucher
              </p>
            )}
          </div>
        </div>

        {openSlot && endTarget && !cd.done ? (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl bg-red-50 border border-red-200/80 px-2 sm:px-3 py-1 sm:py-1.5 shadow-2xs">
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-[#E53935]">
              <Flame size={13} className="fill-[#E53935] animate-pulse sm:w-[14px] sm:h-[14px]" />
              <span className="hidden sm:inline">Flash Sale kết thúc trong:</span>
              <span className="sm:hidden">Kết thúc:</span>
            </span>
            <div className="flex items-center gap-0.5 sm:gap-1 font-black tabular-nums text-white">
              <span className="rounded bg-[#E53935] px-1 sm:px-1.5 py-0.5 text-[11px] sm:text-xs min-w-[19px] text-center">{cd.h}</span>
              <span className="text-[#E53935] text-[11px] sm:text-xs font-bold">:</span>
              <span className="rounded bg-[#E53935] px-1 sm:px-1.5 py-0.5 text-[11px] sm:text-xs min-w-[19px] text-center">{cd.m}</span>
              <span className="text-[#E53935] text-[11px] sm:text-xs font-bold">:</span>
              <span className="rounded bg-[#E53935] px-1 sm:px-1.5 py-0.5 text-[11px] sm:text-xs min-w-[19px] text-center">{cd.s}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* NẾU LÀ TRANG FLASH SALE: CHỈ HIỂN THỊ DUY NHẤT 1 HÀNG KHUNG GIỜ (CHUẨN SHOPEE/TIKTOK SHOP) */}
      {isFlashPage && slots.length > 0 ? (
        <div className="sticky top-[var(--shop-chrome-h,64px)] z-20 -mx-3 px-3 sm:mx-0 sm:px-0 py-2 backdrop-blur-md sm:rounded-2xl bg-white/95 border-b border-slate-100/80 space-y-2">
          <div
            role="tablist"
            aria-label="Khung giờ flash sale"
            className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slots.map((s) => {
              const on = s.key === activeSlotKey;
              const isLive = s.key === openKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPickedSlot(s.key)}
                  className={`min-h-[44px] shrink-0 rounded-2xl px-3.5 py-1.5 text-left text-sm font-bold transition-all cursor-pointer ${
                    on
                      ? "bg-[#C8102E] text-white shadow-md scale-[1.02]"
                      : "bg-white text-slate-700 ring-1 ring-black/5 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span>{s.start}–{s.end}</span>
                    {isLive && !on ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-[#E53935] animate-ping" />
                    ) : null}
                  </div>
                  <span className="block text-[10px] font-semibold opacity-90 mt-0.5">
                    {isLive ? "🔥 " : "⏰ "}
                    {chipOf.get(s.key)?.text || "Sắp diễn ra"}
                    {s.label?.trim() ? ` · ${s.label.trim()}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {activeSlot && activeSlot.key !== openKey ? (
            <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-2 sm:p-2.5 text-xs text-amber-800 flex items-center gap-2">
              <span>⏰</span>
              <span>Khung giờ <strong>{activeSlot.start}–{activeSlot.end}</strong> sắp mở bán. Hãy quay lại đúng giờ để săn cây giá sốc!</span>
            </div>
          ) : null}
        </div>
      ) : (
        /* TRANG TỔNG QUAN: HIỂN THỊ THANH LỌC ĐẦY ĐỦ */
        <>
          <div className="sticky top-[var(--shop-chrome-h,64px)] z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 backdrop-blur-md sm:rounded-2xl bg-white/95 border-b border-slate-100/80">
            <div role="tablist" aria-label="Lọc sản phẩm ưu đãi" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filters.map((f) => {
                const on = f.id === effective;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => pick(f.id)}
                    className={`min-h-[44px] shrink-0 rounded-full px-4 text-[13px] font-bold transition-all cursor-pointer ${
                      on
                        ? "bg-[var(--campaign-primary,#C8102E)] text-white shadow-sm scale-[1.02]"
                        : "bg-white text-slate-700 ring-1 ring-black/[0.06] hover:text-[var(--campaign-primary,#C8102E)]"
                    }`}
                  >
                    {f.label}
                    {rows && f.id !== "flash" && counts[f.id] > 0 ? (
                      <span className={`ml-1 text-[11px] font-semibold ${on ? "text-white/80" : "text-slate-400"}`}>
                        {counts[f.id]}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {effective === "flash" && slots.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div
                role="tablist"
                aria-label="Khung giờ flash sale"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {slots.map((s) => {
                  const on = s.key === activeSlotKey;
                  const isLive = s.key === openKey;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setPickedSlot(s.key)}
                      className={`min-h-[44px] shrink-0 rounded-2xl px-3.5 py-1 text-left text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        on
                          ? "bg-[#C8102E] text-white shadow-md scale-[1.02]"
                          : "bg-slate-50 text-slate-700 ring-1 ring-black/5 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 leading-tight">
                        <span>{s.start}–{s.end}</span>
                        {isLive && !on ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-[#E53935] animate-ping" />
                        ) : null}
                      </div>
                      <span className="block text-[10px] font-semibold opacity-90 mt-0.5">
                        {isLive ? "🔥 " : "⏰ "}
                        {chipOf.get(s.key)?.text || "Sắp diễn ra"}
                        {s.label?.trim() ? ` · ${s.label.trim()}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeSlot && activeSlot.key !== openKey ? (
                <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-2.5 text-xs text-amber-800 flex items-center gap-2">
                  <span>⏰</span>
                  <span>Khung giờ <strong>{activeSlot.start}–{activeSlot.end}</strong> sắp mở bán. Hãy quay lại đúng giờ để săn cây giá sốc!</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {!rows ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[3/5] animate-pulse rounded-2xl bg-white/80" />
          ))}
        </div>
      ) : (
        <>
          <ProductGrid products={products} shopee homeRow6 variant="deal" />
          {shown < matched.length ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="min-h-[44px] rounded-full bg-white px-6 text-sm font-bold text-[var(--campaign-primary,#C8102E)] ring-1 ring-[var(--campaign-primary,#C8102E)]/30 hover:bg-[#FFF5F8] cursor-pointer"
              >
                Xem thêm {Math.min(PAGE, matched.length - shown)} sản phẩm
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
