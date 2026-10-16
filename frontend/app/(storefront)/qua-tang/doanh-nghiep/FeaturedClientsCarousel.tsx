"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react";

export interface FeaturedClient {
  name: string;
  category: string;
  scale: string;
  image: string;
}

interface FeaturedClientsCarouselProps {
  clients: FeaturedClient[];
}

export function FeaturedClientsCarousel({ clients }: FeaturedClientsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewClient, setPreviewClient] = useState<FeaturedClient | null>(null);

  // Update active dot when user scrolls horizontally
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !el.children.length) return;

    const scrollLeft = el.scrollLeft;
    const card = el.children[0] as HTMLElement;
    const cardWidth = card.offsetWidth;
    const gap = 16; // approx gap in px
    const newIndex = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.max(0, Math.min(newIndex, clients.length - 1)));
  }, [clients.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Smooth scroll to a specific index
  const scrollToIndex = (index: number) => {
    const el = containerRef.current;
    if (!el || !el.children[index]) return;
    const targetCard = el.children[index] as HTMLElement;
    targetCard.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
    setActiveIndex(index);
  };

  const handlePrev = () => {
    if (activeIndex > 0) scrollToIndex(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < clients.length - 1) scrollToIndex(activeIndex + 1);
  };

  return (
    <div>
      {/*
        Container:
        - Mobile: flex ngang cuộn vuốt snap-x, có peek effect (w-[82vw])
        - Desktop (sm+): grid 2 cột (sm) hoặc 4 cột (lg)
      */}
      <div
        ref={containerRef}
        className="
          flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 pb-2 no-scrollbar
          -mx-4 px-4 sm:mx-0 sm:px-0
          sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-visible sm:pb-0
        "
      >
        {clients.map((client, idx) => (
          <div
            key={idx}
            className="
              snap-start shrink-0 w-[82vw] max-w-[328px] sm:w-auto sm:max-w-none
              group relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white
              shadow-xs transition duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col
            "
          >
            {/* Ảnh sản phẩm thực tế */}
            <div
              className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100 cursor-pointer"
              onClick={() => setPreviewClient(client)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={client.image}
                alt={client.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />

              {/* Overlay gợi ý phóng to */}
              <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-xs px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm">
                  <Eye size={14} />
                  <span>Xem ảnh lớn</span>
                </span>
              </div>

              {/* Huy hiệu thứ tự góc trên mobile */}
              <div className="absolute top-2.5 right-2.5 sm:hidden rounded-full bg-stone-900/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-white">
                {idx + 1}/{clients.length}
              </div>
            </div>

            {/* Thông tin dự án */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded">
                  {client.category}
                </span>
                <h4 className="mt-2 text-sm font-bold text-stone-900 line-clamp-1 group-hover:text-[var(--aloha-green,#1C4C40)] transition-colors">
                  {client.name}
                </h4>
                <p className="mt-1 text-xs text-stone-600 line-clamp-2">
                  {client.scale}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Đã bàn giao
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewClient(client)}
                  className="text-stone-500 hover:text-stone-800 font-medium"
                >
                  Chi tiết ảnh
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/*
        Bảng điều khiển Carousel (CHỈ HIỂN THỊ TRÊN MOBILE):
        - Pagination dots
        - Nút bấm qua lại (Prev / Next)
        - Đếm số lượng
      */}
      <div className="flex sm:hidden items-center justify-between mt-4 px-1">
        {/* Nút Prev */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={activeIndex === 0}
          aria-label="Dự án trước"
          className="
            flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white
            text-stone-700 shadow-2xs transition active:scale-95 disabled:opacity-35 disabled:pointer-events-none
          "
        >
          <ChevronLeft size={16} />
        </button>

        {/* Thanh Dots indicator */}
        <div className="flex items-center gap-1.5">
          {clients.map((_, dotIdx) => {
            const isActive = dotIdx === activeIndex;
            return (
              <button
                key={dotIdx}
                type="button"
                onClick={() => scrollToIndex(dotIdx)}
                aria-label={`Chuyển đến dự án ${dotIdx + 1}`}
                className={`
                  h-2 rounded-full transition-all duration-300
                  ${isActive ? "w-6 bg-[var(--aloha-green,#1C4C40)]" : "w-2 bg-stone-300 hover:bg-stone-400"}
                `}
              />
            );
          })}
        </div>

        {/* Nút Next */}
        <button
          type="button"
          onClick={handleNext}
          disabled={activeIndex === clients.length - 1}
          aria-label="Dự án tiếp theo"
          className="
            flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white
            text-stone-700 shadow-2xs transition active:scale-95 disabled:opacity-35 disabled:pointer-events-none
          "
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Gợi ý vuốt nhẹ trên mobile */}
      <div className="mt-2 text-center sm:hidden">
        <span className="text-[11px] text-stone-600 font-medium">
          ← Vuốt ngang để xem thêm {clients.length} dự án →
        </span>
      </div>

      {/*
        Lightbox Modal xem ảnh phóng to khi bấm vào thẻ
      */}
      {previewClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setPreviewClient(null)}
        >
          <div
            className="relative max-w-2xl w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setPreviewClient(null)}
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-xs transition hover:bg-black/70"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>

            {/* Ảnh lớn */}
            <div className="relative aspect-[4/3] w-full bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewClient.image}
                alt={previewClient.name}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Thông tin bên dưới ảnh */}
            <div className="p-4 sm:p-5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                {previewClient.category}
              </span>
              <h3 className="mt-2 text-base sm:text-lg font-bold text-stone-900">
                {previewClient.name}
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                {previewClient.scale}
              </p>
              <p className="mt-3 text-xs text-stone-600 italic">
                * Ảnh chụp thực tế sản phẩm được thiết kế và bàn giao bởi đội ngũ Aloha.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
