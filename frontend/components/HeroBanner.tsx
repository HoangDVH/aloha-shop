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
  /** Dòng script xanh (tuỳ chọn) */
  eyebrow?: string;
  /** Tiêu đề chính */
  title?: string;
  /** Mô tả ngắn */
  desc?: string;
  /** Nhãn nút CTA */
  cta?: string;
};

/** Banner hero — chữ liền mạch, ảnh một tông kem. */
export const BRAND_BANNERS: HeroSlide[] = [
  {
    src: "/banners/banner-hero-01.png?v=13",
    alt: "Cây cảnh và chậu cây ALOHA",
    href: "/tim?q=cay+canh",
    label: "Cây cảnh",
    eyebrow: "Mang thiên nhiên",
    title: "Vào không gian sống của bạn",
    desc: "Chậu cây cảnh đa dạng, đẹp mắt, chất lượng cao cho ngôi nhà thêm xanh và hạnh phúc.",
    cta: "Khám phá ngay",
  },
  {
    src: "/banners/banner-hero-02.png?v=13",
    alt: "Đất trồng phân bón dụng cụ chăm sóc cây",
    href: "/tim?q=dat+trong",
    label: "Đất trồng",
    eyebrow: "Đất và chăm sóc",
    title: "Đất trồng cao cấp, cây khỏe từ gốc",
    desc: "Đất sạch, phân hữu cơ, dụng cụ chăm sóc — đủ bộ để cây nhà bạn phát triển tốt.",
    cta: "Xem đất trồng",
  },
  {
    src: "/banners/banner-hero-03.png?v=13",
    alt: "Hạt giống ALOHA",
    href: "/tim?q=hat+giong",
    label: "Hạt giống",
    eyebrow: "Hạt giống",
    title: "Khởi nguồn cho sự sống",
    desc: "Hạt giống đa dạng, tỷ lệ nảy mầm cao — dễ gieo, dễ chăm, xanh ngay từ những ngày đầu.",
    cta: "Xem hạt giống",
  },
  {
    src: "/banners/banner-hero-04.png?v=13",
    alt: "Ưu đãi dịch vụ khách sỉ ALOHA",
    href: "/tim?q=bao+gia+si",
    label: "Khách sỉ",
    eyebrow: "Khách sỉ",
    title: "Ưu đãi và dịch vụ dành cho khách sỉ",
    desc: "Đồng hành lâu dài — chiết khấu hấp dẫn, nguồn hàng ổn định, giao hàng toàn quốc.",
    cta: "Liên hệ ngay",
  },
];

const AUTOPLAY_MS = 5600;

function isLegacyBannerSrc(src: string) {
  return /banner-cay-canh|banner-dat-phan|banner-hat-giong|banner-01-|banner-02-|banner-03-|banner-04-/i.test(
    src
  );
}

function pickText(override: string | undefined, fallback: string) {
  const t = String(override || "").trim();
  return t || fallback;
}

/** Hero full-bleed: cao = 1 viewport trừ header+nav, ngang 100%. */
export function HeroBanner({ slides }: { slides?: HeroSlide[] }) {
  // Luôn dùng 4 ảnh + chữ brand; appearance chỉ được đổi href nếu hợp lệ.
  // Tránh Mongo slide cũ (thiếu SP / src lệch) làm banner trống.
  const items = BRAND_BANNERS.map((brand, i) => {
    const s = slides?.[i];
    if (!s || isLegacyBannerSrc(String(s.src || ""))) return brand;
    const href = String(s.href || "").trim();
    return {
      ...brand,
      href: href || brand.href,
      label: pickText(s.label, brand.label || ""),
      alt: pickText(s.alt, brand.alt),
    };
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      skipSnaps: false,
      containScroll: "trimSnaps",
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
    <section className="hero-banner hero-banner--full" aria-label="Banner cửa hàng">
      <div className="hero-banner__full-inner">
        <div className="hero-banner__stage">
          <div className="embla embla--hero" ref={emblaRef}>
            <div className="embla__container">
              {items.map((slide, i) => (
                <div
                  className={`embla__slide ${i === selected ? "is-active" : ""}`}
                  key={`${slide.src}-${i}`}
                >
                  <div className="hero-banner__frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      className="hero-banner__img"
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chữ + CTA nằm vùng trống bên trái ảnh */}
          <div className="hero-banner__copy-overlay">
            <p className="hero-banner__eyebrow-script">
              {active?.eyebrow || "Mang thiên nhiên"}
            </p>
            <h1 className="hero-banner__headline-overlay">
              {active?.title || "Vào không gian sống của bạn"}
            </h1>
            <p className="hero-banner__desc-overlay">
              {active?.desc ||
                "Chậu cây cảnh đa dạng, đẹp mắt, chất lượng cao cho ngôi nhà thêm xanh."}
            </p>
            <Link
              href={active?.href || "/tim"}
              className="hero-banner__cta hero-banner__cta--primary"
            >
              {active?.cta || "Khám phá ngay"}
              <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
            </Link>
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
    </section>
  );
}
