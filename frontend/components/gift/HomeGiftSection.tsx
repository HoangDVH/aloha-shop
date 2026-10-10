"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Building2, ChevronRight, ChevronLeft } from "lucide-react";
import { GiftCategoryNav } from "@/components/gift/GiftCategoryNav";
import { GiftImage } from "@/components/gift/GiftImage";

export interface GiftCardItem {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  recipientType: string;
  image: string;
  quote: string;
  includedItems: string;
  linkedProductCodes: string[];
  order: number;
  isActive: boolean;
}

function getShortGiftTitle(title: string): string {
  if (!title) return "";
  const parts = title.split(/[–—\-]/);
  if (parts.length > 1 && parts[0].trim().length > 0) {
    return parts[0].trim();
  }
  return title.trim();
}

export function HomeGiftSection({ initialItems = [] }: { initialItems?: GiftCardItem[] }) {
  const [items, setItems] = useState<GiftCardItem[]>(initialItems);
  const [isVisible, setIsVisible] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mobileSlide, setMobileSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    // Nếu chưa có server data, fetch client side
    if (!initialItems.length) {
      fetch("/api/shop/gifts")
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && Array.isArray(json.data)) {
            setItems(json.data);
          }
        })
        .catch(() => {});
    }
  }, [initialItems]);

  // Chia danh sách thành các slide (mỗi slide tối đa 2 mục quà tặng chuẩn UI mobile)
  const mobilePairs = useMemo(() => {
    if (!items.length) return [];
    if (items.length === 1) return [[items[0]]];
    const pairs: GiftCardItem[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      if (i + 1 < items.length) {
        pairs.push([items[i], items[i + 1]]);
      } else {
        pairs.push([items[i], items[0]]);
      }
    }
    return pairs;
  }, [items]);

  // Tự động chuyển động qua lại giữa các slide trên Mobile
  useEffect(() => {
    if (mobilePairs.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setMobileSlide((prev) => (prev + 1) % mobilePairs.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [mobilePairs.length, isPaused]);

  // Cử chỉ vuốt chạm chuyển slide trên Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 40) {
      setMobileSlide((prev) => (prev + 1) % mobilePairs.length);
    } else if (diff < -40) {
      setMobileSlide((prev) => (prev - 1 + mobilePairs.length) % mobilePairs.length);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="goi-y-qua-tang"
      className="relative overflow-hidden py-14 sm:py-18 lg:py-22 bg-[#FAF8F5]"
    >
      {/* Họa tiết lá trang trí mờ tinh tế */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/leaves-top.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 z-0 h-40 w-40 opacity-15 sm:h-56 sm:w-56"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/leaves-bl.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -left-8 -bottom-8 z-0 h-40 w-40 opacity-15 sm:h-56 sm:w-56"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Section: GỢI Ý CHỌN QUÀ TẶNG (Phong cách Là Cây Concept) */}
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 border border-emerald-200/80 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#0E5242]">
            <Sparkles size={13} className="text-[#C05621]" />
            <span>Aloha Gift Concierge</span>
          </div>

          <h2 data-scroll-reveal className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#0E5242]">
            GỢI Ý CHỌN QUÀ TẶNG
          </h2>

          {/* Nét cọ xanh vẽ tay (Brush stroke animation SVG) */}
          <div className="mx-auto mt-2 h-2.5 w-44 overflow-hidden">
            <svg
              viewBox="0 0 200 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`h-full w-full transition-all duration-1000 delay-300 ${
                isVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
              }`}
            >
              <path
                d="M3 8.5C45 2.5 155 3.5 197 7"
                stroke="#0E5242"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-80"
              />
            </svg>
          </div>

          <p className="mt-3 text-sm sm:text-base text-stone-600 leading-relaxed max-w-2xl mx-auto">
            Mỗi chậu cây là một thông điệp chân thành gửi trao — Tinh tế trong từng tán lá, chỉn chu từ chậu gốm đến thiệp viết tay mộc mạc.
          </p>
        </div>

        {/* Thanh Bộ Lọc Nhanh (Pills) chuyển trang trực tiếp */}
        <GiftCategoryNav activeKey="all" className="mt-8" />

        {/* ========================================================================= */}
        {/* GIAO DIỆN MOBILE (< 640px): CAROUSEL TỐI ĐA 2 MỤC QUÀ TẶNG, TỰ ĐỘNG CHUYỂN */}
        {/* ĐỘNG QUA LẠI, NÚT MŨI TÊN TRÒN 2 BÊN MÉP ẢNH, CHẤM TRÒN PHÂN TRANG         */}
        {/* ========================================================================= */}
        {mobilePairs.length > 0 && (
          <div
            className="relative mt-6 sm:hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Khung trượt chứa các cặp (2 mục quà tặng mỗi slide) */}
            <div className="relative overflow-hidden px-1">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${mobileSlide * 100}%)` }}
              >
                {mobilePairs.map((pair, pIdx) => (
                  <div key={pIdx} className="w-full shrink-0 grid grid-cols-2 gap-3 px-1">
                    {pair.map((item, itemIdx) => (
                      <Link
                        key={`${pIdx}-${item._id || item.slug}-${itemIdx}`}
                        href={`/qua-tang/${item.slug}`}
                        className="flex flex-col group select-none cursor-pointer active:opacity-90"
                      >
                        {/* Ảnh quà tặng tỉ lệ ngang chuẩn hình ảnh mẫu */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-stone-100 shadow-2xs">
                          <GiftImage
                            src={item.image}
                            slug={item.slug}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>

                        {/* Tiêu đề 2 dòng cố định chiều cao chuẩn sàn TMĐT (Shopee/Apple), hiển thị trọn vẹn 100% không bị che */}
                        <div className="mt-2 flex h-9 items-center justify-center px-0.5">
                          <h3 className="text-center text-[13px] font-semibold text-[#0E5242] line-clamp-2 leading-[1.25] break-words">
                            {getShortGiftTitle(item.title)}
                          </h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Nút điều hướng Tròn Trắng Mờ ở 2 bên mép (đặt ngang tâm ảnh chuẩn ảnh mẫu) */}
            {mobilePairs.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSlide((prev) => (prev - 1 + mobilePairs.length) % mobilePairs.length);
                  }}
                  className="absolute -left-1 top-[60px] -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md border border-stone-100 text-stone-700 active:scale-90 transition-transform cursor-pointer backdrop-blur-xs"
                  aria-label="Gợi ý quà tặng trước"
                >
                  <ChevronLeft size={18} strokeWidth={2.4} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileSlide((prev) => (prev + 1) % mobilePairs.length);
                  }}
                  className="absolute -right-1 top-[60px] -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md border border-stone-100 text-stone-700 active:scale-90 transition-transform cursor-pointer backdrop-blur-xs"
                  aria-label="Gợi ý quà tặng tiếp theo"
                >
                  <ChevronRight size={18} strokeWidth={2.4} />
                </button>
              </>
            )}

            {/* Chấm phân trang Dots căn giữa bên dưới (Chấm active đậm hơn như trong ảnh mẫu) */}
            {mobilePairs.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
                {mobilePairs.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMobileSlide(i)}
                    className={`rounded-full transition-all duration-300 cursor-pointer ${
                      mobileSlide === i
                        ? "h-2 w-2 bg-stone-700 scale-110"
                        : "h-1.5 w-1.5 bg-stone-300 hover:bg-stone-400"
                    }`}
                    aria-label={`Chuyển tới slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* GIAO DIỆN DESKTOP (sm:grid): GIỮ NGUYÊN LƯỚI THẺ QUÀ TẶNG NGHỆ THUẬT      */}
        {/* ========================================================================= */}
        <div
          ref={scrollRef}
          className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:mt-10 sm:overflow-visible sm:pb-0"
        >
          {items.map((item, idx) => (
            <Link
              key={item._id || item.slug}
              href={`/qua-tang/${item.slug}`}
              className={`group flex sm:w-auto sm:max-w-none sm:min-w-0 sm:shrink flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aloha-green)] hover:shadow-lg cursor-pointer ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${idx * 80 + 100}ms` }}
            >
              {/* Ảnh cây chụp thật (Khung vuông 1:1 thấy trọn vẹn toàn bộ ảnh) */}
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <GiftImage
                  src={item.image}
                  slug={item.slug}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-103"
                />
                {/* Tag góc trái */}
                <span className="absolute left-2.5 top-2.5 rounded-full bg-[#0E5242]/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {item.tag}
                </span>
              </div>

              {/* Nội dung cảm xúc tối giản, thanh lịch như Là Cây */}
              <div className="mt-3.5 flex flex-1 flex-col">
                <h3 className="text-base font-bold text-stone-900 group-hover:text-[#0E5242] transition line-clamp-2 leading-snug">
                  {item.title}
                </h3>

                <p className="mt-1.5 text-xs text-stone-500 leading-relaxed line-clamp-2">
                  {item.subtitle || item.quote}
                </p>

                {/* Nút Khám phá */}
                <div className="mt-auto pt-4">
                  <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-50 py-2.5 text-xs font-bold text-[#0E5242] border border-stone-200/90 transition group-hover:bg-[#0E5242] group-hover:text-white group-hover:border-[#0E5242]">
                    <span>Khám phá món quà</span>
                    <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Khối kích hoạt quà doanh nghiệp (Hiển thị trọn vẹn 100% chữ, tối ưu nhỏ gọn trên Mobile) */}
        <div className="mt-8 sm:mt-12 rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-6">
            {/* Cụm Icon + Nội dung đầy đủ */}
            <div className="flex items-start gap-3 sm:gap-4 text-left">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mt-0.5">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-stone-900 leading-snug">
                  Bạn cần đặt quà số lượng lớn cho công ty hoặc sự kiện?
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-stone-500 leading-relaxed">
                  Aloha hỗ trợ in logo doanh nghiệp lên chậu, khắc tag gỗ theo tên và xuất hóa đơn VAT đầy đủ.
                </p>
              </div>
            </div>

            {/* Nút Xem hồ sơ dự án B2B */}
            <div className="sm:shrink-0 pt-0.5 sm:pt-0">
              <Link
                href="/qua-tang/doanh-nghiep"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-[#0E5242] px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#156e59] transition cursor-pointer"
              >
                <span>Xem hồ sơ dự án B2B</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
