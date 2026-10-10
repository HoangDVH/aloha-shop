"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Leaf, Handshake } from "lucide-react";

/** Định dạng số chuẩn Việt Nam (dấu chấm phân tách hàng nghìn, dấu phẩy thập phân) */
function formatNumberVN(val: number, decimals: number = 0, decimalSeparator: string = ","): string {
  if (decimals > 0) {
    const fixed = val.toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${withDots}${decimalSeparator}${decPart}`;
  }
  const rounded = Math.round(val);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Hiệu ứng số tự nhảy (Animated Counter) mượt mà chuẩn Sắc Xanh Garden:
 * Tự động chạy số từ 0 lên giá trị mục tiêu khi cuộn vào khung nhìn màn hình.
 */
function StatCounter({
  target,
  suffix = "",
  decimals = 0,
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [val, setVal] = useState(target);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset về 0 khi client mount để chuẩn bị chạy hiệu ứng
    setVal(0);

    let animId: number;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            cancelAnimationFrame(animId);
            let startTime: number | null = null;
            // Easing mượt mà tự nhiên: tăng nhanh lúc đầu và giảm tốc êm ái
            const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

            const frame = (now: number) => {
              if (startTime === null) startTime = now;
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = easeOutExpo(progress);
              setVal(eased * target);

              if (progress < 1) {
                animId = requestAnimationFrame(frame);
              } else {
                setVal(target);
              }
            };

            animId = requestAnimationFrame(frame);
          } else {
            // Khi người dùng cuộn xa ra khỏi màn hình, reset về 0 để khi cuộn lại thì nhảy lại
            const rect = entry.boundingClientRect;
            if (rect.top > window.innerHeight || rect.bottom < 0) {
              setVal(0);
            }
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -30px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [target, duration]);

  const display = formatNumberVN(val, decimals);

  return (
    <span ref={ref} className="inline-block tabular-nums">
      {display}
      {suffix}
    </span>
  );
}

/** Hook dùng chung để kích hoạt hiệu ứng scroll reveal cho các phần tử .reveal */
function useScrollReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const targets = el.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach(target => target.setAttribute("data-show", "true"));
      return;
    }

    targets.forEach((target) => {
      if (!target.hasAttribute("data-show")) {
        target.setAttribute("data-show", "false");
      }
    });

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
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, []);

  return containerRef;
}

/**
 * =========================================================================
 * PHẦN 1: TẦM NHÌN ALOHA (Dùng tại trang Về Aloha /ve-aloha)
 * =========================================================================
 */
export function HomeVisionSection() {
  const containerRef = useScrollReveal();

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-[#FCFAF6] text-slate-800">
      <section
        id="tam-nhin-aloha"
        aria-label="Tầm nhìn Aloha Thế Giới Chậu Cây"
        className="relative overflow-hidden py-16 sm:py-24 lg:py-28"
      >
        {/* Họa tiết nhánh lá vẽ tay mờ trôi nhẹ bên TRÁI */}
        <svg
          viewBox="0 0 64 80"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute -left-8 top-1/2 hidden h-96 w-auto -translate-y-1/2 text-emerald-800/[0.08] lg:block animate-aloha-drift select-none"
        >
          <path d="M32 76C32 50 32 24 32 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 10 q -20 -3 -22 -10" />
            <path d="M32 10 q 20 -3 22 -10" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 17 q -18 -3 -20 -10" />
            <path d="M32 17 q 18 -3 20 -10" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 24 q -16 -3 -18 -10" />
            <path d="M32 24 q 16 -3 18 -10" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 31 q -14 -3 -16 -10" />
            <path d="M32 31 q 14 -3 16 -10" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 38 q -12 -3 -14 -10" />
            <path d="M32 38 q 12 -3 14 -10" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 45 q -10 -3 -12 -10" />
            <path d="M32 45 q 10 -3 12 -10" />
          </g>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M32 52 q -8 -3 -10 -10" />
            <path d="M32 52 q 8 -3 10 -10" />
          </g>
          <path d="M32 6c-2 0-3 2-3 4M32 6c2 0 3 2 3 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>

        {/* Họa tiết nhánh lá vẽ tay mờ trôi nhẹ bên PHẢI */}
        <svg
          viewBox="0 0 64 72"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 bottom-0 hidden h-80 w-auto text-emerald-800/[0.08] lg:block animate-aloha-drift-rev select-none"
        >
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M32 70 C 30 48 24 30 10 16" />
            <path d="M32 70 C 31 46 27 26 20 8" />
            <path d="M32 70 V 6" />
            <path d="M32 70 C 33 46 37 26 44 8" />
            <path d="M32 70 C 34 48 40 30 54 16" />
          </g>
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.8">
            <path d="M21 30 q -6 0 -9 -5M43 30 q 6 0 9 -5M26 18 q -5 -2 -7 -7M38 18 q 5 -2 7 -7" />
          </g>
        </svg>

        {/* Khung nội dung trung tâm */}
        <div className="relative mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-12 text-center">
          {/* Eyebrow: TẦM NHÌN ALOHA */}
          <div className="reveal flex justify-center" style={{ transitionDelay: "0ms" }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800">
              <span className="h-px w-6 bg-emerald-600/50" aria-hidden="true" />
              TẦM NHÌN ALOHA
              <span className="h-px w-6 bg-emerald-600/50 sm:hidden" aria-hidden="true" />
            </span>
          </div>

          {/* Tiêu đề Serif lớn thanh lịch với 2 lá cây đối xứng & nét gạch chân sketch */}
          <div className="reveal mt-6 sm:mt-8 flex items-center justify-center gap-4 sm:gap-6" style={{ transitionDelay: "80ms" }}>
            {/* Lá cây đối xứng lật ngược bên trái */}
            <svg
              viewBox="0 0 64 64"
              fill="none"
              aria-hidden="true"
              className="hidden size-10 md:size-12 -scale-x-100 text-emerald-700/40 sm:block shrink-0 select-none"
            >
              <path d="M32 4C18 14 10 28 10 40c0 11 8 20 22 20s22-9 22-20C54 28 46 14 32 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M32 8v50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M32 22c-6 2-10 6-13 12M32 22c6 2 10 6 13 12M32 38c-4 1-7 3-9 7M32 38c4 1 7 3 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            <h2 className="relative font-display-serif text-3xl sm:text-5xl lg:text-[4.2rem] font-semibold leading-[1.15] tracking-tight text-slate-900">
              <span className="relative inline-block pb-3 sm:pb-5">
                <span className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-amber-700 bg-clip-text text-transparent">
                  Không Gian Xanh Giữa Phố
                </span>
                <span className="underline-sketch absolute inset-x-0 bottom-0 h-3 sm:h-4.5" aria-hidden="true" />
              </span>
            </h2>

            {/* Lá cây đối xứng bên phải */}
            <svg
              viewBox="0 0 64 64"
              fill="none"
              aria-hidden="true"
              className="hidden size-10 md:size-12 text-emerald-700/40 sm:block shrink-0 select-none"
            >
              <path d="M32 4C18 14 10 28 10 40c0 11 8 20 22 20s22-9 22-20C54 28 46 14 32 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M32 8v50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M32 22c-6 2-10 6-13 12M32 22c6 2 10 6 13 12M32 38c-4 1-7 3-9 7M32 38c4 1 7 3 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Thông điệp chính: Chữ to, thanh tao, đậm chất triết lý xanh */}
          <p
            className="reveal mx-auto mt-8 sm:mt-12 max-w-3xl font-display-serif text-lg sm:text-2xl md:text-[1.75rem] font-medium leading-relaxed sm:leading-snug text-slate-900 tracking-normal"
            style={{ transitionDelay: "180ms" }}
          >
            Aloha Thế Giới Chậu Cây hướng đến trở thành thương hiệu hàng đầu Việt Nam trong lĩnh vực sản xuất và phân phối sản phẩm trang trí không gian xanh — chuyên ngành chậu, cây cảnh và giá thể.
          </p>

          {/* Thông điệp phụ mềm mại */}
          <div className="reveal mt-6 sm:mt-8" style={{ transitionDelay: "280ms" }}>
            <p className="mx-auto max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed text-slate-600">
              Chúng tôi không chỉ mang đến sản phẩm chất lượng và dịch vụ uy tín, mà còn lan tỏa kiến thức – giải pháp xanh bền vững, giúp khách hàng kiến tạo không gian sống hài hòa, gần gũi thiên nhiên.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * =========================================================================
 * PHẦN 2: VỀ ALOHA THẾ GIỚI CHẬU CÂY (Dùng tại Trang Chủ nằm dưới Banner)
 * =========================================================================
 */
export function HomeAboutMissionSection({
  ctaHref = "/ve-aloha",
  ctaLabel = "Câu chuyện của chúng tôi",
}: {
  ctaHref?: string;
  ctaLabel?: string;
} = {}) {
  const containerRef = useScrollReveal();

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-[#FCFAF6] text-slate-800">
      <section
        id="ve-aloha-the-gioi-chau-cay"
        aria-label="Về Aloha Thế Giới Chậu Cây"
        className="relative overflow-hidden py-14 sm:py-20 lg:py-24"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            {/* CỘT 1 (Trái): Collage 3 ảnh bo góc rounded-3xl + Badge nổi Xưởng & Vườn */}
            <div className="reveal order-1 lg:order-none" style={{ transitionDelay: "100ms" }}>
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
                  {/* Ảnh 1 dọc bên trái: aspect-[3/4] */}
                  <div className="card-sheen relative overflow-hidden rounded-3xl aspect-[3/4] shadow-md ring-1 ring-black/5 bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/banners/trust/cua-hang-1.webp"
                      alt="Showroom và xưởng chậu Aloha"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>

                  {/* Cột phải sole 2 ảnh: pt-8 sm:pt-10 */}
                  <div className="flex flex-col gap-3.5 sm:gap-4 pt-8 sm:pt-10">
                    {/* Ảnh 2 vuông: aspect-square */}
                    <div className="card-sheen relative overflow-hidden rounded-3xl aspect-square shadow-md ring-1 ring-black/5 bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/banners/trust/cua-hang-2.webp"
                        alt="Cây cảnh xanh tốt tại Aloha"
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                    </div>
                    {/* Ảnh 3: aspect-[4/5] */}
                    <div className="card-sheen relative overflow-hidden rounded-3xl aspect-[4/5] shadow-md ring-1 ring-black/5 bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/banners/trust/cua-hang-3.webp"
                        alt="Không gian trưng bày xanh Aloha"
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                    </div>
                  </div>
                </div>

                {/* Huy hiệu nổi bật ở đáy collage (Floating Badge) */}
                <div className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-white/95 px-5 py-3.5 shadow-xl ring-1 ring-emerald-950/10 backdrop-blur-xs z-10 w-[92%] sm:w-auto justify-center sm:justify-start">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100/90 text-emerald-800">
                    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="size-6 text-emerald-800">
                      <path d="M32 4C18 14 10 28 10 40c0 11 8 20 22 20s22-9 22-20C54 28 46 14 32 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M32 8v50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M32 22c-6 2-10 6-13 12M32 22c6 2 10 6 13 12M32 38c-4 1-7 3-9 7M32 38c4 1 7 3 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div className="leading-tight text-left">
                    <p className="font-display-serif text-sm sm:text-base font-bold text-slate-900">
                      Xưởng sản xuất &amp; Vườn ươm
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Chậu &amp; cây tận xưởng • Không qua trung gian
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT 2 (Phải): Tiêu đề, Cam kết 2 nhánh, 4 Chỉ số thống kê, Link chi tiết */}
            <div className="flex flex-col gap-5 sm:gap-6">
              {/* Eyebrow */}
              <div className="reveal" style={{ transitionDelay: "0ms" }}>
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
                  <span className="h-px w-6 bg-emerald-600/50" aria-hidden="true" />
                  VỀ ALOHA THẾ GIỚI CHẬU CÂY
                </span>
              </div>

              {/* Tiêu đề gradient */}
              <div className="reveal" style={{ transitionDelay: "80ms" }}>
                <h2 className="font-display-serif max-w-2xl text-2xl sm:text-3xl lg:text-[2.1rem] font-semibold text-slate-900 leading-snug sm:leading-tight tracking-tight">
                  Hơn 8 năm{" "}
                  <span className="bg-gradient-to-r from-emerald-800 via-emerald-600 to-amber-700 bg-clip-text text-transparent">
                    gieo mầm xanh
                  </span>{" "}
                  cho không gian Việt
                </h2>
              </div>

              {/* Đoạn giới thiệu */}
              <div className="reveal" style={{ transitionDelay: "160ms" }}>
                <p className="text-sm sm:text-base lg:text-lg leading-relaxed text-slate-600">
                  Aloha Thế Giới Chậu Cây mang đến giải pháp toàn diện từ sản xuất chậu cây đa dạng kích thước mẫu mã, tuyển chọn cây cảnh phong thủy thuần dưỡng kỹ càng đến cung ứng giá thể sạch chuyên biệt. Chúng tôi tự hào đồng hành cùng hàng ngàn ngôi nhà và văn phòng kiến tạo môi trường sống trong lành, thẩm mỹ.
                </p>
              </div>

              {/* 2 Khối cam kết rõ ràng: Khách hàng & Đối tác */}
              <div className="reveal grid grid-cols-1 gap-3 pt-1" style={{ transitionDelay: "240ms" }}>
                {/* 1. Với khách hàng */}
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/70 p-3.5 sm:p-4 ring-1 ring-emerald-800/10 transition-transform duration-300 hover:scale-[1.01]">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
                    <Leaf size={16} strokeWidth={2.4} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-emerald-950 uppercase tracking-wide">
                      Với khách hàng
                    </h3>
                    <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-slate-700">
                      Mang đến sản phẩm <strong className="text-emerald-900 font-semibold">đẹp – chất lượng – giá trị thực</strong>, cây khỏe thuần dưỡng tốt, tư vấn tận tâm và chính sách bảo hành, đổi trả minh bạch.
                    </p>
                  </div>
                </div>

                {/* 2. Với đối tác & doanh nghiệp */}
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50/70 p-3.5 sm:p-4 ring-1 ring-amber-800/10 transition-transform duration-300 hover:scale-[1.01]">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-700 text-white shadow-xs">
                    <Handshake size={16} strokeWidth={2.4} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-wide">
                      Với đối tác &amp; doanh nghiệp
                    </h3>
                    <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-slate-700">
                      Xây dựng quan hệ <strong className="text-amber-950 font-semibold">hợp tác bền vững</strong>, nguồn cung tận xưởng ổn định, chính sách sỉ và chiết khấu dự án hấp dẫn, hỗ trợ vận chuyển an toàn.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lưới 4 chỉ số thống kê nổi bật (Stats Grid) với hiệu ứng số tự nhảy */}
              <div className="reveal grid grid-cols-2 gap-x-6 gap-y-6 sm:max-w-md pt-2" style={{ transitionDelay: "320ms" }}>
                <div>
                  <p className="font-display-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-emerald-800">
                    <StatCounter target={8} suffix="+" duration={1500} />
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">Năm kinh nghiệm</p>
                </div>
                <div>
                  <p className="font-display-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-emerald-800">
                    <StatCounter target={5000} suffix="+" duration={1900} />
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">Khách hàng tin chọn</p>
                </div>
                <div>
                  <p className="font-display-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-emerald-800">
                    <StatCounter target={2000} suffix="+" duration={1800} />
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">Mẫu chậu &amp; cây</p>
                </div>
                <div>
                  <p className="font-display-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-emerald-800">
                    <StatCounter target={4.9} decimals={1} suffix="/5" duration={1600} />
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">Đánh giá hài lòng</p>
                </div>
              </div>

              {/* Link CTA */}
              {ctaHref && ctaLabel && (
                <div className="reveal pt-2" style={{ transitionDelay: "400ms" }}>
                  <Link
                    href={ctaHref}
                    className="group inline-flex items-center gap-2 font-semibold text-emerald-800 hover:text-emerald-950 text-sm sm:text-base"
                  >
                    <span className="border-b border-emerald-800/40 pb-0.5 group-hover:border-emerald-900 transition-colors">
                      {ctaLabel}
                    </span>
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Tương thích ngược: render cả 2 phần nếu cần */
export function HomeVisionMission() {
  return (
    <>
      <HomeVisionSection />
      <HomeAboutMissionSection />
    </>
  );
}
