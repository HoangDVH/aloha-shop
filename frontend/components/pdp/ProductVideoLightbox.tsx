"use client";

import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";

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
 * Phóng to kiểu TGDD:
 * - Khung player rộng gần full màn (chiều dài dài)
 * - Video phóng tối đa theo đúng tỉ lệ → không cắt nội dung
 * - Nền mờ hai bên khi video dọc (không để khoảng trống “trống trải”)
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

  const current = media[idx];

  useEffect(() => {
    if (open) setIdx(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    onIndexChange?.(idx);
  }, [idx, onIndexChange]);

  /** Video lớn nhất có thể trong stage, giữ đúng tỉ lệ nguồn. */
  const fitBox = (vw: number, vh: number) => {
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

  const refitFromMedia = () => {
    const el = videoRef.current;
    if (el && el.videoWidth && el.videoHeight) {
      fitBox(el.videoWidth, el.videoHeight);
      return;
    }
    if (current?.kind === "video" && !current.file) {
      // YouTube / ngang: khung rộng gần full như TGDD (16:9)
      fitBox(16, 9);
      return;
    }
    if (current?.kind === "image") {
      const img = new Image();
      img.onload = () => fitBox(img.naturalWidth || 1, img.naturalHeight || 1);
      img.src = current.src;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onResize = () => refitFromMedia();
    window.addEventListener("resize", onResize);
    const t = window.setTimeout(onResize, 0);
    const t2 = window.setTimeout(onResize, 80);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current]);

  if (!open || !current) return null;

  const isImage = current.kind === "image";
  const showBlurBg = current.kind === "video" && current.file;

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

      {/* Khung player rộng full — chiều dài dài như TGDD */}
      <div
        ref={stageRef}
        className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
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

        <div
          className={`relative z-[1] overflow-hidden shadow-2xl ${
            isImage ? "bg-white ring-1 ring-black/5" : "bg-black/20"
          }`}
          style={{ width: box.w, height: box.h, maxWidth: "100%", maxHeight: "100%" }}
        >
          {current.kind === "video" ? (
            current.file ? (
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
                    fitBox(v.videoWidth, v.videoHeight);
                  }
                }}
              />
            ) : (
              <iframe
                key={current.src}
                src={`${current.src}${current.src.includes("?") ? "&" : "?"}autoplay=1&rel=0&playsinline=1`}
                title={alt}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.src}
              alt={alt}
              className="h-full w-full object-contain"
              onLoad={(e) => {
                const im = e.currentTarget;
                fitBox(im.naturalWidth || 1, im.naturalHeight || 1);
              }}
            />
          )}
        </div>
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
            {idx + 1}/{media.length}
          </p>
          <div className="mx-auto w-full max-w-5xl overflow-x-auto pb-0.5">
            <div className="mx-auto flex w-max min-w-full justify-center gap-1.5 px-1 sm:gap-2">
              {media.map((item, i) => (
                <button
                  key={`vlb-${item.kind}-${item.src}-${i}`}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`relative aspect-square h-11 w-11 shrink-0 overflow-hidden rounded-md border-2 bg-[var(--aloha-cream)] sm:h-12 sm:w-12 ${
                    i === idx
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
