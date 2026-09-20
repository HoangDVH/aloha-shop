"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { ShopProduct } from "@/lib/api";

type Props = {
  products: ShopProduct[];
};

/** Flash sale kết thúc cuối ngày hôm nay (+ hiện đủ Ngày/Giờ/Phút/Giây như mock). */
function endOfTodayMs() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function useFlashCountdown() {
  const [left, setLeft] = useState({ d: "00", h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, endOfTodayMs() - Date.now());
      const totalSec = Math.floor(ms / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setLeft({ d: pad(d), h: pad(h), m: pad(m), s: pad(s) });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return left;
}

export function HomeLowStockSale({ products }: Props) {
  const items = products.slice(0, 6);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const cd = useFlashCountdown();

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
  }, [emblaApi, onSelect, items.length]);

  if (!items.length) return null;

  const units = [
    { label: "Ngày", v: cd.d },
    { label: "Giờ", v: cd.h },
    { label: "Phút", v: cd.m },
    { label: "Giây", v: cd.s },
  ];

  return (
    <section className="home-flash-sale bg-white py-7 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="home-flash-sale__panel relative overflow-hidden rounded-[1.35rem] px-4 py-7 sm:px-7 sm:py-8 md:px-10 md:py-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/banners/banner-flash-sale-decor.png?v=2"
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-45"
          />

          <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-stretch lg:gap-10">
            {/* Cột trái — promo lớn hơn để hút mắt */}
            <div className="flex w-full shrink-0 flex-col justify-center lg:w-[min(100%,22rem)] xl:w-[24rem]">
              <span className="home-flash-sale__badge inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--aloha-green-dark)] px-4 py-1.5 text-[12px] font-extrabold tracking-wide text-white shadow-md sm:px-5 sm:py-2 sm:text-[13px]">
                <Flame size={15} strokeWidth={2.4} className="text-[#ffd666]" aria-hidden />
                Flash Sale
              </span>

              <h2 className="mt-4 text-[1.85rem] font-black leading-[1.12] tracking-tight text-[var(--aloha-green-dark)] sm:mt-5 sm:text-[2.15rem] md:text-[2.35rem]">
                Săn cây xinh
                <br />
                Giá cực hời
              </h2>

              <p className="mt-2 max-w-xs text-sm font-medium text-[var(--aloha-green-dark)]/75 sm:text-[15px]">
                Ưu đãi trong ngày — số lượng có hạn, chốt nhanh kẻo hết!
              </p>

              <div
                className="mt-5 flex flex-wrap gap-2 sm:mt-6 sm:gap-3"
                aria-label="Đếm ngược flash sale"
              >
                {units.map((b) => (
                  <div
                    key={b.label}
                    className="flex min-w-[3.6rem] flex-col items-center rounded-2xl bg-white px-2.5 py-2.5 shadow-md ring-1 ring-black/5 sm:min-w-[4.1rem] sm:px-3 sm:py-3"
                  >
                    <span className="text-xl font-black tabular-nums leading-none text-[var(--aloha-green-dark)] sm:text-2xl">
                      {b.v}
                    </span>
                    <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--aloha-muted)] sm:text-[11px]">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/tim?sort=ban_chay&inStock=1&maxTon=8"
                className="mt-6 inline-flex h-12 w-fit items-center justify-center rounded-full bg-[var(--aloha-green-dark)] px-7 text-[15px] font-bold text-white shadow-lg shadow-[var(--aloha-green-dark)]/25 transition hover:bg-[var(--aloha-green)] hover:shadow-xl sm:mt-7 sm:h-[3.25rem] sm:px-8 sm:text-base"
              >
                Mua ngay →
              </Link>
            </div>

            {/* Cột phải — card SP */}
            <div className="relative min-w-0 flex-1">
              <div className="embla embla--home-sale" ref={emblaRef}>
                <div className="embla__container">
                  {items.map((p) => (
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
                className="home-low-stock__nav left-0 hidden sm:inline-flex"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Sản phẩm sau"
                disabled={!canNext}
                onClick={() => emblaApi?.scrollNext()}
                className="home-low-stock__nav right-0 hidden sm:inline-flex"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
