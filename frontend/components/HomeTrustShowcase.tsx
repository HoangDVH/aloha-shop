"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ShoppingBag,
  Gift,
  Store,
  Users,
  Truck,
  Palette,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ZoomIn,
  MessageCircle,
  ArrowRight,
  ArrowUpRight,
  X,
  Leaf,
  Building2,
  Flame,
  Tag,
  Star,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  type TrustItem,
  type TrustSectionProps,
  parseTrustProps,
  DEFAULT_TRUST_PROPS,
} from "@/lib/trustShowcase";

const CLIENT_METADATA: Record<
  string,
  {
    badge: string;
    category: string;
    scale: string;
    rating: string;
    location: string;
    gridCls: string;
    titleCls?: string;
  }
> = {
  bidv: {
    badge: "BIDV Bank",
    category: "Quà tặng nhân sự • 300 chậu",
    scale: "Chậu gốm in tem logo riêng & thông điệp đồng hành",
    rating: "5.0/5.0",
    location: "TP. Hồ Chí Minh",
    gridCls: "col-span-2 row-span-2",
    titleCls: "text-base sm:text-lg md:text-xl",
  },
  "phan-vu": {
    badge: "Tập đoàn",
    category: "Đại hội cổ đông • 500 bộ quà",
    scale: "Bộ quà tặng chậu cây & túi quà in logo đồng bộ",
    rating: "5.0/5.0",
    location: "Bình Dương",
    gridCls: "col-span-1 row-span-2 lg:col-span-2 lg:row-span-1",
    titleCls: "text-xs sm:text-base md:text-lg",
  },
  "eco-retreat": {
    badge: "Bất động sản",
    category: "Tri ân VIP • 200 chậu",
    scale: "Chậu sứ cao cấp logo ép kim sang trọng",
    rating: "5.0/5.0",
    location: "Long An",
    gridCls: "col-span-1 lg:row-span-2",
    titleCls: "text-xs sm:text-base",
  },
  "binh-duong": {
    badge: "Đoàn thể",
    category: "Kỷ niệm 75 năm • 350 chậu",
    scale: "Chậu lưu niệm đại hội",
    rating: "5.0/5.0",
    location: "Bình Dương",
    gridCls: "col-span-1",
    titleCls: "text-xs sm:text-sm",
  },
  "tay-ninh": {
    badge: "Đoàn thể",
    category: "Hội LHTN Việt Nam • 250 chậu",
    scale: "Chậu vuông in biểu trưng kỷ niệm phong trào thanh niên",
    rating: "5.0/5.0",
    location: "Tây Ninh",
    gridCls: "col-span-2",
    titleCls: "text-xs sm:text-base md:text-lg",
  },
  "hoang-gia": {
    badge: "Doanh nghiệp",
    category: "Quà tặng đối tác • 180 chậu",
    scale: "Chậu sen đá mix thương hiệu",
    rating: "5.0/5.0",
    location: "TP. Hồ Chí Minh",
    gridCls: "col-span-2 lg:col-span-1",
    titleCls: "text-xs sm:text-sm",
  },
};

const SERVICE_CONFIGS = [
  {
    icon: Palette,
    badgeColor: "text-amber-600",
    defaultTitle: "In logo chậu & túi quà theo yêu cầu",
    defaultDesc:
      "Thiết kế mockup mẫu miễn phí, in sắc nét, bền màu theo nhận diện thương hiệu.",
  },
  {
    icon: Gift,
    badgeColor: "text-amber-600",
    defaultTitle: "Gói quà trọn bộ & thiệp chúc mừng",
    defaultDesc:
      "Kèm túi đựng, thiệp, nơ, giấy gói, chủ đề đa dạng (phù hợp sinh nhật, khai trương, tri ân...).",
  },
  {
    icon: Truck,
    badgeColor: "text-amber-600",
    defaultTitle: "Cung cấp đơn hàng số lượng lớn",
    defaultDesc:
      "Chậu theo concept, giao hàng nhanh, đóng gói đồng bộ, chiết khấu doanh nghiệp tốt nhất.",
  },
];

