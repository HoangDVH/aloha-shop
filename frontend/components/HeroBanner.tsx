"use client";

import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type HeroSlide = {
  src: string;
  alt: string;
  href?: string;
  label?: string;
};

/** Ảnh fallback khi admin chưa cấu hình slides */
export const BRAND_BANNERS: HeroSlide[] = [
  {
    src: "/banners/banner-cay-canh.png",
    alt: "Cây cảnh & chậu ALOHA",
    href: "/tim?q=cay+canh",
    label: "Cây cảnh & chậu",
  },
  {
    src: "/banners/banner-dat-phan.png",
    alt: "Đất trồng & phân bón",
    href: "/tim?q=dat",
    label: "Đất & phân",
  },
  {
    src: "/banners/banner-hat-giong.png",
    alt: "Hạt giống chất lượng",
    href: "/tim?q=hat+giong",
    label: "Hạt giống",
  },
];

const ZALO_SI = "https://zalo.me/0794901233";
const AUTOPLAY_MS = 5200;

/** Hero 2 cột: copy kích mua + showcase sản phẩm. */
export function HeroBanner({ slides }: { slides?: HeroSlide[] }) {
  const items = slides && slides.length ? slides : BRAND_BANNERS;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "center",
      skipSnaps: false,
      containScroll: false,
      startIndex: 0,
    },
    [
      Autoplay({
        delay: AUTOPLAY_MS,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ]
  );
  const [selected, setSelected] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setProgressKey((k) => k + 1);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    // Đo lại kích thước sau layout (mobile hay lệch trái nếu chưa reInit)
    const t = window.setTimeout(() => emblaApi.reInit(), 50);
    const onResize = () => emblaApi.reInit();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const active = items[selected] || items[0];

  return (
    <section className="hero-banner" aria-label="Banner cửa hàng">
      <div className="hero-banner__bg" aria-hidden>
        <span className="hero-banner__orb hero-banner__orb--a" />
        <span className="hero-banner__orb hero-banner__orb--b" />
        <span className="hero-banner__leaf hero-banner__leaf--1" />
        <span className="hero-banner__leaf hero-banner__leaf--2" />
        <span className="hero-banner__leaf hero-banner__leaf--3" />
        <span className="hero-banner__mesh" />
      </div>

      <div className="hero-banner__inner">
        {/* display:contents trên mobile → reorder: chữ → ảnh → nút */}
        <div className="hero-banner__left">
          <div className="hero-banner__copy">
            <h1 className="hero-banner__title">
              <span className="hero-banner__headline">
                Biến góc nhà thành
                <em> khu vườn xanh</em>
              </span>
            </h1>

            <p className="hero-banner__desc">
              <span className="hero-banner__desc-full">
                Chậu đẹp · cây khỏe · đất & phân chuẩn — chọn dễ, đặt nhanh, nhận
                hàng mới trả tiền.
              </span>
              <span className="hero-banner__desc-short">
                Chậu đẹp · cây khỏe · đặt nhanh · COD tiện lợi.
              </span>
            </p>
          </div>

          <div className="hero-banner__actions">
            <Link
              href={active?.href || "/tim?sort=ban_chay"}
              className="hero-banner__cta hero-banner__cta--primary"
            >
              Mua ngay
              <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
            </Link>
            <a
              href={ZALO_SI}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-banner__cta hero-banner__cta--ghost"
            >
              Báo giá sỉ · Zalo
            </a>
          </div>
        </div>

        <div className="hero-banner__media">
          <div className="hero-banner__showcase">
            {active?.label ? (
              <div className="hero-banner__chip" key={active.label}>
                {active.label}
              </div>
            ) : null}

            <div className="hero-banner__stage">
              <div className="embla embla--hero" ref={emblaRef}>
                <div className="embla__container">
                  {items.map((slide, i) => (
                    <div
                      className={`embla__slide ${i === selected ? "is-active" : ""}`}
                      key={`${slide.src}-${i}`}
                    >
                      <Link
                        href={slide.href || "/tim"}
                        className="hero-banner__frame"
                        aria-label={slide.alt || slide.label || "Xem sản phẩm"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slide.src}
                          alt={slide.alt}
                          className="hero-banner__img"
                          loading={i === 0 ? "eager" : "lazy"}
                          fetchPriority={i === 0 ? "high" : undefined}
                        />
                        <span className="hero-banner__shine" aria-hidden />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hero-banner__controls">
            <button
              type="button"
              aria-label="Slide trước"
              className="hero-banner__nav"
              onClick={() => emblaApi?.scrollPrev()}
            >
              <ChevronLeft size={18} />
            </button>

            <div className="hero-banner__dots" role="tablist" aria-label="Chọn banner">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === selected}
                  aria-label={`Banner ${i + 1}`}
                  className={`hero-banner__dot ${i === selected ? "is-active" : ""}`}
                  onClick={() => emblaApi?.scrollTo(i)}
                >
                  {i === selected ? (
                    <span
                      key={progressKey}
                      className="hero-banner__dot-progress"
                      style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                    />
                  ) : null}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-label="Slide sau"
              className="hero-banner__nav"
              onClick={() => emblaApi?.scrollNext()}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
