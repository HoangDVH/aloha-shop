"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { ShopProduct } from "@/lib/api";
import {
  livePropsForMa,
  useLiveProductPrices,
} from "@/lib/useLiveProductPrices";

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
  const desktopItems = items.slice(0, 3);
  const liveMap = useLiveProductPrices(items);
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

          <div className="relative z-10 grid grid-cols-1 gap-7 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:gap-x-10">
            {/* Căn giữa nội dung bên dưới hình Flash Sale trên mọi màn hình. */}
            <div className="flex w-full shrink-0 flex-col items-center justify-center text-center lg:w-[min(100%,20rem)] xl:w-[22rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/banners/flash-sale-title.svg?v=2"
                alt="Flash Sale — Số lượng có hạn"
                width={600}
                height={185}
                className="h-auto w-full max-w-[28rem] lg:max-w-none"
              />

              <h2 className="mt-4 text-[1.85rem] font-black leading-[1.12] tracking-tight text-[var(--aloha-green-dark)] sm:mt-5 sm:text-[2.15rem] md:text-[2.35rem]">
                <span className="lg:hidden">Săn cây xinh - Giá cực hời</span>
                <span className="hidden lg:inline">
                  Săn cây xinh
                  <br />
                  Giá cực hời
                </span>
              </h2>

              <p className="mt-2 max-w-xs text-sm font-medium text-[var(--aloha-green-dark)]/75 sm:text-[15px] lg:max-w-none">
                Ưu đãi trong ngày — số lượng có hạn, chốt nhanh kẻo hết!
              </p>

              <div
                className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6 sm:gap-3"
                aria-label="Đếm ngược flash sale"
              >
                {units.map((b) => (
                  <div
                    key={b.label}
                    className="flex min-w-[3.6rem] flex-col items-center rounded-2xl bg-white px-2.5 py-2.5 text-center shadow-md ring-1 ring-black/10 sm:min-w-[4.1rem] sm:px-3 sm:py-3"
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

            </div>

            {/* Cột phải — mobile carousel; desktop lưới 3 cột đều */}
            <div className="relative min-w-0 flex-1 sm:px-1 lg:px-0">
              <div className="home-flash-sale__grid">
                {desktopItems.map((p) => (
                  <div className="home-flash-sale__card" key={p.ma}>
                    <ProductCard product={p} shopee {...livePropsForMa(liveMap, p.ma)} />
                  </div>
                ))}
              </div>

              <div className="embla embla--home-sale touch-pan-x lg:hidden" ref={emblaRef}>
                <div className="embla__container">
                  {items.map((p) => (
                    <div className="embla__slide" key={p.ma}>
                      <div className="home-flash-sale__card">
                        <ProductCard product={p} shopee {...livePropsForMa(liveMap, p.ma)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                aria-label="Sản phẩm trước"
                disabled={!canPrev}
                onClick={() => emblaApi?.scrollPrev()}
                className="home-low-stock__nav left-0 lg:hidden"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Sản phẩm sau"
                disabled={!canNext}
                onClick={() => emblaApi?.scrollNext()}
                className="home-low-stock__nav right-0 lg:hidden"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <Link
              href="/tim?sort=ban_chay&inStock=1&maxTon=8"
              className="inline-flex h-12 w-fit items-center justify-center justify-self-center rounded-full bg-[var(--aloha-green-dark)] px-7 text-[15px] font-bold text-white shadow-lg shadow-[var(--aloha-green-dark)]/25 transition hover:bg-[var(--aloha-green)] hover:shadow-xl sm:h-[3.25rem] sm:px-8 sm:text-base lg:col-start-2"
            >
              Mua ngay →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
