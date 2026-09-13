"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    const vids = (videos || []).map(String).filter(Boolean);
    const imgs = (images || []).map(String).filter(Boolean);
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

  const current = media[idx] ?? null;

  useEffect(() => {
    setIdx(0);
    setMediaLightbox(false);
  }, [resetKey, media[0]?.src]);

  useEffect(() => {
    if (idx >= media.length) setIdx(0);
  }, [idx, media.length]);

  const goTo = (i: number) => {
    if (media.length === 0) return;
    const next = ((i % media.length) + media.length) % media.length;
    setIdx(next);
  };

  const openMediaLightbox = (atIndex?: number) => {
    const i = atIndex ?? idx;
    if (!media[i]) return;
    setIdx(i);
    setMediaLightbox(true);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
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
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-2 p-3 sm:p-4 lg:h-full lg:p-5">
      <div
        className="relative aspect-square w-full min-w-0 max-w-full flex-none overflow-hidden rounded-xl bg-[var(--aloha-cream)] lg:aspect-auto lg:min-h-[280px] lg:flex-1 lg:min-h-0"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current ? (
          current.kind === "video" ? (
            <div className="absolute inset-0 overflow-hidden bg-[var(--aloha-cream)]">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 bg-[var(--aloha-green-light)]" />
              )}
              <button
                type="button"
                onClick={() => openMediaLightbox(idx)}
                className="absolute inset-0 z-[2] flex items-center justify-center bg-black/10 transition hover:bg-black/20"
                aria-label="Xem video phóng to"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/10 sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Play className="ml-1 h-8 w-8 fill-[var(--aloha-green)] text-[var(--aloha-green)] sm:h-9 sm:w-9" />
                </span>
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.src}
              alt={alt}
              className="absolute inset-0 h-full w-full cursor-zoom-in object-contain"
              onClick={() => openMediaLightbox(idx)}
              draggable={false}
            />
          )
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
            Chưa có ảnh
          </div>
        )}

        {current?.kind === "image" ? (
          <button
            type="button"
            onClick={() => openMediaLightbox()}
            className="absolute bottom-2 right-2 z-[3] rounded-full bg-white/95 p-1.5 text-slate-500 shadow-sm ring-1 ring-black/5"
            aria-label="Phóng to ảnh"
          >
            <Maximize2 size={14} />
          </button>
        ) : null}
      </div>

      {media.length > 0 ? (
        <div className="flex min-w-0 max-w-full flex-col gap-1.5">
          {media.length > 1 ? (
            <p className="text-center text-[11px] tabular-nums text-slate-400">
              {idx + 1}/{media.length}
            </p>
          ) : null}
          <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1">
            <div className="flex w-max min-w-full justify-center gap-1.5 px-1 sm:gap-2">
              {media.map((item, i) => (
                <button
                  key={`thumb-${item.kind}-${item.src}-${i}`}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-[var(--aloha-cream)] transition sm:h-16 sm:w-16 ${
                    i === idx
                      ? "border-[var(--aloha-green)]"
                      : "border-transparent hover:border-[var(--aloha-line)]"
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
        onIndexChange={(i) => setIdx(i)}
      />
    </div>
  );
}
