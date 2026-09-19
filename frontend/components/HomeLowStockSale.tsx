"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Flame, Heart, Sparkles, Sprout } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { ShopProduct } from "@/lib/api";

type Props = {
  products: ShopProduct[];
};

export function HomeLowStockSale({ products }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    const t = window.setTimeout(() => emblaApi.reInit(), 50);
    return () => {
      window.clearTimeout(t);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (!products.length) return null;

  return (
    <section className="home-low-stock bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="home-low-stock__panel relative overflow-hidden rounded-2xl px-3 py-5 sm:px-5 sm:py-6 md:px-7">
          {/* Nền blob xanh nhạt */}
          <div className="home-low-stock__blob home-low-stock__blob--tl" aria-hidden />
          <div className="home-low-stock__blob home-low-stock__blob--br" aria-hidden />
          <div className="home-low-stock__wave" aria-hidden />

          {/* Lá góc — giống mock */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decor/leaves-tr.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-3 -top-6 z-[1] h-[8.5rem] w-[8.5rem] object-contain object-right-top opacity-[0.92] mix-blend-multiply sm:-right-2 sm:-top-3 sm:h-40 sm:w-40 md:h-48 md:w-48"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decor/leaves-bl.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-4 -left-4 z-[1] h-36 w-36 object-contain object-left-bottom opacity-[0.95] mix-blend-multiply sm:h-44 sm:w-44 md:h-52 md:w-52"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decor/leaves-br.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-3 -right-3 z-[1] h-28 w-28 object-contain object-right-bottom opacity-[0.9] mix-blend-multiply sm:h-36 sm:w-36 md:h-44 md:w-44"
          />

          <div className="relative z-10 mb-4 flex items-start justify-between gap-2 sm:mb-5 sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                  <Flame className="h-4 w-4 fill-orange-500 text-orange-500" aria-hidden />
                </span>
                <h2 className="text-base font-extrabold italic leading-snug tracking-tight text-[var(--aloha-green-dark)] sm:text-xl md:text-[1.4rem]">
                  Sản phẩm đang bán chạy - mua ngay kẻo hết
                </h2>
                <Sparkles className="hidden h-4 w-4 text-amber-400 sm:inline" aria-hidden />
                <Sparkles className="hidden h-3.5 w-3.5 text-amber-300 sm:inline" aria-hidden />
                <span className="hidden text-sm text-[var(--aloha-muted)] sm:inline">
                  Sản phẩm hot - Giá tốt mỗi ngày
                </span>
              </div>
              <p className="mt-1.5 pl-10 text-xs text-[var(--aloha-muted)] sm:hidden sm:text-sm">
                Sản phẩm hot - Giá tốt mỗi ngày
              </p>
            </div>
            {/* Desktop: Xem tất cả cạnh tiêu đề */}
            <Link
              href="/tim?sort=ban_chay&inStock=1&maxTon=8"
              className="home-low-stock__view-all hidden h-9 shrink-0 items-center justify-center rounded-full border border-[var(--aloha-green)]/40 px-4 text-sm font-semibold text-[var(--aloha-green-dark)] transition hover:bg-[var(--aloha-green-light)] sm:inline-flex"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="relative z-10 px-1 sm:px-2">
            <div className="embla embla--home-sale" ref={emblaRef}>
              <div className="embla__container">
                {products.map((p) => (
                  <div className="embla__slide" key={p.ma}>
                    <ProductCard product={p} shopee />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              aria-label="Sản phẩm trước"
              disabled={!canPrev}
              onClick={() => emblaApi?.scrollPrev()}
              className="home-low-stock__nav left-1 hidden sm:inline-flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Sản phẩm sau"
              disabled={!canNext}
              onClick={() => emblaApi?.scrollNext()}
              className="home-low-stock__nav right-1 hidden sm:inline-flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="relative z-10 mt-5 flex flex-col items-center gap-2.5">
            <p className="flex items-center justify-center gap-1.5 text-center text-sm italic text-[var(--aloha-green-dark)]">
              <Sprout className="h-4 w-4 text-[var(--aloha-green)]" aria-hidden />
              <span>Cây xanh nhỏ — Hạnh phúc lớn</span>
              <Heart className="h-3.5 w-3.5 text-[var(--aloha-muted)]" aria-hidden />
              <Heart className="h-3.5 w-3.5 text-[var(--aloha-muted)]" aria-hidden />
            </p>
            {/* Mobile: Xem tất cả dưới slogan */}
            <Link
              href="/tim?sort=ban_chay&inStock=1&maxTon=8"
              className="home-low-stock__view-all inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-full border border-[var(--aloha-green)]/40 px-4 text-sm font-semibold text-[var(--aloha-green-dark)] transition hover:bg-[var(--aloha-green-light)] sm:hidden"
            >
              Xem tất cả →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
