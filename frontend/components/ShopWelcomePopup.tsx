"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { shopApiBase } from "@/lib/api";
import type { AppearancePopup, PopupBannerItem } from "@/lib/appearanceTypes";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import {
  popupAudienceAllowed,
  popupCapped,
  popupInSchedule,
  popupPathAllowed,
  type PopupCapRecord,
} from "@/lib/popupRules";
import { PopupReopenBadge } from "@/components/PopupReopenBadge";

/** Cuộn tới tỉ lệ này của trang thì hiện luôn, không chờ hết thời gian trễ. */
const SCROLL_TRIGGER = 0.35;

const capKey = (id: string) => `aloha_popup_${id || "promo"}`;
const seenKey = (id: string) => `aloha_popup_seen_${id || "promo"}`;
const badgeOffKey = (id: string) => `aloha_popup_badge_off_${id || "promo"}`;

type StoreKind = "local" | "session";

function readStore(kind: StoreKind, key: string): string | null {
  try {
    return (kind === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStore(kind: StoreKind, key: string, value: string | null) {
  try {
    const s = kind === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function readCap(campaignId: string): PopupCapRecord | null {
  const raw = readStore("local", capKey(campaignId));
  if (!raw) return null;
  if (!raw.startsWith("{")) return { at: raw };
  try {
    const parsed = JSON.parse(raw) as PopupCapRecord;
    return parsed?.at ? parsed : null;
  } catch {
    return null;
  }
}

function isCapped(p: AppearancePopup): boolean {
  return popupCapped(
    readCap(p.campaignId),
    p.imageUrl.trim(),
    p.frequencyDays,
    p.showOncePerCampaign !== false,
    Date.now()
  );
}

function wantForcePopup(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("popup") === "1";
  } catch {
    return false;
  }
}

function sendPopupEvent(event: "view" | "click" | "close") {
  void fetch(`${shopApiBase()}/api/shop/appearance/popup-event`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

export function ShopWelcomePopup() {
  const pathname = usePathname() || "/";
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const forcedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const { viewer, loading: viewerLoading } = useCampaignView();
  const [popup, setPopup] = useState<AppearancePopup | null>(null);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  /** Đổi giá trị để vẽ lại sau khi ghi localStorage/sessionStorage. */
  const [, setStorageTick] = useState(0);
  const [forceShow] = useState(wantForcePopup);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${shopApiBase()}/api/shop/appearance`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p = data?.theme?.popup as AppearancePopup | undefined;
        if (!cancelled && p?.enabled && String(p.imageUrl || "").trim()) setPopup(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const audience = popup?.audience || "all";
  const eligible = Boolean(
    popup &&
      (audience === "all" || !viewerLoading) &&
      popupInSchedule(popup, Date.now()) &&
      popupAudienceAllowed(audience, viewer) &&
      popupPathAllowed(pathname, popup.pages)
  );

  /** Danh sách banner cho Slider Carousel xoay vòng chuẩn Shopee */
  const slides = useMemo<PopupBannerItem[]>(() => {
    if (!popup) return [];
    if (Array.isArray(popup.items) && popup.items.length >= 2) {
      return popup.items.filter((it) => Boolean(it.imageUrl?.trim()));
    }
    // Mặc định cung cấp 2 banner xoay vòng: 10/10 và 20/10
    const banner1010: PopupBannerItem = {
      id: "slide_1010",
      title: "Siêu Sale 10.10 - Ngày Đôi Đại Tiệc Mua Sắm",
      imageUrl: "/banners/popup-1010.webp",
      ctaHref: "/uu-dai?src=popup&campaign=1010",
      ctaLabel: "Săn sale 10/10 ngay",
    };
    const banner2010: PopupBannerItem = {
      id: "slide_2010",
      title: popup.title?.trim() || "Mừng ngày Phụ Nữ Việt Nam 20/10",
      imageUrl: popup.imageUrl?.trim() || "/uploads/shop-appearance/popup_2010_v3.webp",
      ctaHref: popup.ctaHref?.trim() || "/uu-dai?src=popup&focus=pro_1790589193561_6xl35k,pro_1790836003826_k9jcg2",
      ctaLabel: popup.ctaLabel?.trim() || "Xem ưu đãi 20/10",
    };
    return [banner1010, banner2010];
  }, [popup]);

  // Autoplay xoay vòng sau 3.5s (tự tạm dừng khi rê chuột hoặc chạm tay)
  useEffect(() => {
    if (!open || slides.length <= 1 || isPaused) return;
    const intervalMs = (popup?.autoplaySeconds || 3.5) * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [open, slides.length, isPaused, popup?.autoplaySeconds]);

  useEffect(() => {
    if (!popup || open) return;
    if (forceShow) {
      if (forcedRef.current) return;
      forcedRef.current = true;
      writeStore("local", capKey(popup.campaignId), null);
      const t = setTimeout(() => setOpen(true), 200);
      return () => clearTimeout(t);
    }
    if (!eligible || readStore("session", seenKey(popup.campaignId)) || isCapped(popup)) return;

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      writeStore("session", seenKey(popup.campaignId), "1");
      sendPopupEvent("view");
      setOpen(true);
    };
    const delay = Number(popup.delaySeconds);
    const timer = setTimeout(show, (Number.isFinite(delay) ? Math.max(0, Math.min(30, delay)) : 3) * 1000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      done = true;
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [popup, eligible, forceShow, open]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("close");
      else if (e.key === "ArrowLeft") goToPrev();
      else if (e.key === "ArrowRight") goToNext();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slides.length]);

  const dismiss = (reason: "close" | "click") => {
    if (popup && !forceShow) {
      writeStore(
        "local",
        capKey(popup.campaignId),
        JSON.stringify({
          at: new Date().toISOString(),
          imageUrl: popup.imageUrl.trim() || undefined,
        } satisfies PopupCapRecord)
      );
      if (reason === "click") writeStore("session", badgeOffKey(popup.campaignId), "1");
      sendPopupEvent(reason);
    }
    setOpen(false);
    setStorageTick((n) => n + 1);
  };

  const goToPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setIsPaused(false);
  };

  if (!popup) return null;

  const currentSlide = slides[currentIndex] || slides[0];
  const badgeImg = currentSlide?.imageUrl || popup.imageUrl.trim();
  const badgeLabel = currentSlide?.title || popup.title?.trim() || "Xem ưu đãi";

  const showBadge =
    !open &&
    !forceShow &&
    eligible &&
    !pathname.startsWith("/uu-dai") &&
    popup.reopenBadge !== false &&
    !readStore("session", badgeOffKey(popup.campaignId)) &&
    (Boolean(readStore("session", seenKey(popup.campaignId))) || isCapped(popup));

  return (
    <>
      {showBadge ? (
        <PopupReopenBadge
          imageUrl={badgeImg}
          label={badgeLabel}
          onOpen={() => {
            sendPopupEvent("view");
            setOpen(true);
          }}
          onHide={() => {
            writeStore("session", badgeOffKey(popup.campaignId), "1");
            setStorageTick((n) => n + 1);
          }}
        />
      ) : null}

      {open ? (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-3 transition-all duration-300 sm:p-6 ${
            entered ? "bg-black/60 backdrop-blur-[4px]" : "bg-black/0 backdrop-blur-0"
          }`}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) dismiss("close");
          }}
        >
          {/* Hộp thoại Popup Carousel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative w-[min(92vw,440px)] sm:w-[min(90vw,480px)] select-none ${
              entered ? "aloha-popup-pop" : "opacity-0"
            }`}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Nút đóng (X) tròn ở góc trên phải */}
            <button
              ref={closeRef}
              type="button"
              onClick={() => dismiss("close")}
              className="absolute -right-2 -top-2 sm:-right-3 sm:-top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/90 bg-white text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.32)] transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none cursor-pointer"
              aria-label="Đóng popup"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>

            {/* Khung chứa Carousel Slider */}
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/20">
              {/* Dải trượt (Track) xoay vòng mượt mà */}
              <div
                className="flex transition-transform duration-500 ease-out will-change-transform"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {slides.map((slide, idx) => (
                  <div key={slide.id || idx} className="min-w-full w-full shrink-0 relative">
                    <Link
                      id={idx === 0 ? titleId : undefined}
                      href={slide.ctaHref || "/uu-dai"}
                      onClick={() => dismiss("click")}
                      className="relative block select-none focus:outline-none cursor-pointer"
                      aria-label={slide.title || slide.ctaLabel || "Xem ưu đãi"}
                      draggable={false}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.imageUrl}
                        alt={slide.title || "Ưu đãi"}
                        className="block h-auto max-h-[min(82vh,820px)] w-full select-none object-contain drop-shadow-md"
                        draggable={false}
                      />
                      {entered ? (
                        <span
                          className="aloha-popup-shine"
                          style={{ "--popup-mask": `url(${JSON.stringify(slide.imageUrl)})` } as React.CSSProperties}
                          aria-hidden
                        />
                      ) : null}
                    </Link>
                  </div>
                ))}
              </div>

              {/* Tag đếm số slide (1/2) góc trên bên trái */}
              {slides.length > 1 && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs shadow-xs pointer-events-none select-none">
                  <span>{currentIndex + 1}</span>
                  <span className="opacity-60">/</span>
                  <span>{slides.length}</span>
                </div>
              )}

              {/* Chấm tròn phân trang (Dots) phía dưới theo chuẩn Shopee */}
              {slides.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 backdrop-blur-xs shadow-xs">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(idx);
                      }}
                      className={`transition-all duration-300 rounded-full cursor-pointer ${
                        currentIndex === idx
                          ? "w-6 h-2 bg-gradient-to-r from-rose-500 to-red-500 shadow-xs"
                          : "w-2 h-2 bg-white/60 hover:bg-white"
                      }`}
                      aria-label={`Chuyển tới slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Mũi tên lướt trái/phải (Prev/Next) */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/35 hover:bg-black/60 text-white backdrop-blur-xs shadow-md transition-all opacity-80 hover:opacity-100 hover:scale-105 active:scale-95 focus-visible:outline-none cursor-pointer sm:left-3"
                    aria-label="Xem banner trước"
                  >
                    <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/35 hover:bg-black/60 text-white backdrop-blur-xs shadow-md transition-all opacity-80 hover:opacity-100 hover:scale-105 active:scale-95 focus-visible:outline-none cursor-pointer sm:right-3"
                    aria-label="Xem banner tiếp theo"
                  >
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
