"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Play } from "lucide-react";
import { ProductVideoLightbox } from "@/components/pdp/ProductVideoLightbox";

type Props = {
  images: string[];
  /** Video URLs (R2 / YouTube embed / uploads) — hiện trước ảnh */
  videos?: string[];
  alt: string;
  /** Đổi mã SP / biến thể → về media đầu */
  resetKey: string;
};

function isYoutube(url: string) {
  return /youtube\.com|youtu\.be|youtube-nocookie/i.test(url);
}

function isFileVideo(url: string) {
  if (!url || isYoutube(url)) return false;
  if (/r2\.dev/i.test(url) || /\/uploads\//i.test(url)) return true;
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

type MediaItem =
  | { kind: "video"; src: string; file: boolean }
  | { kind: "image"; src: string };

/**
 * Gallery PDP — không dùng Embla (tránh lệch/tràn ngang mobile).
 * Vuốt trái/phải đổi ảnh; thumb + lightbox giữ như cũ.
 */
export function ProductGallery({ images, videos = [], alt, resetKey }: Props) {
  const media = useMemo<MediaItem[]>(() => {
    const vids = [...new Set((videos || []).map(String).filter(Boolean))];
    const imgs = [...new Set((images || []).map(String).filter(Boolean))];
    const out: MediaItem[] = [];
    for (const v of vids) {
      out.push({ kind: "video", src: v, file: isFileVideo(v) });
    }
    for (const src of imgs) {
      out.push({ kind: "image", src });
    }
    return out;
  }, [images, videos]);

  const poster = images[0] || "";
  const [idx, setIdx] = useState(0);
  const [mediaLightbox, setMediaLightbox] = useState(false);
  const touchX = useRef<number | null>(null);
  const lightboxOpenRef = useRef(false);
  lightboxOpenRef.current = mediaLightbox;
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = media[idx] ?? null;

  useEffect(() => {
    setIdx(0);
    setMediaLightbox(false);
  }, [resetKey]);

  useEffect(() => {
    thumbRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [idx]);

  useEffect(() => {
    if (media.length === 0) {
      if (idx !== 0) setIdx(0);
      return;
    }
    if (idx >= media.length) setIdx(media.length - 1);
  }, [idx, media.length]);

  const goTo = (i: number) => {
    if (media.length === 0) return;
    const next = ((i % media.length) + media.length) % media.length;
    setIdx(next);
  };

  const onLightboxIndex = useCallback((i: number) => {
    setIdx(i);
  }, []);

  const openMediaLightbox = (atIndex?: number) => {
    const i = atIndex ?? idx;
    if (!media[i]) return;
    setIdx(i);
    setMediaLightbox(true);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (lightboxOpenRef.current) return;
    touchX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (lightboxOpenRef.current) {
      touchX.current = null;
      return;
    }
    const start = touchX.current;
    touchX.current = null;
    if (start == null || media.length < 2) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) goTo(idx + 1);
    else goTo(idx - 1);
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-0 sm:gap-1.5 p-0 sm:p-4 lg:p-3 xl:p-4">
      <div
        className="relative aspect-square w-full max-w-full sm:max-w-[min(400px,calc(100vh-250px))] lg:max-w-[min(440px,calc(100vh-250px))] xl:max-w-[min(460px,calc(100vh-240px))] mx-auto min-w-0 overflow-hidden rounded-none sm:rounded-xl bg-stone-100 sm:bg-[var(--aloha-cream)] shadow-none sm:shadow-2xs select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current ? (
          current.kind === "video" ? (
            <div className="absolute inset-0 overflow-hidden bg-black/5 sm:bg-[var(--aloha-cream)]">
              {current.file ? (
                <video
                  key={current.src}
                  src={current.src}
                  className="absolute inset-0 h-full w-full cursor-pointer object-cover sm:object-contain"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={poster || undefined}
                  onClick={() => openMediaLightbox(idx)}
                />
              ) : (
                <>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover sm:object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-stone-900 sm:bg-[var(--aloha-green-light)]" />
                  )}
                  <iframe
                    key={current.src}
                    src={
                      /youtube\.com|youtu\.be|youtube-nocookie/i.test(current.src)
                        ? current.src
                            .replace("watch?v=", "embed/")
                            .replace("youtu.be/", "www.youtube.com/embed/")
                            .split("&")[0] +
                          (current.src.includes("?") ? "&" : "?") +
                          "autoplay=1&mute=1&playsinline=1&loop=1"
                        : current.src
                    }
                    title={alt}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </>
              )}
              {/* Nút phóng to video: mobile góc trái dưới, desktop giữ nguyên góc phải dưới chuẩn cũ */}
              <button
                type="button"
                onClick={() => openMediaLightbox(idx)}
                className="absolute bottom-3 left-3 z-[2] inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-xs hover:bg-black/60 transition sm:bottom-2 sm:right-2 sm:left-auto sm:min-h-11 sm:min-w-11 sm:bg-white/95 sm:text-slate-500 sm:ring-1 sm:ring-black/5 sm:hover:bg-white"
                aria-label="Xem video phóng to"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.src}
              src={current.src}
              alt={alt}
              className="absolute inset-0 h-full w-full cursor-zoom-in object-cover sm:object-contain"
              onClick={() => openMediaLightbox(idx)}
              draggable={false}
            />
          )
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
            Chưa có ảnh
          </div>
        )}

        {/* Nút phóng to ảnh: mobile góc trái dưới, desktop giữ nguyên góc phải dưới chuẩn cũ */}
        {current?.kind === "image" ? (
          <button
            type="button"
            onClick={() => openMediaLightbox()}
            className="absolute bottom-3 left-3 z-[2] inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-xs hover:bg-black/60 transition sm:bottom-2 sm:right-2 sm:left-auto sm:min-h-11 sm:min-w-11 sm:bg-white/95 sm:text-slate-500 sm:ring-1 sm:ring-black/5 sm:hover:bg-white"
            aria-label="Phóng to ảnh"
          >
            <Maximize2 size={16} />
          </button>
        ) : null}

        {/* Badge số thứ tự ảnh góc phải dưới trên mobile chuẩn TikTok Shop (ví dụ 1/6) */}
        {media.length > 1 && (
          <div className="absolute bottom-3 right-3 z-[2] rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white backdrop-blur-xs shadow-xs pointer-events-none sm:hidden">
            {idx + 1}/{media.length}
          </div>
        )}
      </div>

      {media.length > 0 ? (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
          {/* Dòng số thứ tự đếm ảnh trên desktop chuẩn cũ */}
          {media.length > 1 ? (
            <p className="hidden sm:block text-center text-[11px] leading-tight tabular-nums text-slate-400">
              {idx + 1}/{media.length}
            </p>
          ) : null}

          {/* Dãy thumbnail: mobile kiểu Shopee cuộn ngang, desktop giữ nguyên kích thước & màu viền xanh gốc */}
          <div className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-none overscroll-x-contain py-2 px-3 sm:py-0 sm:px-1">
            <div className="flex w-max min-w-full items-center gap-2 sm:justify-center sm:gap-2">
              {media.map((item, i) => (
                <button
                  key={`thumb-${item.kind}-${item.src}-${i}`}
                  ref={(el) => {
                    thumbRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-stone-100 transition-all sm:h-12 sm:w-12 lg:h-13 lg:w-13 sm:bg-[var(--aloha-cream)] ${
                    i === idx
                      ? "border-[#ff2442] ring-1 ring-[#ff2442] shadow-xs opacity-100 sm:border-[var(--aloha-green)] sm:ring-0 sm:shadow-none"
                      : "border-stone-200/80 opacity-65 hover:opacity-100 hover:border-stone-300 sm:border-transparent sm:opacity-100 sm:hover:border-[var(--aloha-line)]"
                  }`}
                  aria-label={
                    item.kind === "video" ? `Video ${i + 1}` : `Ảnh ${i + 1}`
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.kind === "video" ? poster || item.src : item.src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {item.kind === "video" ? (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/40">
                      <Play className="h-4 w-4 fill-white text-white sm:h-5 sm:w-5" />
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-white">
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

      <ProductVideoLightbox
        open={mediaLightbox}
        startIndex={idx}
        media={media}
        poster={poster}
        alt={alt}
        onClose={() => setMediaLightbox(false)}
        onIndexChange={onLightboxIndex}
      />
    </div>
  );
}
