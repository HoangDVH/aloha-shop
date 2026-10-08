"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Gift, Check, Building2 } from "lucide-react";

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

const FILTER_PILLS = [
  { key: "all", label: "Tất cả gợi ý" },
  { key: "nguoi-thuong", label: "🌸 Dành Cho Nàng (20/10)" },
  { key: "gia-dinh", label: "🏡 Gia Đình & Mẹ" },
  { key: "khai-truong", label: "🏢 Khai Trương & Thăng Chức" },
  { key: "ban-lam-viec", label: "🌿 Bàn Làm Việc" },
  { key: "doanh-nghiep", label: "💼 Quà Doanh Nghiệp (B2B)" },
];

export function HomeGiftSection({ initialItems = [] }: { initialItems?: GiftCardItem[] }) {
  const [items, setItems] = useState<GiftCardItem[]>(initialItems);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

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

  const handleFilterClick = (filterKey: string) => {
    if (filterKey === "doanh-nghiep") {
      window.location.href = "/qua-tang/doanh-nghiep";
      return;
    }
    setActiveFilter(filterKey);
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter === "all") return true;
    return item.recipientType === activeFilter;
  });

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

        {/* Thanh Bộ Lọc Nhanh (Pills) */}
        <div className="mt-8 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {FILTER_PILLS.map((pill) => {
            const isActive = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => handleFilterClick(pill.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition duration-200 ${
                  isActive
                    ? "bg-[#0E5242] text-white shadow-sm"
                    : "bg-white text-stone-600 border border-stone-200/80 hover:border-emerald-300 hover:text-stone-900"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Lưới Thẻ Quà Tặng Nghệ Thuật (Desktop: Grid / Mobile: Scroll-snap với Peek 15%) */}
        <div className="mt-10 flex gap-5 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:pb-0">
          {filteredItems.map((item, idx) => (
            <div
              key={item._id || item.slug}
              className={`group flex min-w-[85vw] sm:min-w-0 snap-center flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aloha-green)] hover:shadow-lg ${
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
                  <Link
                    href={`/qua-tang/${item.slug}`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-50 py-2.5 text-xs font-bold text-[#0E5242] border border-stone-200/90 transition group-hover:bg-[#0E5242] group-hover:text-white group-hover:border-[#0E5242]"
                  >
                    <span>Khám phá món quà</span>
                    <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Khối kích hoạt quà doanh nghiệp nếu người dùng muốn tư vấn riêng */}
        <div className="mt-12 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-stone-900">
                Bạn cần đặt quà số lượng lớn cho công ty hoặc sự kiện?
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Aloha hỗ trợ in logo doanh nghiệp lên chậu, khắc tag gỗ theo tên và xuất hóa đơn VAT đầy đủ.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleFilterClick("doanh-nghiep")}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#0E5242] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#156e59] transition"
          >
            <span>Xem hồ sơ dự án B2B</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
