"use client";

import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type HeroSlide = {
  src: string;
  /** Ảnh riêng cho màn hình < 768px (mobile chỉ tải ảnh này). */
  mobileSrc?: string;
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

/** 4 banner hero — chữ + CTA đã nằm trong ảnh. */
export const BRAND_BANNERS: HeroSlide[] = [
  {
    src: "/banners/banner-hero-01.png?v=23",
    alt: "ALOHA — Đa dạng mẫu mã, phối theo yêu cầu",
    href: "/tim",
    label: "Tất cả sản phẩm",
    eyebrow: "Đa dạng mẫu mã",
    title: "Phối theo yêu cầu",
    desc: "Hàng nghìn mẫu chậu, cây và phụ kiện.",
    cta: "Mua ngay",
  },
  {
    src: "/banners/banner-hero-03.png?v=22",
    alt: "ALOHA — Sản phẩm chất lượng, tuyển chọn kỹ",
    href: "/danh-muc/cay-canh-du-loai",
    label: "Cây cảnh",
    eyebrow: "Sản phẩm chất lượng",
    title: "Tuyển chọn kỹ",
    desc: "Cây khỏe, chậu đẹp, phối hài hòa. Kiểm tra kỹ trước khi giao đến khách hàng.",
    cta: "Mua ngay",
  },
  {
    src: "/banners/banner-hero-02.png?v=22",
    alt: "ALOHA — Ưu đãi và dịch vụ dành cho khách sỉ",
    href: "/dang-ky-si",
    label: "Khách sỉ",
    eyebrow: "Ưu đãi và dịch vụ",
    title: "Dành cho khách sỉ",
    desc: "Đồng hành lâu dài, hợp tác bền vững cùng ALOHA.",
    cta: "Đăng ký sỉ",
  },
  {
    src: "/banners/bannerctv.png?v=7",
    alt: "Cộng tác viên Aloha — Trở thành CTV Aloha, kiếm thêm thu nhập cùng Aloha",
    href: "/tuyen-ctv",
    label: "CTV Aloha",
    eyebrow: "Cộng tác viên Aloha",
    title: "Trở thành CTV Aloha, kiếm thêm thu nhập cùng Aloha",
    desc: "Chia sẻ sản phẩm cây/chậu và nhận hoa hồng từ đơn hàng thành công.",
    cta: "Đăng ký ngay",
  },
];

const AUTOPLAY_MS = 5600;

function isLegacyBannerSrc(src: string) {
  return /banner-cay-canh|banner-dat-phan|banner-hat-giong|bannerctv|banner-hero-aloha|banner-01-|banner-02-|banner-03-|banner-04-/i.test(
    src,
  );
}

function pickText(override: string | undefined, fallback: string) {
  const t = String(override || "").trim();
  return t || fallback;
}

const srcKey = (src: string) => String(src || "").split("?")[0];

/**
 * Giữ thứ tự và đích đến của bộ banner; cấu hình cũ không ghi đè liên kết.
 * Ghép nội dung theo ảnh, không theo vị trí cũ sau khi đổi thứ tự.
 */
function baseSlides(slides?: HeroSlide[]): HeroSlide[] {
  return BRAND_BANNERS.map((brand) => {
    const s = slides?.find((slide) => srcKey(slide.src) === srcKey(brand.src));
    if (!s || isLegacyBannerSrc(String(s.src || ""))) return brand;
    return { ...brand, label: pickText(s.label, brand.label || ""), alt: pickText(s.alt, brand.alt) };
  });
}

/**
 * Banner chính trang chủ:
 * - Khi CÓ chiến dịch: Chỉ hiển thị 1 tấm banner chính duy nhất (tĩnh, không slider qua lại, không nút điều hướng).
 * - Khi KHÔNG CÓ chiến dịch: Sử dụng slider qua lại với các banner thương hiệu như bình thường.
 */
export function HeroBanner({
  slides,
  leading,
  single,
}: {
  slides?: HeroSlide[];
  leading?: HeroSlide[];
  single?: boolean;
}) {
  const isSingle = single ?? Boolean(leading && leading.length > 0);
  const singleSlide = leading?.[0] || (slides?.length ? baseSlides(slides)[0] : BRAND_BANNERS[0]);

  const items = baseSlides(slides);
  const itemsKey = items.map((s) => s.src).join("|");

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
    ],
  );
  const [selected, setSelected] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setProgressKey((k) => k + 1);
  }, [emblaApi]);

  useEffect(() => {
    if (isSingle || !emblaApi) return;
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
  }, [isSingle, emblaApi, onSelect]);

  useEffect(() => {
    if (isSingle || !emblaApi) return;
    emblaApi.reInit();
    emblaApi.scrollTo(0, true);
  }, [isSingle, emblaApi, itemsKey]);

  // 1. Khi có chiến dịch: Chỉ hiển thị duy nhất 1 tấm banner chính tĩnh
  if (isSingle) {
    return (
      <section
        className="hero-banner hero-banner--full"
        aria-label="Banner cửa hàng"
      >
        <div className="hero-banner__full-inner">
          <div className="hero-banner__stage">
            <Link
              href={singleSlide.href || "/tim"}
              className="hero-banner__frame block h-full w-full"
              aria-label={singleSlide.cta || "Mua ngay"}
            >
              <picture className="block h-full w-full">
                {singleSlide.mobileSrc ? <source media="(max-width: 767px)" srcSet={singleSlide.mobileSrc} /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={singleSlide.src}
                  alt={singleSlide.alt}
                  className="hero-banner__img"
                  loading="eager"
                  fetchPriority="high"
                />
              </picture>
            </Link>

            {/* Ảnh đã có chữ + CTA — chỉ giữ h1 ẩn cho SEO/a11y */}
            <h1 className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
              {singleSlide?.eyebrow ? `${singleSlide.eyebrow}. ` : ""}
              {singleSlide?.title || "ALOHA THẾ GIỚI CHẬU CÂY"}
            </h1>
          </div>
        </div>
      </section>
    );
  }

  // 2. Khi không có chiến dịch: Dùng slider qua lại như bình thường
  const active = items[selected] || items[0];

  return (
    <section
      className="hero-banner hero-banner--full"
      aria-label="Banner cửa hàng"
    >
      <div className="hero-banner__full-inner">
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
                    className="hero-banner__frame block h-full w-full"
                    aria-label={slide.cta || "Mua ngay"}
                  >
                    <picture className="block h-full w-full">
                      {slide.mobileSrc ? <source media="(max-width: 767px)" srcSet={slide.mobileSrc} /> : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.src}
                        alt={slide.alt}
                        className="hero-banner__img"
                        loading={i === 0 ? "eager" : "lazy"}
                        fetchPriority={i === 0 ? "high" : undefined}
                      />
                    </picture>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Ảnh đã có chữ + CTA — chỉ giữ h1 ẩn cho SEO/a11y */}
          <h1 className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
            {active?.eyebrow ? `${active.eyebrow}. ` : ""}
            {active?.title || "ALOHA THẾ GIỚI CHẬU CÂY"}
          </h1>
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

          <div
            className="hero-banner__dots"
            role="tablist"
            aria-label="Chọn banner"
          >
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
