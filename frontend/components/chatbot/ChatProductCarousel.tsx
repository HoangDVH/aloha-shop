"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export type ProductCard = {
  ma: string;
  ten: string;
  giaBan: number;
  image?: string;
  url: string;
  ton?: number;
  webBadge?: string;
};

export type SearchLink = {
  title?: string;
  label?: string;
  url: string;
  query?: string;
};

export type GiftCard = {
  slug: string;
  title: string;
  tag: string;
  subtitle: string;
  url: string;
  buttonText: string;
};

interface ChatProductCarouselProps {
  productCards: ProductCard[];
  searchLink?: SearchLink;
  giftCard?: GiftCard;
  zaloHref: string;
  onNavigate?: () => void;
}

export function ChatProductCarousel({
  productCards,
  searchLink,
  giftCard,
  zaloHref,
  onNavigate,
}: ChatProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  // Cập nhật trạng thái nút Prev / Next
  const checkScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScrollState();
    el.addEventListener("scroll", checkScrollState, { passive: true });

    // Hỗ trợ cuộn chuột máy tính (Mouse wheel chuyển thành trượt ngang)
    const onWheel = (e: WheelEvent) => {
      // Khi người dùng lăn chuột lên/xuống (deltaY)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 0) return;

        const canRight = el.scrollLeft < maxScroll - 2;
        const canLeft = el.scrollLeft > 2;

        if ((e.deltaY > 0 && canRight) || (e.deltaY < 0 && canLeft)) {
          e.preventDefault();
          el.scrollBy({ left: e.deltaY * 1.2, behavior: "auto" });
        }
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", checkScrollState);

    return () => {
      el.removeEventListener("scroll", checkScrollState);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [checkScrollState, productCards.length]);

  // Cuộn bằng nút bấm
  const scrollByDirection = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 190; // Kích thước xấp xỉ 1 thẻ sản phẩm
    el.scrollBy({
      left: direction * cardWidth,
      behavior: "smooth",
    });
  };

  // Kéo chuột để trượt (Mouse Drag-to-Scroll cho desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    hasDragged.current = false;
    dragStartX.current = e.pageX - el.offsetLeft;
    dragStartScrollLeft.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX.current) * 1.3;
    if (Math.abs(walk) > 5) {
      hasDragged.current = true;
    }
    el.scrollLeft = dragStartScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onNavigate?.();
  };

  return (
    <div className="space-y-1.5 pt-1.5 group/carousel relative">
      {/* Thanh tiêu đề & Các nút điều hướng */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11.5px] font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber-500 shrink-0" />
          <span>Gợi ý mẫu phù hợp ({productCards.length})</span>
        </p>

        <div className="flex items-center gap-2">
          {/* 2 nút điều hướng mũi tên dành riêng cho Desktop */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100/90 rounded-full p-0.5 border border-slate-200/80">
            <button
              type="button"
              onClick={() => scrollByDirection(-1)}
              disabled={!canScrollLeft}
              className="h-5 w-5 rounded-full bg-white flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs"
              title="Xem mẫu trước"
              aria-label="Xem mẫu trước"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              type="button"
              onClick={() => scrollByDirection(1)}
              disabled={!canScrollRight}
              className="h-5 w-5 rounded-full bg-white flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs"
              title="Xem mẫu kế tiếp"
              aria-label="Xem mẫu kế tiếp"
            >
              <ChevronRight size={12} />
            </button>
          </div>

          {searchLink ? (
            <Link
              href={searchLink.url}
              onClick={handleLinkClick}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              <span>Xem tất cả</span>
              <ArrowRight size={11} />
            </Link>
          ) : giftCard ? (
            <Link
              href={giftCard.url}
              onClick={handleLinkClick}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              <span>Xem toàn bộ</span>
              <ArrowRight size={11} />
            </Link>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium sm:hidden">Vuốt sang →</span>
          )}
        </div>
      </div>

      {/* Vùng danh sách trượt ngang (hỗ trợ cuộn chuột + kéo chuột + nút bấm) */}
      <div className="relative">
        {/* Nút mũi tên nổi bên trái (Desktop) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByDirection(-1)}
            aria-label="Trượt sang trái"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md border border-slate-200/90 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all -ml-2"
          >
            <ChevronLeft size={15} />
          </button>
        )}

        {/* Nút mũi tên nổi bên phải (Desktop) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByDirection(1)}
            aria-label="Trượt sang phải"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md border border-slate-200/90 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all -mr-2"
          >
            <ChevronRight size={15} />
          </button>
        )}

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`no-scrollbar flex gap-2.5 overflow-x-auto pb-2 pt-0.5 snap-x snap-mandatory -mx-1 px-1 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab sm:cursor-default"
          }`}
        >
          {productCards.map((p) => (
            <div
              key={p.ma}
              className="group w-[170px] sm:w-[185px] shrink-0 snap-start flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xs hover:border-emerald-600 hover:shadow-md transition-all"
            >
              <div>
                <Link
                  href={p.url}
                  onClick={handleLinkClick}
                  className="block relative aspect-square overflow-hidden rounded-xl bg-slate-50"
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.ten}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-200 pointer-events-none"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl bg-emerald-50 text-[#2D5A27]">
                      🪴
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.2 text-[8px] font-medium text-white backdrop-blur-xs">
                    {p.ma}
                  </span>
                  {Number(p.ton || 0) > 0 ? (
                    <span className="absolute top-1 right-1 rounded-full bg-emerald-600/90 px-1.5 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                      Sẵn hàng
                    </span>
                  ) : (
                    <span className="absolute top-1 right-1 rounded-full bg-amber-600/90 px-1.5 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                      Đặt trước
                    </span>
                  )}
                </Link>

                <Link href={p.url} onClick={handleLinkClick} className="mt-1.5 block">
                  <h4 className="line-clamp-2 text-[11.5px] font-semibold text-slate-800 group-hover:text-emerald-700 leading-tight">
                    {p.ten}
                  </h4>
                </Link>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-100">
                <div className="text-[12px] font-black text-[#C62828]">
                  {p.giaBan.toLocaleString("vi-VN")}đ
                </div>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <Link
                    href={p.url}
                    onClick={handleLinkClick}
                    className="flex-1 text-center rounded-lg bg-emerald-50 hover:bg-emerald-100 py-1 text-[10.5px] font-bold text-emerald-800 transition-colors"
                  >
                    Xem chi tiết
                  </Link>
                  <a
                    href={`${zaloHref}?text=${encodeURIComponent(`Chào Aloha, mình cần xem ảnh thực tế tại vườn của mẫu: ${p.ten} (Mã: ${p.ma})`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Xem ảnh thực tế trên Zalo"
                    className="shrink-0 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 p-1.5 text-[#0068FF] transition-colors"
                  >
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          ))}

          {/* THẺ "XEM TẤT CẢ" Ở CUỐI CAROUSEL DẪN ĐẾN TRANG TÌM KIẾM HOẶC QUÀ TẶNG */}
          {(searchLink || giftCard) && (
            <div className="w-[145px] sm:w-[155px] shrink-0 snap-start flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-emerald-300/80 bg-gradient-to-b from-emerald-50/70 to-white p-3 hover:border-emerald-600 hover:bg-emerald-50 transition-all shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-[#2D5A27] shadow-2xs mb-2">
                <ArrowRight size={17} />
              </div>
              <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                {searchLink ? (searchLink.label || searchLink.title) : giftCard?.title}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Khám phá thêm nhiều mẫu khác
              </p>
              <Link
                href={searchLink ? searchLink.url : giftCard!.url}
                onClick={handleLinkClick}
                className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
              >
                <span>Xem ngay</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
