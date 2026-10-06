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
} from "@/lib/trustShowcase";

const CLIENT_METADATA: Record<string, { scale: string; rating: string; location: string }> = {
  bidv: { scale: "300 chậu", rating: "5.0/5.0", location: "TP. Hồ Chí Minh" },
  "phan-vu": { scale: "500 chậu", rating: "5.0/5.0", location: "Bình Dương" },
  "eco-retreat": { scale: "200 chậu", rating: "5.0/5.0", location: "Long An" },
  "binh-duong": { scale: "350 chậu", rating: "5.0/5.0", location: "Bình Dương" },
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

  // Hiệu ứng cuộn vào tầm nhìn (Scroll reveal)
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Lọc chỉ lấy các mục enabled
  const activeClients = useMemo(
    () => (data.clients || []).filter((c) => c.enabled !== false),
    [data.clients]
  );
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

  // Spotlight đơn hàng doanh nghiệp
  const [selectedClientIndex, setSelectedClientIndex] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<TrustItem | null>(null);

  // Reel ảnh liên hoàn gộp cả Showroom Vườn ươm & Khách hàng thực tế (chuẩn ảnh minh họa Model 1)
  const reelRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const directionRef = useRef<"right" | "left">("right");
  const [scrollProgress, setScrollProgress] = useState(0);

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

  // Tự động chuyển động qua lại êm ái (Auto-scroll back and forth) chuẩn các công ty lớn
  useEffect(() => {
    const el = reelRef.current;
    if (!el) return;

    let animId: number;
    const speed = 0.55; // pixels per frame (chuyển động êm ái, thanh lịch)

    const step = () => {
      if (!isHovered && el) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 0) {
          if (directionRef.current === "right") {
            el.scrollLeft += speed;
            if (el.scrollLeft >= maxScroll - 1) {
              directionRef.current = "left";
            }
          } else {
            el.scrollLeft -= speed;
            if (el.scrollLeft <= 1) {
              directionRef.current = "right";
            }
          }
          setScrollProgress((el.scrollLeft / maxScroll) * 100);
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isHovered]);

  const handleManualScroll = (direction: "left" | "right") => {
    if (reelRef.current) {
      const amount = reelRef.current.clientWidth * 0.5;
      reelRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
      directionRef.current = direction;
    }
  };

  const handleReelScroll = () => {
    if (reelRef.current) {
      const maxScroll = reelRef.current.scrollWidth - reelRef.current.clientWidth;
      if (maxScroll > 0) {
        setScrollProgress((reelRef.current.scrollLeft / maxScroll) * 100);
      }
    }
  };

  const currentClient = activeClients[selectedClientIndex] || activeClients[0];

  const clientMeta = useMemo(() => {
    if (!currentClient) return { scale: "100+ chậu", rating: "5.0/5.0", location: "TP. Hồ Chí Minh" };
    return CLIENT_METADATA[currentClient.id] || { scale: "100+ chậu", rating: "5.0/5.0", location: "TP. Hồ Chí Minh" };
  }, [currentClient]);

  // Tab chuyển đổi tiêu điểm tầng trên (Single Focused Stage - Chuẩn Apple / Linear)
  const [activeTopTab, setActiveTopTab] = useState<"clients" | "services">("clients");
  const [isTopHovered, setIsTopHovered] = useState(false);

  // Tự động chuyển đổi nhẹ nhàng giữa 2 Tab sau mỗi 8.5 giây (tạm dừng khi người dùng rê chuột vào xem)
  useEffect(() => {
    if (isTopHovered) return;
    const interval = setInterval(() => {
      setActiveTopTab((prev) => (prev === "clients" ? "services" : "clients"));
    }, 8500);
    return () => clearInterval(interval);
  }, [isTopHovered]);

  // Đóng modal bằng phím ESC
  useEffect(() => {
    if (!lightboxItem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxItem(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxItem]);

  // Điều hướng chuyển đơn doanh nghiệp
  const nextClient = () => {
    if (!activeClients.length) return;
    setSelectedClientIndex((prev) => (prev + 1) % activeClients.length);
  };
  const prevClient = () => {
    if (!activeClients.length) return;
    setSelectedClientIndex((prev) =>
      prev === 0 ? activeClients.length - 1 : prev - 1
    );
  };

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
      aria-label={data.title}
      className="relative bg-gradient-to-b from-[#FBF8F2] via-[#F6F1E7] to-[#FBF8F2] py-8 sm:py-12 md:py-14 border-y border-[#e6dcce] overflow-hidden"
    >
      {/* Nền hoa văn sinh thái & ánh sáng organic */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#1c4c40_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-[0.035]" />
      </div>

      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-700 ease-out ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* =========================================================================
            HEADER SECTION: KHÁCH HÀNG TIN CHỌN ALOHA (TINH GỌN CHUẨN APPLE / AIRBNB)
           ========================================================================= */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8 md:mb-10">
          {/* Badge lá xanh tinh tế */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EFE8D8] border border-[#E2D6BE] px-3.5 py-1 text-[11px] sm:text-xs font-bold text-[#63532F] mb-2.5 shadow-2xs">
            <Leaf size={13} className="text-[#4E7A42]" />
            <span>HƠN 10.000+ KHÁCH HÀNG ĐÃ TIN TƯỞNG ALOHA</span>
          </div>

          {/* Tiêu đề chính với chữ Aloha màu cam đất */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-tight">
            Khách hàng tin chọn <span className="text-[#C05621]">Aloha</span>
          </h2>

          {/* Mô tả phụ cô đọng */}
          {data.subtitle ? (
            <p className="mt-2 text-xs sm:text-sm md:text-base text-stone-600 leading-relaxed max-w-2xl mx-auto">
              {data.subtitle}
            </p>
          ) : null}
        </div>

        {/* =========================================================================
            MÔ HÌNH 1: KHUNG NGUYÊN KHỐI THỐNG NHẤT (SINGLE UNIFIED TRUST HUB - APPLE STYLE)
           ========================================================================= */}
        <div className="rounded-3xl sm:rounded-4xl bg-white border border-[#E7DFD3] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          
          {/* TẦNG 1: SÂN KHẤU TIÊU ĐIỂM TOÀN DẢI KÈM TAB SWITCHER VIÊN THUỐC NỔI (CHUẨN APPLE / LINEAR) */}
          <div
            onMouseEnter={() => setIsTopHovered(true)}
            onMouseLeave={() => setIsTopHovered(false)}
            onTouchStart={() => setIsTopHovered(true)}
            onTouchEnd={() => setIsTopHovered(false)}
            className="p-5 sm:p-6 lg:p-7 flex flex-col justify-between"
          >
            {/* THANH ĐIỀU HƯỚNG TAB SWITCHER VIÊN THUỐC NỔI */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 sm:pb-5 border-b border-stone-100 mb-5 sm:mb-6 gap-3">
              {/* Segmented Pill Switcher */}
              <div className="inline-flex items-center bg-[#F4EFE6] p-1 rounded-full border border-[#E6DFD3] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTopTab("clients")}
                  className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    activeTopTab === "clients"
                      ? "bg-[#1C4C40] text-white shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <Building2 size={15} />
                  <span>Đơn hàng đã thực hiện</span>
                  {activeClients.length > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold ${
                        activeTopTab === "clients"
                          ? "bg-white/20 text-white"
                          : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {activeClients.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTopTab("services")}
                  className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    activeTopTab === "services"
                      ? "bg-[#B45309] text-white shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <Gift size={15} />
                  <span>Dịch vụ quà tặng trọn gói</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold uppercase ${
                      activeTopTab === "services"
                        ? "bg-white/25 text-white"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    Ưa chuộng
                  </span>
                </button>
              </div>

              {/* Thông tin phụ & điều hướng bên phải */}
              <div className="flex items-center gap-2.5 sm:gap-3 text-xs text-stone-500 self-end sm:self-center">
                {activeTopTab === "clients" ? (
                  <>
                    <span className="hidden md:inline text-[11.5px] text-stone-400">
                      Tự động chuyển tab sau 8s
                    </span>
                    {activeClients.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0 bg-stone-50 border border-stone-200/80 rounded-full px-2 py-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={prevClient}
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                          aria-label="Đơn trước"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <span className="text-xs font-bold text-stone-700 px-1.5 tabular-nums">
                          {selectedClientIndex + 1}/{activeClients.length}
                        </span>
                        <button
                          type="button"
                          onClick={nextClient}
                          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                          aria-label="Đơn tiếp theo"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Phục vụ từ 10 đến 1.000+ chậu cây</span>
                  </span>
                )}
              </div>
            </div>

            {/* NỘI DUNG 100% TOÀN DẢI DÀNH RIÊNG CHO TAB ĐƯỢC CHỌN */}
            {activeTopTab === "clients" ? (
              /* =========================================================================
                 TRẠNG THÁI 1: TAB ĐƠN HÀNG DOANH NGHIỆP (TOÀN DẢI 100% TIÊU ĐIỂM)
                 ========================================================================= */
              currentClient && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 items-center animate-in fade-in duration-300">
                  {/* Ảnh phóng sự đơn hàng KHUNG VUÔNG 1:1 (Thấy trọn vẹn 100% ảnh, không bị cắt xén) */}
                  <div className="lg:col-span-5 flex justify-center">
                    <div
                      onClick={() => setLightboxItem(currentClient)}
                      className="group relative aspect-square w-full max-w-[320px] sm:max-w-[350px] md:max-w-[380px] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentClient.imageUrl}
                        alt={currentClient.title}
                        className="h-full w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-106"
                      />
                      <div className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/70 text-white px-2.5 py-1 text-[10.5px] font-bold shadow-md backdrop-blur-xs">
                        <Flame size={12} className="text-amber-400 fill-amber-400" />
                        <span>BÀN GIAO THỰC TẾ</span>
                      </div>
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 text-stone-900 px-3 py-1.5 text-xs font-bold shadow-lg">
                          <ZoomIn size={14} /> Phóng to ảnh HD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Tối giản, thanh lịch, loại bỏ các chi tiết rối mắt */}
                  <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F3E8] border border-[#D5EAD5] text-[#1C4C40] px-2.5 py-1 text-[11px] font-bold tracking-wide">
                        <Building2 size={13} className="text-[#1C4C40]" />
                        <span>KHÁCH HÀNG DOANH NGHIỆP</span>
                      </span>

                      <h4 className="mt-2 text-xl sm:text-2xl font-black text-stone-900 tracking-tight leading-snug">
                        {currentClient.title}
                      </h4>

                      <div className="mt-3 flex items-start gap-2.5 bg-[#F8F6F0] rounded-2xl p-4 border border-[#ECE6DB]">
                        <span className="text-2xl font-serif text-[#C05621]/80 leading-none select-none shrink-0 -mt-0.5">
                          ❝
                        </span>
                        <p className="text-xs sm:text-sm text-[#44403C] leading-relaxed italic">
                          “{currentClient.caption ||
                            "Chậu cây thiết kế tem riêng mang thông điệp «Luôn bên bạn»"}”
                        </p>
                      </div>
                    </div>

                    {/* Dải 3 thông số định lượng cốt lõi trên 1 hàng duy nhất (gọn gàng, thoáng đãng) */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E7DFD3] px-3.5 py-2 text-xs font-bold text-[#1C4C40] shadow-2xs">
                        <Tag size={13} className="text-[#C05621]" />
                        <span>Quy mô: {clientMeta.scale}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#E7DFD3] px-3.5 py-2 text-xs font-bold text-[#1C4C40] shadow-2xs">
                        <Star size={13} className="text-amber-500 fill-amber-500" />
                        <span>Đánh giá: {clientMeta.rating}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200/90 px-3.5 py-2 text-xs font-extrabold text-emerald-800 shadow-2xs">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>Hóa đơn VAT đầy đủ</span>
                      </span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* =========================================================================
                 TRẠNG THÁI 2: TAB DỊCH VỤ QUÀ TẶNG (DÀN ĐỀU 3 CỘT TOÀN DẢI 100%)
                 ========================================================================= */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 animate-in fade-in duration-300">
                {activeServices.map((service, idx) => {
                  const cfg = SERVICE_CONFIGS[idx] || SERVICE_CONFIGS[0];
                  const badges = [
                    { tag: "0đ PHÍ THIẾT KẾ", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                    { tag: "CHỈN CHU TRỌN GÓI", bg: "bg-amber-50 text-amber-800 border-amber-200" },
                    { tag: "CHIẾT KHẤU CAO & VAT", bg: "bg-blue-50 text-blue-800 border-blue-200" },
                  ];
                  const badge = badges[idx] || badges[0];
                  return (
                    <div
                      key={service.id}
                      onClick={() => setLightboxItem(service)}
                      className="group bg-[#FCFBF9] hover:bg-white border border-[#E7DFD3] hover:border-[#1C4C40]/50 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        {/* Ảnh dịch vụ sắc nét */}
                        <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl bg-stone-100 border border-stone-200/90 mb-3.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={service.imageUrl}
                            alt={service.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-106"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 text-stone-900 px-2.5 py-1 text-[11px] font-bold shadow-md">
                              <ZoomIn size={13} /> Phóng to HD
                            </span>
                          </div>
                        </div>

                        {/* Badge nhận diện */}
                        <span
                          className={`inline-flex items-center text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-lg border mb-2 ${badge.bg}`}
                        >
                          {badge.tag}
                        </span>

                        <h4 className="text-sm sm:text-base font-black text-stone-900 group-hover:text-[#1C4C40] transition-colors">
                          {service.title || cfg.defaultTitle}
                        </h4>

                        <p className="mt-1.5 text-xs text-stone-500 leading-relaxed">
                          {service.caption || cfg.defaultDesc}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-stone-150 flex items-center justify-between text-xs font-bold text-[#1C4C40]">
                        <span>Xem ảnh thực tế</span>
                        <ChevronRight
                          size={15}
                          className="group-hover:translate-x-1 transition-transform"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ĐƯỜNG PHÂN CÁCH NGANG TINH TẾ NỐI LIỀN TẦNG TRÊN VÀ TẦNG DƯỚI */}
          <div className="border-t border-stone-200/90" />

          {/* TẦNG 2: DẢI ẢNH LIÊN HOÀN TOÀN DẢI GỘP SHOWROOM VƯỜN ƯƠM & KHÁCH HÀNG THỰC TẾ (CHUẨN ẢNH MẪU 1) */}
          {combinedGallery.length > 0 && (
            <div className="p-5 sm:p-6 lg:p-7 flex flex-col justify-between bg-stone-50/20">
              {/* Header phân khu gộp: Tiêu đề + Đường kẻ ngang nối liền + Nút < > (Chuẩn y hệt ảnh 1) */}
              <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100/90 shadow-2xs">
                    <Store size={17} />
                  </div>
                  <h3 className="text-sm sm:text-base md:text-lg font-black text-stone-900 tracking-tight">
                    Không gian vườn ươm & Khách hàng thực tế
                  </h3>
                </div>

                {/* Đường chỉ kẻ ngang tinh tế nối liền chuẩn y hệt ảnh thiết kế */}
                <div className="flex-1 h-px bg-stone-200/90 mx-2 hidden sm:block" />

                {/* Nút điều hướng Carousel < > */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleManualScroll("left")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 transition-colors cursor-pointer shadow-2xs"
                    aria-label="Xem ảnh trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleManualScroll("right")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 transition-colors cursor-pointer shadow-2xs"
                    aria-label="Xem ảnh tiếp theo"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Dải ảnh liên hoàn tự động chuyển động qua lại (Auto-movement filmstrip) */}
              <div
                ref={reelRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onTouchStart={() => setIsHovered(true)}
                onTouchEnd={() => setIsHovered(false)}
                onScroll={handleReelScroll}
                className="flex items-center gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar scroll-smooth py-1"
              >
                {combinedGallery.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setLightboxItem(item)}
                    className="group relative flex-none w-[170px] sm:w-[195px] md:w-[215px] aspect-4/3 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/90 cursor-pointer shadow-2xs hover:shadow-md hover:border-[#1C4C40]/50 transition-all transform hover:-translate-y-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />

                    {/* Badge nhỏ góc trên: Showroom hoặc Khách thật */}
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

                    {/* Overlay caption mờ khi hover */}
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

              {/* Dải tiến trình trượt màu cam đất tinh tế ở đáy container (chuẩn ảnh mẫu 1) */}
              <div className="mt-3.5 pt-2 flex items-center justify-between text-[11px] text-stone-400">
                <span className="hidden sm:inline">Rê chuột hoặc vuốt để tạm dừng · Nhấp để xem ảnh HD</span>
                <div className="w-full sm:w-48 h-1 bg-stone-100 rounded-full overflow-hidden ml-auto">
                  <div
                    className="h-full bg-[#C05621] rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.max(20, Math.min(100, scrollProgress))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            BANNER CTA B2B ZALO TOÀN DẢI (BÁO GIÁ QUÀ TẶNG DOANH NGHIỆP)
           ========================================================================= */}
        {data.cta?.href ? (
          <div className="mt-5 sm:mt-6 rounded-2xl sm:rounded-3xl bg-white border border-[#E7DFD3] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
                <MessageCircle size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-stone-900">
                  Bạn cần đặt cây quà tặng cho công ty hoặc sự kiện?
                </p>
                <p className="text-[11px] sm:text-xs text-stone-500">
                  Aloha tư vấn chọn cây, thiết kế in logo miễn phí và gửi báo giá ưu đãi tốt nhất trong 5 phút
                </p>
              </div>
            </div>
            <a
              href={data.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1C4C40] to-[#12362d] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:from-[#153a31] hover:to-[#0d2822] hover:shadow-lg transition-all transform active:scale-98 shrink-0"
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
          LIGHTBOX PHÓNG TO ẢNH HD SẮC NÉT
         ========================================================================= */}
      {lightboxItem ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-4xl w-full overflow-hidden rounded-3xl bg-stone-900 border border-stone-700/80 shadow-2xl flex flex-col"
          >
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              aria-label="Đóng xem lớn"
            >
              <X size={20} />
            </button>

            <div className="relative flex-1 bg-black/50 flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxItem.imageUrl}
                alt={lightboxItem.title}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="p-5 sm:p-6 bg-stone-900 border-t border-stone-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold mb-1">
                  Hình ảnh thật từ Aloha
                </span>
                <h4 className="text-base sm:text-lg font-bold">{lightboxItem.title}</h4>
                {lightboxItem.caption ? (
                  <p className="mt-1 text-xs sm:text-sm text-stone-300">
                    {lightboxItem.caption}
                  </p>
                ) : null}
              </div>

              {data.cta?.href ? (
                <a
                  href={data.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shrink-0"
                >
                  <MessageCircle size={14} />
                  <span>Tư vấn mẫu tương tự qua Zalo</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
