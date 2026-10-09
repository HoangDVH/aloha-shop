"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Building2, ChevronRight } from "lucide-react";
import { GiftCategoryNav } from "@/components/gift/GiftCategoryNav";

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

export function HomeGiftSection({ initialItems = [] }: { initialItems?: GiftCardItem[] }) {
  const [items, setItems] = useState<GiftCardItem[]>(initialItems);
  const [isVisible, setIsVisible] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#0E5242]">
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

        {/* Lưới Thẻ Quà Tặng Nghệ Thuật (Bấm trực tiếp vào từng mục để vào trang quà tặng đó) */}
        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            const firstCard = el.firstElementChild as HTMLElement | null;
            const cardWidth = firstCard?.offsetWidth || 260;
            const gap = 16;
            const index = Math.round(el.scrollLeft / (cardWidth + gap));
            setActiveIdx(Math.min(Math.max(0, index), items.length - 1));
          }}
          className="mt-8 sm:mt-10 -mx-4 px-4 flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:overflow-visible sm:pb-0"
        >
          {items.map((item, idx) => (
            <Link
              key={item._id || item.slug}
              href={`/qua-tang/${item.slug}`}
              className={`group flex w-[74vw] max-w-[310px] min-w-[250px] shrink-0 sm:w-auto sm:max-w-none sm:min-w-0 sm:shrink snap-start flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aloha-green)] hover:shadow-lg cursor-pointer ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${idx * 80 + 100}ms` }}
            >
              {/* Ảnh cây chụp thật (Khung vuông 1:1 thấy trọn vẹn toàn bộ ảnh) */}
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
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

        {/* Chấm phân trang chỉ báo vuốt ngang trên Mobile (Chuẩn Shopee / Apple) */}
        {items.length > 1 && (
          <div className="mt-1 flex items-center justify-center gap-1.5 sm:hidden" aria-hidden>
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  const card = el.children[i] as HTMLElement | undefined;
                  if (card) {
                    el.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
                  }
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  activeIdx === i ? "w-6 bg-[#0E5242]" : "w-1.5 bg-stone-300"
                }`}
                aria-label={`Chuyển tới gợi ý quà tặng ${i + 1}`}
              />
            ))}
          </div>
        )}

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
