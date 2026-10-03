"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Clapperboard, ShoppingBag, ArrowRight } from "lucide-react";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { fetchLivePrices } from "@/lib/livePrices";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { isPromoSelling } from "@/components/campaign/CardPromo";
import { firstFileVideo } from "@/lib/campaign/productVideo";
import { ProductVideoLightbox } from "@/components/pdp/ProductVideoLightbox";
import { liveRowToProduct } from "./DealsProducts";
import { DealsSectionHead } from "./DealsSectionHead";

const MAX_VIDEOS = 8;
const MAX_MAS = 400;
const VISIBLE_RATIO = 0.7;

type Clip = { product: ShopProduct; src: string };

function priceOf(p: ShopProduct): number {
  const promo = p.campaignPromo;
  return isPromoSelling(promo) && promo?.salePrice != null ? promo.salePrice : p.gia;
}

/** Chỉ phát khi thẻ hiện ≥70% trên màn hình (tắt tiếng, không tải trước); khách giảm chuyển động thì để ảnh tĩnh. */
function ClipCard({ clip, onOpen }: { clip: Clip; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= VISIBLE_RATIO) {
          setSeen(true);
          void v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: [0, VISIBLE_RATIO, 1] }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const { product } = clip;
  return (
    <li className="w-[38vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem video ${product.ten}`}
        className="group/card relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm ring-1 ring-black/[0.06] hover:shadow-md transition-shadow"
      >
        <video
          ref={ref}
          src={seen ? clip.src : undefined}
          poster={product.anh || undefined}
          muted
          loop
          playsInline
          preload="none"
          className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          aria-hidden
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <Play size={10} className="fill-white" strokeWidth={0} aria-hidden />
          Cây thật
        </span>
        <span className="pointer-events-none absolute inset-x-2 bottom-2 text-left">
          <span className="line-clamp-2 text-[12px] font-bold leading-tight text-white">{product.ten}</span>
          <span className="mt-0.5 block text-[13px] font-black text-[#FFD54F]">{formatVnd(priceOf(product))}</span>
        </span>
      </button>
      {product.path ? (
        <Link
          href={product.path}
          className="group relative mt-2 flex h-8 sm:h-9 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--campaign-primary,#C2185B)] via-[#D81B60] to-[#E11D48] px-2.5 text-[11px] sm:text-xs font-black uppercase tracking-wide text-white shadow-xs shadow-rose-950/20 transition-all hover:brightness-110 hover:shadow-md hover:shadow-rose-950/30 active:scale-[0.97] select-none"
        >
          <ShoppingBag size={13} strokeWidth={2.4} className="shrink-0 transition-transform group-hover:scale-110" />
          <span>Mua ngay</span>
          <ArrowRight size={12} strokeWidth={2.5} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </li>
  );
}

/** Dải "Xem cây thật": video thật của SP chiến dịch (chỉ video file, bỏ YouTube); không có video thì ẩn. */
export function DealsVideoStrip({ campaign }: { campaign: CampaignUI }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const mas = useMemo(() => [...new Set(campaign.products.map((p) => p.ma))].slice(0, MAX_MAS), [campaign.products]);
  const key = mas.join(",");

  useEffect(() => {
    let alive = true;
    fetchLivePrices(mas)
      .then((rows) => {
        if (!alive) return;
        const next = rows
          .filter((r) => r.isActive !== false)
          .map((r) => liveRowToProduct(r))
          .map((product) => ({ product, src: firstFileVideo(product) }))
          .filter((c) => c.src)
          .slice(0, MAX_VIDEOS);
        setClips(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!clips.length) return null;
  const current = open != null ? clips[open] : null;

  return (
    <section id="video-cay-that" className="scroll-mt-24 space-y-4 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
      <DealsSectionHead icon={Clapperboard} title="Xem cây thật" subtitle="Video thực tế sản phẩm trong chương trình" />
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {clips.map((c, i) => (
          <ClipCard key={c.product.ma} clip={c} onOpen={() => setOpen(i)} />
        ))}
      </ul>
      {current ? (
        <ProductVideoLightbox
          open
          startIndex={0}
          media={[{ kind: "video", src: current.src, file: true }]}
          poster={current.product.anh}
          alt={current.product.ten}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}
