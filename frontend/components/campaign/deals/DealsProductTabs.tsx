"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
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
import { DealsSectionHead } from "./DealsSectionHead";

const PAGE = 20;
/** Chiến dịch lớn: chỉ nạp giá tối đa ngần này mã để lọc theo mức giá. */
const MAX_MAS = 400;

function priceOf(r: LivePriceRow): number {
  const promo = r.campaignPromo;
  return isPromoSelling(promo) && promo?.salePrice != null ? promo.salePrice : Number(r.gia) || 0;
}

/** Lưới toàn bộ SP chiến dịch + thanh lọc dính (nhóm / mức giá), bộ lọc giữ trên URL `?loc=`. */
export function DealsProductTabs({ campaign }: { campaign: CampaignUI }) {
  const router = useRouter();
  const pathname = usePathname() || "/uu-dai";
  const searchParams = useSearchParams();
  const active = toDealsFilter(searchParams.get("loc"));
  const sectionRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<Record<string, LivePriceRow> | null>(null);
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const seen = new Set<string>();
    return campaign.products.filter((p) => {
      const k = p.ma.toUpperCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, MAX_MAS);
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
      return [{ item: { ma: p.ma, dealHot: p.dealHot, hasGift: p.hasGift, price: priceOf(r) } as DealsFilterItem, row: r }];
    });
  }, [list, rows]);

  const counts = useMemo(() => countDealsFilters(items.map((x) => x.item)), [items]);
  const filters = DEALS_FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0);
  const effective: DealsFilterId = rows && active !== "all" && !counts[active] ? "all" : active;
  const matched = useMemo(() => items.filter((x) => matchesDealsFilter(x.item, effective)), [items, effective]);
  const products = useMemo(() => matched.slice(0, shown).map((x) => liveRowToProduct(x.row)), [matched, shown]);

  useEffect(() => setShown(PAGE), [effective]);

  const pick = (id: DealsFilterId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") params.delete("loc");
    else params.set("loc", id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const el = sectionRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!list.length) return null;

  return (
    <section id="san-pham" ref={sectionRef} className="scroll-mt-[calc(var(--shop-chrome-h,64px)+8px)] space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
      <DealsSectionHead icon={Sparkles} title="Sản phẩm trong chương trình" subtitle="Giá ưu đãi, quà tặng kèm và voucher áp dụng ngay" />
      <div
        className="sticky top-[var(--shop-chrome-h,64px)] z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 backdrop-blur-md sm:rounded-2xl bg-white/95 border-b border-slate-100/80"
      >
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
                className={`min-h-[44px] shrink-0 rounded-full px-4 text-[13px] font-bold transition-colors ${
                  on
                    ? "bg-[var(--campaign-primary)] text-white shadow-sm"
                    : "bg-white text-slate-700 ring-1 ring-black/[0.06] hover:text-[var(--campaign-primary)]"
                }`}
              >
                {f.label}
                {rows ? <span className={`ml-1 text-[11px] font-semibold ${on ? "text-white/80" : "text-slate-400"}`}>{counts[f.id]}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

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
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="min-h-[44px] rounded-full bg-white px-6 text-sm font-bold text-[var(--campaign-primary)] ring-1 ring-[var(--campaign-primary)]/30 hover:bg-[#FFF5F8]"
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
