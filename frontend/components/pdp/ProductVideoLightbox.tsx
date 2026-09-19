"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";

type MediaItem =
  | { kind: "video"; src: string; file: boolean }
  | { kind: "image"; src: string };

type Props = {
  open: boolean;
  startIndex: number;
  media: MediaItem[];
  poster: string;
  alt: string;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
};

/**
 * Phóng to kiểu TGDD.
 * Index: chỉ nhận startIndex lúc mở — không sync 2 chiều với parent khi đang mở
 * (tránh nhảy ảnh / nhấp nháy).
 */
export function ProductVideoLightbox({
  open,
  startIndex,
  media,
  poster,
  alt,
  onClose,
  onIndexChange,
}: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 960, h: 540 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  const safeIdx =
    media.length > 0
      ? Math.min(Math.max(0, idx), media.length - 1)
      : 0;
  const current = media[safeIdx];

  // Chỉ seed index khi vừa mở lightbox — không theo startIndex khi đang mở.
  useEffect(() => {
    if (open && !wasOpen.current) {
      const i =
        media.length > 0
          ? Math.min(Math.max(0, startIndex), media.length - 1)
          : 0;
      setIdx(i);
    }
    wasOpen.current = open;
  }, [open, startIndex, media.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (media.length < 2) return;
      if (e.key === "ArrowRight") {
        setIdx((v) => (v + 1) % media.length);
      } else if (e.key === "ArrowLeft") {
        setIdx((v) => (v - 1 + media.length) % media.length);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, media.length]);

  // Báo parent (đồng bộ thumb ngoài) — không để parent ghi ngược startIndex lúc đang mở.
  useEffect(() => {
    if (!open) return;
    onIndexChangeRef.current?.(safeIdx);
  }, [open, safeIdx]);

  /** Video: fit theo tỉ lệ nguồn. Ảnh dùng CSS object-contain (ổn định, không nhảy size). */
  const fitVideoBox = (vw: number, vh: number) => {
    if (typeof window === "undefined") return;
    const stage = stageRef.current;
    const maxW = stage
      ? stage.clientWidth
      : Math.floor(window.innerWidth * 0.98);
    const maxH = stage
      ? stage.clientHeight
      : Math.floor(window.innerHeight * 0.88);
    if (maxW < 80 || maxH < 80) return;
    const ar = vw > 0 && vh > 0 ? vw / vh : 16 / 9;
    let w: number;
    let h: number;
    if (maxW / maxH > ar) {
      h = maxH;
      w = h * ar;
    } else {
      w = maxW;
      h = w / ar;
    }
    setBox({ w: Math.round(w), h: Math.round(h) });
  };

  useEffect(() => {
    if (!open || !current || current.kind !== "video") return;
    if (!current.file) {
      fitVideoBox(16, 9);
    }
    const onResize = () => {
      const el = videoRef.current;
      if (el && el.videoWidth && el.videoHeight) {
        fitVideoBox(el.videoWidth, el.videoHeight);
      } else if (!current.file) {
        fitVideoBox(16, 9);
      }
    };
    window.addEventListener("resize", onResize);
    const t = window.setTimeout(onResize, 0);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.kind, current?.src]);

  if (!open || !current) return null;

  const isImage = current.kind === "image";
  const showBlurBg = current.kind === "video" && current.file;
  const canNav = media.length > 1;

  const goTo = (i: number) => {
    if (!media.length) return;
    setIdx(((i % media.length) + media.length) % media.length);
  };

  const navBtnClass = isImage
    ? "bg-white text-[var(--aloha-green)] shadow-md ring-1 ring-black/10 hover:bg-[var(--aloha-green-light)]"
    : "bg-white/15 text-white hover:bg-white/25";

  return (
    <div
      className={`fixed inset-0 z-[95] flex flex-col ${
        isImage ? "bg-[#f5f5f5]" : "bg-[#111]"
      }`}
      role="dialog"
      aria-modal
      aria-label="Xem media sản phẩm"
    >
      <button
        type="button"
        className={`absolute right-3 top-[calc(0.5rem+env(safe-area-inset-top,0px))] z-20 rounded-full p-2.5 transition sm:right-5 sm:top-4 ${
          isImage
            ? "bg-white text-slate-600 shadow-md ring-1 ring-black/10 hover:bg-slate-50"
            : "bg-white/15 text-white hover:bg-white/25"
        }`}
        onClick={onClose}
        aria-label="Đóng"
      >
        <X size={24} />
      </button>

      <div
        ref={stageRef}
        className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-2 py-2 sm:px-14"
      >
        {isImage ? (
          <div className="absolute inset-0 bg-[#f5f5f5]" aria-hidden />
        ) : showBlurBg ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={current.src}
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-3xl"
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 bg-black/35" aria-hidden />
          </>
        ) : poster ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 bg-black/40" aria-hidden />
          </>
        ) : (
          <div className="absolute inset-0 bg-[#111]" aria-hidden />
        )}

        {canNav ? (
          <>
            <button
              type="button"
              className={`absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition sm:left-3 sm:h-12 sm:w-12 ${navBtnClass}`}
              onClick={() => goTo(safeIdx - 1)}
              aria-label="Ảnh trước"
            >
              <ChevronLeft size={26} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={`absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition sm:right-3 sm:h-12 sm:w-12 ${navBtnClass}`}
              onClick={() => goTo(safeIdx + 1)}
              aria-label="Ảnh sau"
            >
              <ChevronRight size={26} strokeWidth={2.25} />
            </button>
          </>
        ) : null}

        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.src}
            src={current.src}
            alt={alt}
            className="relative z-[1] max-h-full max-w-full rounded-lg bg-white object-contain shadow-2xl ring-1 ring-black/5"
            draggable={false}
          />
        ) : (
          <div
            className="relative z-[1] overflow-hidden bg-black/20 shadow-2xl"
            style={{ width: box.w, height: box.h, maxWidth: "100%", maxHeight: "100%" }}
          >
            {current.kind === "video" && current.file ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={current.src}
                ref={videoRef}
                src={current.src}
                className="h-full w-full object-contain"
                playsInline
                controls
                autoPlay
                poster={poster || undefined}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    fitVideoBox(v.videoWidth, v.videoHeight);
                  }
                }}
              />
            ) : current.kind === "video" ? (
              <iframe
                key={current.src}
                src={`${current.src}${current.src.includes("?") ? "&" : "?"}autoplay=1&rel=0&playsinline=1`}
                title={alt}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : null}
          </div>
        )}
      </div>

      {media.length > 0 ? (
        <div
          className={`relative z-[2] shrink-0 border-t px-3 py-2 sm:py-2.5 ${
            isImage
              ? "border-slate-200 bg-white"
              : "border-white/10 bg-black/70 backdrop-blur-sm"
          }`}
        >
          <p
            className={`mb-1.5 text-center text-[11px] tabular-nums ${
              isImage ? "text-slate-400" : "text-white/55"
            }`}
          >
            {safeIdx + 1}/{media.length}
          </p>
          <div className="mx-auto w-full max-w-5xl overflow-x-auto pb-0.5">
            <div className="mx-auto flex w-max min-w-full justify-center gap-1.5 px-1 sm:gap-2">
              {media.map((item, i) => (
                <button
                  key={`vlb-${item.kind}-${item.src}-${i}`}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`relative aspect-square h-11 w-11 shrink-0 overflow-hidden rounded-md border-2 bg-[var(--aloha-cream)] sm:h-12 sm:w-12 ${
                    i === safeIdx
                      ? "border-[var(--aloha-green)]"
                      : isImage
                        ? "border-transparent opacity-80 hover:opacity-100"
                        : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.kind === "video" ? poster || item.src : item.src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {item.kind === "video" ? (
                    <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/45">
                      <Play className="h-3 w-3 fill-white text-white" />
                      <span className="text-[7px] font-bold uppercase text-white">
                        Video
                      </span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