export function HomeTrustShowcase({ props }: { props?: Record<string, unknown> }) {
  const data = useMemo(() => parseTrustProps(props), [props]);
  const sectionRef = useRef<HTMLElement>(null);



  // Lọc các mục enabled, đảm bảo luôn đủ 6 thẻ để Bento Grid luôn khớp chuẩn khít (không bị lệch/thiếu ô)
  const activeClients = useMemo(() => {
    const raw = (data.clients || []).filter((c) => c.enabled !== false);
    if (raw.length >= 6) return raw.slice(0, 6);
    // Bổ sung từ DEFAULT_TRUST_PROPS nếu thiếu để bảo đảm cấu trúc lưới 6 ô chuẩn Sắc Xanh Garden
    const idMap = new Map(raw.map((c) => [c.id, c]));
    return DEFAULT_TRUST_PROPS.clients.map((fallback) => idMap.get(fallback.id) || fallback);
  }, [data.clients]);
  const activeServices = useMemo(
    () => (data.services || []).filter((s) => s.enabled !== false),
    [data.services]
  );
  // Ảnh không gian showroom & vườn ươm (kind !== 'customer')
  const activeStoreGallery = useMemo(
    () =>
      (data.gallery || []).filter(
        (g) =>
          g.enabled !== false &&
          g.kind !== "customer" &&
          !g.id.startsWith("cust-")
      ),
    [data.gallery]
  );
  // Ảnh khách hàng thực tế tại Aloha (kind === 'customer' hoặc id bắt đầu bằng cust-)
  const activeCustomerGallery = useMemo(
    () =>
      (data.gallery || []).filter(
        (g) =>
          g.enabled !== false &&
          (g.kind === "customer" || g.id.startsWith("cust-"))
      ),
    [data.gallery]
  );

  type LightboxGroup = {
    items: (TrustItem & { badge?: string })[];
    currentIndex: number;
    groupTitle: string;
  };

  const [lightbox, setLightbox] = useState<LightboxGroup | null>(null);

  const openLightbox = (
    items: (TrustItem & { badge?: string })[],
    index: number,
    groupTitle: string
  ) => {
    setLightbox({ items, currentIndex: index, groupTitle });
  };

  const nextLightboxItem = () => {
    setLightbox((prev) => {
      if (!prev || !prev.items.length) return null;
      return {
        ...prev,
        currentIndex: (prev.currentIndex + 1) % prev.items.length,
      };
    });
  };

  const prevLightboxItem = () => {
    setLightbox((prev) => {
      if (!prev || !prev.items.length) return null;
      return {
        ...prev,
        currentIndex: (prev.currentIndex - 1 + prev.items.length) % prev.items.length,
      };
    });
  };

  const touchStartXRef = useRef<number | null>(null);

  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleLightboxTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        prevLightboxItem();
      } else {
        nextLightboxItem();
      }
    }
    touchStartXRef.current = null;
  };

  // Reel ảnh liên hoàn gộp cả Showroom Vườn ươm & Khách hàng thực tế (chuẩn các tập đoàn lớn)
  const reelRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  // Điều khiển dải trượt 3 thẻ dịch vụ quà tặng trên mobile (Snap Carousel chuẩn Apple/Shopee)
  const [activeServiceIdx, setActiveServiceIdx] = useState(0);
  const serviceScrollRef = useRef<HTMLDivElement>(null);

  const handleServiceScroll = () => {
    if (!serviceScrollRef.current) return;
    const el = serviceScrollRef.current;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 280;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveServiceIdx(Math.max(0, Math.min(activeServices.length - 1, idx)));
  };

  const scrollToService = (idx: number) => {
    if (!serviceScrollRef.current) return;
    const el = serviceScrollRef.current;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 280;
    el.scrollTo({ left: idx * cardWidth, behavior: "smooth" });
  };

  // Gộp cả 2 nguồn ảnh: Không gian vườn ươm (Store) & Khách hàng thực tế (Customer) xen kẽ nhau
  const combinedGallery = useMemo(() => {
    const list: (TrustItem & { badge: string; isCustomer: boolean })[] = [];
    const maxLen = Math.max(activeStoreGallery.length, activeCustomerGallery.length);
    for (let i = 0; i < maxLen; i++) {
      if (activeStoreGallery[i]) {
        list.push({
          ...activeStoreGallery[i],
          badge: "Vườn ươm",
          isCustomer: false,
        });
      }
      if (activeCustomerGallery[i]) {
        list.push({
          ...activeCustomerGallery[i],
          badge: "Khách thật",
          isCustomer: true,
        });
      }
    }
    return list;
  }, [activeStoreGallery, activeCustomerGallery]);

  // Nhân đôi danh sách ảnh để tạo dải cuộn tuần hoàn vô tận (Infinite Seamless Track)
  const displayGallery = useMemo(() => {
    if (!combinedGallery.length) return [];
    return [...combinedGallery, ...combinedGallery];
  }, [combinedGallery]);

  // Chuyển động tuần hoàn vô tận mượt mà 120fps chuẩn công ty lớn (Apple, Stripe, Sắc Xanh)
  // Sử dụng timestamp thực tế & subpixel accumulator, 0% React re-render, êm ái trên cả Desktop lẫn Mobile
  useEffect(() => {
    const el = reelRef.current;
    if (!el || !displayGallery.length) return;

    let animId: number;
    const SPEED = 28; // Tốc độ trôi 28px/giây cực kỳ êm dịu, thanh lịch

    const step = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.08); // Giới hạn deltaTime tránh giật khi lag/chuyển tab
      lastTimeRef.current = now;

      if (!isInteractingRef.current) {
        // Nửa chiều dài nội dung vì danh sách được nhân đôi
        const halfWidth = el.scrollWidth / 2;

        if (halfWidth > 0) {
          posRef.current += SPEED * deltaTime;

          // Khi cuộn hết vòng 1, chuyển về đầu vòng 2 hoàn toàn vô hình
          if (posRef.current >= halfWidth) {
            posRef.current -= halfWidth;
          }

          el.scrollLeft = posRef.current;

          // Cập nhật thanh tiến trình trực tiếp qua DOM (0 lần React re-render!)
          if (progressFillRef.current) {
            const pct = Math.max(15, Math.min(100, (posRef.current / halfWidth) * 100));
            progressFillRef.current.style.width = `${pct}%`;
          }
        }
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, [displayGallery]);

  const pauseAutoScroll = (resumeDelayMs = 2500) => {
    isInteractingRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      if (reelRef.current) {
        posRef.current = reelRef.current.scrollLeft;
      }
      lastTimeRef.current = null;
      isInteractingRef.current = false;
    }, resumeDelayMs);
  };

  const handleManualScroll = (direction: "left" | "right") => {
    if (reelRef.current) {
      pauseAutoScroll(3000);
      const amount = reelRef.current.clientWidth * 0.7;
      reelRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  const handleTouchStart = () => {
    isInteractingRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  };

  const handleTouchEnd = () => {
    pauseAutoScroll(2500);
  };

  const handleMouseEnter = () => {
    isInteractingRef.current = true;
  };

  const handleMouseLeave = () => {
    if (reelRef.current) {
      posRef.current = reelRef.current.scrollLeft;
    }
    lastTimeRef.current = null;
    isInteractingRef.current = false;
  };

  const handleNativeScroll = () => {
    // Khi người dùng vuốt thủ công bằng tay hoặc chuột, cập nhật thanh progress bar lập tức
    if (isInteractingRef.current && reelRef.current) {
      const halfWidth = reelRef.current.scrollWidth / 2;
      if (halfWidth > 0) {
        posRef.current = reelRef.current.scrollLeft % halfWidth;
        if (progressFillRef.current) {
          const pct = Math.max(15, Math.min(100, (posRef.current / halfWidth) * 100));
          progressFillRef.current.style.width = `${pct}%`;
        }
      }
    }
  };



  // Đóng modal bằng phím ESC hoặc chuyển ảnh bằng mũi tên ← → (chuẩn sàn quốc tế)
  useEffect(() => {
    if (!lightbox) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") prevLightboxItem();
      if (e.key === "ArrowRight") nextLightboxItem();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [lightbox]);

  // Kích hoạt hiệu ứng cuộn (Scroll Reveal) khi phần tử trượt vào khung nhìn
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const revealElements = root.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      revealElements.forEach((el) => el.setAttribute("data-show", "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-show", "true");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      }
    );

    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [activeClients, activeServices, combinedGallery]);

  // Nếu không có mục nào, ẩn khối
  const totalCount =
    activeClients.length +
    activeServices.length +
    activeStoreGallery.length +
    activeCustomerGallery.length;
  if (totalCount === 0) return null;

  return (
    <section
      ref={sectionRef}
      id="home-trust-showcase"
      aria-label={data.title}
      className="relative bg-gradient-to-b from-[#FBF8F2] via-[#F6F1E7] to-[#FBF8F2] py-8 sm:py-12 md:py-16 border-y border-[#e6dcce] overflow-hidden"
    >
      {/* Nền hoa văn sinh thái & ánh sáng organic */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#1c4c40_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-[0.035]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* =========================================================================
            MỤC 1: DỰ ÁN & ĐƠN HÀNG TIÊU BIỂU (CHUẨN SẮC XANH GARDEN - KHÔNG KHUNG NGOÀI)
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 sm:gap-8 mb-8 sm:mb-10 md:mb-12">
          <div className="flex flex-col gap-2.5 sm:gap-3 max-w-2xl">
            {/* Tag line with horizontal bar */}
            <div data-show="false" className="reveal" style={{ transitionDelay: "0ms" }}>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#1C4C40]">
                <span className="h-px w-6 bg-[#1C4C40]/60" aria-hidden="true" />
                <span>{data.clientsTitle || "DỰ ÁN & ĐƠN HÀNG TIÊU BIỂU"}</span>
              </span>
            </div>

            {/* Main title */}
            <div data-show="false" className="reveal" style={{ transitionDelay: "80ms" }}>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.65rem] font-bold text-stone-900 tracking-tight leading-[1.2]">
                Những doanh nghiệp đã tin chọn <span className="text-[#C05621]">Aloha</span>
              </h2>
            </div>

            {/* Subtitle */}
            <div data-show="false" className="reveal" style={{ transitionDelay: "160ms" }}>
              <p className="text-sm sm:text-base md:text-[1.05rem] text-stone-600 leading-relaxed">
                {data.subtitle || "Bằng chứng thật từ các dự án quà tặng đại hội, hội nghị và sự kiện doanh nghiệp — đóng gói đồng bộ, in tem sắc nét và giao hàng đúng tiến độ."}
              </p>
            </div>
          </div>

          {/* Right action controls */}
          <div data-show="false" className="reveal flex flex-wrap sm:flex-col items-start sm:items-end gap-2.5 shrink-0" style={{ transitionDelay: "120ms" }}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/90 border border-emerald-200/90 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>100% Ảnh thật đã bàn giao &amp; Hóa đơn VAT</span>
            </span>
            <a
              href={data.cta?.href || "https://zalo.me/0394107309"}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border border-[#1C4C40]/25 bg-white/70 hover:bg-white hover:border-[#1C4C40]/60 px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#1C4C40] shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
            >
              <span>Xem tất cả dự án</span>
              <ArrowUpRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>

        {/* Lưới Grid Bento 6 Thẻ Chuẩn Sắc Xanh Garden (Không khung ngoài) */}
        <div className="grid grid-flow-row-dense auto-rows-[192px] sm:auto-rows-[276px] grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 mb-16 sm:mb-20 md:mb-24">
          {activeClients.map((client, idx) => {
            const meta = CLIENT_METADATA[client.id] || {
              badge: "Doanh nghiệp",
              category: "Đơn hàng quà tặng",
              scale: client.caption || "Chậu cây thiết kế theo yêu cầu",
              rating: "5.0/5.0",
              location: "Việt Nam",
              gridCls: "col-span-1",
              titleCls: "text-xs sm:text-base",
            };
            const delay = (idx % 6) * 80;
            return (
              <div
                key={client.id}
                data-show="false"
                style={{ transitionDelay: `${delay}ms` }}
                className={`reveal ${meta.gridCls} size-full`}
              >
                <div
                  onClick={() => openLightbox(activeClients, idx, "Dự án doanh nghiệp tiêu biểu")}
                  className="card-sheen group relative size-full rounded-2xl sm:rounded-3xl overflow-hidden bg-stone-900 border border-stone-200/80 hover:border-emerald-500/50 hover:ring-1 hover:ring-emerald-400/30 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_24px_50px_-12px_rgba(28,76,64,0.3),0_12px_24px_-8px_rgba(0,0,0,0.15)] hover:-translate-y-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer flex flex-col justify-between"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={client.imageUrl}
                    alt={client.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />

                  {/* Gradient bóng đêm ngả xanh rêu chuẩn organic - làm nổi bật chữ khi hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e241f]/95 via-[#0e241f]/35 to-black/20 pointer-events-none transition-all duration-500 group-hover:from-[#071814]/98 group-hover:via-[#0e241f]/45" />

                  {/* Badge góc trên */}
                  <div className="relative z-10 p-2.5 sm:p-4.5 flex items-center justify-between pointer-events-none">
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/45 sm:bg-black/35 backdrop-blur-md border border-white/20 sm:border-white/25 text-[9px] sm:text-[10.5px] font-bold text-white whitespace-nowrap shadow-xs tracking-normal">
                      <Building2 size={10} className="text-amber-300 sm:w-3 sm:h-3 shrink-0" />
                      <span>{meta.badge}</span>
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/25 text-[10.5px] text-white/95 shadow-xs">
                      <ZoomIn size={11} />
                      <span>HD</span>
                    </span>
                  </div>

                  {/* Nội dung thông tin chân thẻ */}
                  <div className="relative z-10 p-2.5 sm:p-5 flex items-end justify-between gap-2 text-white">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-300 group-hover:text-amber-200 transition-colors duration-300 mb-0.5 sm:mb-1 truncate drop-shadow-xs">
                        {meta.category}
                      </p>
                      <h3
                        className={`font-black text-white leading-tight drop-shadow-sm group-hover:text-amber-100 transition-colors duration-300 ${
                          meta.titleCls || "text-xs sm:text-base"
                        } line-clamp-2`}
                      >
                        {client.title}
                      </h3>
                      <p className="mt-1 text-xs text-stone-200/90 font-medium truncate hidden sm:block">
                        {meta.scale}
                      </p>
                    </div>
                    <div className="shrink-0 h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 group-hover:bg-white group-hover:text-[#1C4C40] group-hover:scale-110 group-hover:shadow-lg flex items-center justify-center text-white transition-all duration-300 ease-out shadow-md">
                      <ArrowUpRight size={13} className="sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* =========================================================================
            MỤC 2: DỊCH VỤ QUÀ TẶNG DOANH NGHIỆP (KHÔNG KHUNG NGOÀI)
           ========================================================================= */}
        <div className="mb-16 sm:mb-20 md:mb-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-4">
            <div className="flex flex-col gap-2.5 max-w-2xl">
              <div data-show="false" className="reveal" style={{ transitionDelay: "0ms" }}>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#B45309]">
                  <span className="h-px w-6 bg-[#B45309]/60" aria-hidden="true" />
                  <span>DỊCH VỤ QUÀ TẶNG DOANH NGHIỆP</span>
                </span>
              </div>
              <div data-show="false" className="reveal" style={{ transitionDelay: "80ms" }}>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
                  Giải pháp quà tặng cây xanh trọn gói
                </h3>
              </div>
              <div data-show="false" className="reveal" style={{ transitionDelay: "160ms" }}>
                <p className="text-xs sm:text-sm md:text-base text-stone-600 leading-relaxed">
                  Hỗ trợ trọn bộ từ khâu thiết kế tem logo thương hiệu, gói quà trang trọng đến đóng gói giao tận nơi đúng tiến độ cam kết.
                </p>
              </div>
            </div>
            <div data-show="false" className="reveal shrink-0 self-start sm:self-end" style={{ transitionDelay: "120ms" }}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50/90 border border-amber-200/90 px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-2xs">
                <Gift size={13} className="text-amber-700" />
                <span>Phục vụ từ 10 đến 1.000+ chậu cây</span>
              </span>
            </div>
          </div>

          {/* Lưới 3 Thẻ Dịch vụ quà tặng:
              - Mobile (< md): Dải cuộn ngang Snap Carousel (w-[82vw] max-w-[310px]) có peek hint, không bị kéo dài trang
              - Desktop (md+): Grid 3 cột thu gọn max-w-5xl mx-auto, ảnh vuông vừa vặn thanh lịch
          */}
          <div className="max-w-5xl mx-auto">
            <div
              ref={serviceScrollRef}
              onScroll={handleServiceScroll}
              className="flex md:grid md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 py-2"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {activeServices.map((service, idx) => {
                const cfg = SERVICE_CONFIGS[idx] || SERVICE_CONFIGS[0];
                const badges = [
                  { tag: "0đ PHÍ THIẾT KẾ", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  { tag: "CHỈN CHU TRỌN GÓI", bg: "bg-amber-50 text-amber-800 border-amber-200" },
                  { tag: "CHIẾT KHẤU CAO & VAT", bg: "bg-blue-50 text-blue-800 border-blue-200" },
                ];
                const badge = badges[idx] || badges[0];
                const delay = idx * 100;
                return (
                  <div
                    key={service.id}
                    data-show="false"
                    style={{ transitionDelay: `${delay}ms` }}
                    className="reveal w-[82vw] max-w-[310px] md:w-auto md:max-w-none shrink-0 snap-center flex flex-col"
                  >
                    <div
                      onClick={() => openLightbox(activeServices, idx, "Giải pháp quà tặng doanh nghiệp")}
                      className="card-sheen group bg-white/95 hover:bg-white border border-[#E7DFD3] hover:border-[#1C4C40]/50 rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-500 cursor-pointer shadow-xs hover:shadow-xl hover:-translate-y-1.5 flex flex-col justify-between h-full"
                    >
                      <div>
                        {/* Ảnh dịch vụ - Tỷ lệ vuông 1:1 (aspect-square) */}
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl bg-stone-100 border border-stone-200/90 mb-3.5 sm:mb-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={service.imageUrl}
                            alt={service.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-108"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 text-stone-900 px-3 py-1.5 text-xs font-bold shadow-md">
                              <ZoomIn size={14} /> Phóng to HD
                            </span>
                          </div>
                        </div>

                        {/* Badge */}
                        <span className={`inline-flex items-center text-[10px] sm:text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-lg border mb-2 whitespace-nowrap ${badge.bg}`}>
                          {badge.tag}
                        </span>

                        <h4 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 group-hover:text-[#1C4C40] transition-colors leading-snug line-clamp-2">
                          {service.title || cfg.defaultTitle}
                        </h4>

                        <p className="mt-1.5 text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-3">
                          {service.caption || cfg.defaultDesc}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-[#1C4C40]">
                        <span>Xem ảnh thực tế</span>
                        <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chỉ báo Dots trên Mobile (3 chấm chỉ vị trí thẻ đang xem) */}
            <div className="flex md:hidden items-center justify-center gap-1.5 mt-3.5">
              {activeServices.map((service, idx) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => scrollToService(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeServiceIdx === idx
                      ? "w-6 bg-[#1C4C40]"
                      : "w-1.5 bg-stone-300 hover:bg-stone-400"
                  }`}
                  aria-label={`Xem dịch vụ ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            MỤC 3: KHÔNG GIAN VƯỜN ƯƠM & KHÁCH HÀNG THỰC TẾ (REEL PHIM LIÊN HOÀN)
           ========================================================================= */}
        {combinedGallery.length > 0 && (
          <div className="mb-12 sm:mb-16">
            {/* Header phân khu gộp */}
            <div data-show="false" className="reveal flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-5 gap-3" style={{ transitionDelay: "0ms" }}>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100/90 shadow-2xs">
                  <Store size={17} />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-stone-900 tracking-tight">
                  Không gian vườn ươm &amp; Khách hàng thực tế
                </h3>
              </div>

              {/* Đường chỉ kẻ ngang tinh tế nối liền */}
              <div className="flex-1 h-px bg-stone-200/90 mx-3 hidden sm:block" />

              {/* Nút điều hướng Carousel < > */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleManualScroll("left")}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-950 border border-stone-200/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                  aria-label="Xem ảnh trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleManualScroll("right")}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-950 border border-stone-200/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                  aria-label="Xem ảnh tiếp theo"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Dải ảnh liên hoàn */}
            <div data-show="false" className="reveal" style={{ transitionDelay: "100ms" }}>
              <div
                ref={reelRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onScroll={handleNativeScroll}
                className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 select-none will-change-scroll"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {displayGallery.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => {
                      const origIdx = combinedGallery.findIndex((g) => g.id === item.id);
                      openLightbox(combinedGallery, origIdx >= 0 ? origIdx : 0, "Không gian vườn ươm & Khách hàng");
                    }}
                    className="card-sheen group relative flex-none w-[175px] sm:w-[205px] md:w-[230px] aspect-4/3 rounded-2xl overflow-hidden bg-white border border-stone-200/90 cursor-pointer shadow-xs hover:shadow-xl hover:border-[#1C4C40]/50 transition-all duration-500 transform hover:-translate-y-1.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-108"
                    />

                    <div className="absolute top-2 left-2 z-10">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs backdrop-blur-xs ${
                          item.isCustomer
                            ? "bg-[#1C4C40]/90 text-white"
                            : "bg-white/90 text-stone-800"
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 text-white">
                      <p className="text-[11.5px] font-bold line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-1 text-[10px] text-stone-200 mt-0.5">
                        <ZoomIn size={12} />
                        <span>Phóng to</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-4 pt-1 flex items-center justify-between text-xs text-stone-500">
                <span className="hidden sm:inline">Rê chuột hoặc vuốt để tạm dừng · Nhấp để xem ảnh HD</span>
                <div className="w-full sm:w-52 h-1 bg-stone-200/80 rounded-full overflow-hidden ml-auto">
                  <div
                    ref={progressFillRef}
                    className="h-full bg-[#C05621] rounded-full"
                    style={{
                      width: "20%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            BANNER CTA B2B ZALO TOÀN DẢI (BÁO GIÁ QUÀ TẶNG DOANH NGHIỆP)
           ========================================================================= */}
        {data.cta?.href ? (
          <div data-show="false" className="reveal rounded-3xl bg-white/90 backdrop-blur-xs border border-[#E7DFD3] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left" style={{ transitionDelay: "150ms" }}>
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shrink-0 border border-emerald-100 shadow-2xs">
                <MessageCircle size={22} />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold text-stone-900">
                  Bạn cần đặt cây quà tặng cho công ty hoặc sự kiện?
                </p>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  Aloha tư vấn chọn cây, thiết kế in logo miễn phí và gửi báo giá ưu đãi tốt nhất trong 5 phút
                </p>
              </div>
            </div>
            <a
              href={data.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1C4C40] to-[#12362d] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:from-[#153a31] hover:to-[#0d2822] hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 active:scale-98 shrink-0"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
              </span>
              <span>{data.cta.label || "Nhận báo giá quà tặng qua Zalo"}</span>
              <ArrowRight size={14} />
            </a>
          </div>
        ) : null}
      </div>

      {/* =========================================================================
          LIGHTBOX PHÓNG TO ẢNH HD SẮC NÉT (CHUẨN APPLE / AIRBNB / BEHANCE)
         ========================================================================= */}
      {lightbox ? (() => {
        const currentItem = lightbox.items[lightbox.currentIndex];
        if (!currentItem) return null;
        const total = lightbox.items.length;
        const currentNum = lightbox.currentIndex + 1;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh phóng to HD"
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-black/92 backdrop-blur-xl p-3 sm:p-5 animate-in fade-in duration-200 select-none overflow-hidden"
          >
            {/* 1. TOP BAR: Tiêu đề phân khu + Bộ đếm ảnh + Nút đóng X */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-30 flex items-center justify-between w-full max-w-5xl mx-auto pb-1 sm:pb-2 shrink-0"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white/95 border border-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{lightbox.groupTitle}</span>
                </span>
                <span className="text-xs font-bold text-white/75 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                  {currentNum} / {total}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                aria-label="Đóng xem ảnh lớn (phím ESC)"
                title="Đóng (ESC)"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2. MAIN STAGE: Ảnh lớn HD + Hai nút chuyển ảnh Trái/Phải (Next/Prev) */}
            <div
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleLightboxTouchStart}
              onTouchEnd={handleLightboxTouchEnd}
              className="relative flex-1 flex items-center justify-center w-full max-w-5xl mx-auto min-h-0 my-auto py-2"
            >
              {/* Nút Prev (Ảnh trước) */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={prevLightboxItem}
                  className="absolute left-1 sm:left-3 z-30 flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/25 backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Xem ảnh trước (phím mũi tên trái)"
                  title="Ảnh trước (←)"
                >
                  <ChevronLeft size={24} className="sm:w-7 sm:h-7" />
                </button>
              )}

              {/* Vùng hiển thị ảnh phóng to */}
              <div className="relative max-h-[62vh] sm:max-h-[68vh] md:max-h-[72vh] max-w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={currentItem.imageUrl}
                  src={currentItem.imageUrl}
                  alt={currentItem.title}
                  className="max-h-[62vh] sm:max-h-[68vh] md:max-h-[72vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
                />
              </div>

              {/* Nút Next (Ảnh sau) */}
              {total > 1 && (
                <button
                  type="button"
                  onClick={nextLightboxItem}
                  className="absolute right-1 sm:right-3 z-30 flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/25 backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Xem ảnh tiếp theo (phím mũi tên phải)"
                  title="Ảnh tiếp theo (→)"
                >
                  <ChevronRight size={24} className="sm:w-7 sm:h-7" />
                </button>
              )}
            </div>

            {/* 3. BOTTOM CAPTION & CTA: Thông tin ảnh + Nút Zalo tư vấn */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-30 w-full max-w-4xl mx-auto pt-1 sm:pt-2 shrink-0"
            >
              <div className="rounded-2xl sm:rounded-3xl bg-neutral-900/90 border border-white/10 backdrop-blur-xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xl">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-2.5 py-0.5 text-[10.5px] font-bold">
                      {currentItem.badge || "Hình ảnh thật từ Aloha"}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base md:text-lg font-bold text-white line-clamp-1">
                    {currentItem.title}
                  </h4>
                  {currentItem.caption ? (
                    <p className="mt-0.5 text-xs sm:text-sm text-neutral-300 line-clamp-2">
                      {currentItem.caption}
                    </p>
                  ) : null}
                </div>

                {data.cta?.href ? (
                  <a
                    href={data.cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all shrink-0"
                  >
                    <MessageCircle size={16} />
                    <span>Tư vấn mẫu tương tự qua Zalo</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        );
      })() : null}
    </section>
  );
}
