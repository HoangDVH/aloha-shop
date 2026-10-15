"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Play, Volume2, VolumeX } from "lucide-react";
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

function GalleryVideoSlide({
  src,
  file,
  poster,
  alt,
  isActive,
  isFirstSlide,
  mediaLightbox,
  slideIndex,
  onOpenLightbox,
}: {
  src: string;
  file: boolean;
  poster: string;
  alt: string;
  isActive: boolean;
  isFirstSlide: boolean;
  mediaLightbox: boolean;
  slideIndex: number;
  onOpenLightbox: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Điều khiển phát / dừng video theo trạng thái slide đang xem
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !file) return;
    let cancelled = false;

    if (isActive && !mediaLightbox) {
      if (video.paused) {
        setIsBuffering(true);
      }
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          if (cancelled) return;
          setIsBlocked(false);
        }).catch(() => {
          if (cancelled) return;
          // Trình duyệt chặn tự động phát (iOS Low Power Mode hoặc chính sách bảo mật)
          setIsBlocked(true);
          setIsBuffering(false);
        });
      }
    } else {
      video.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    }
    return () => { cancelled = true; video.pause(); };
  }, [isActive, mediaLightbox, file, src]);

  const handleManualPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    setIsBlocked(false);
    setIsBuffering(true);
    video.play().catch(() => {
      setIsBlocked(true);
      setIsBuffering(false);
    });
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMuted;
    setIsMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
    }
  };

  return (
    <div
      onClick={onOpenLightbox}
      className="absolute inset-0 overflow-hidden bg-[var(--aloha-cream)]"
    >
      {/* LỚP 0: Ảnh bìa sắc nét lót đáy (hiển thị tức thì 0ms lúc nạp, tự động ẩn khi video bắt đầu chạy) */}
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={alt}
          className={`absolute inset-0 z-0 h-full w-full object-cover sm:object-contain select-none transition-opacity duration-300 ease-out ${
            isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          draggable={false}
        />
      ) : null}

      {file ? (
        <>
          {/* LỚP 1: Thẻ video - hiển thị trọn vẹn tỉ lệ nguồn trên nền xanh aloha-cream chuẩn production */}
          <video
            ref={videoRef}
            key={src}
            src={src}
            className={`absolute inset-0 z-[1] h-full w-full cursor-pointer object-contain transition-opacity duration-300 ease-out ${
              isPlaying ? "opacity-100" : "opacity-0"
            }`}
            data-slide={slideIndex}
            preload={isFirstSlide ? "auto" : "metadata"}
            muted={isMuted}
            loop
            playsInline
            poster={poster || undefined}
            onPlaying={() => {
              setIsPlaying(true);
              setIsBuffering(false);
              setIsBlocked(false);
            }}
            onWaiting={() => {
              if (!isBlocked) setIsBuffering(true);
            }}
            onCanPlay={() => {
              setIsBuffering(false);
            }}
            onPause={() => {
              setIsPlaying(false);
            }}
            onError={() => {
              setIsBuffering(false);
            }}
          />

          {/* LỚP 2A: Biểu tượng loading/buffer tinh tế lúc đang nạp dữ liệu */}
          {isActive && isBuffering && !isPlaying && !isBlocked && (
            <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Đang phát video...</span>
              </div>
            </div>
          )}

          {/* LỚP 2B: Nút Play cứu cánh khi trình duyệt chặn tự động phát (iOS tiết kiệm pin) */}
          {isActive && isBlocked && !isPlaying && (
            <button
              type="button"
              onClick={handleManualPlay}
              className="group/btn absolute inset-0 z-[2] flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30 cursor-pointer"
              aria-label="Phát video"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white shadow-xl backdrop-blur-xs ring-2 ring-white/90 transition-transform group-hover/btn:scale-110 active:scale-95">
                <Play className="ml-1 h-7 w-7 fill-white text-white" />
              </div>
            </button>
          )}

          {/* LỚP 3: Nút Bật/Tắt âm thanh chuẩn TikTok Shop */}
          {isActive && isPlaying && (
            <button
              type="button"
              onClick={toggleMute}
              className="absolute top-3 left-3 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-xs hover:bg-black/70 transition cursor-pointer"
              aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          )}
        </>
      ) : (
        /* YouTube iframe fallback */
        <>
          {isActive && !mediaLightbox && (
            <iframe
              key={src}
              src={
                /youtube\.com|youtu\.be|youtube-nocookie/i.test(src)
                  ? src
                      .replace("watch?v=", "embed/")
                      .replace("youtu.be/", "www.youtube.com/embed/")
                      .split("&")[0] +
                    (src.includes("?") ? "&" : "?") +
                    "autoplay=1&mute=1&playsinline=1&loop=1"
                  : src
              }
              title={alt}
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full border-0 sm:pointer-events-auto"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </>
      )}

      {/* Nút phóng to video: mobile góc trái dưới, desktop giữ nguyên góc phải dưới chuẩn cũ */}
      <button
        type="button"
        onClick={onOpenLightbox}
        className="absolute bottom-3 left-3 z-[2] inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-xs hover:bg-black/60 transition sm:bottom-2 sm:right-2 sm:left-auto sm:min-h-11 sm:min-w-11 sm:bg-white/95 sm:text-slate-500 sm:ring-1 sm:ring-black/5 sm:hover:bg-white cursor-pointer"
        aria-label="Xem video phóng to"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}

/**
 * Native horizontal scrolling follows the finger and snaps to each media slide.
 * Keep image elements mounted; thumbnails and lightbox share the active index.
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
  const viewport = useRef<HTMLDivElement>(null);
  const thumbViewport = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const activeIndex = useRef(0);
  activeIndex.current = idx;
  const scrollFrame = useRef<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = media[idx] ?? null;

  useEffect(() => {
    setIdx(0);
    setMediaLightbox(false);
    viewport.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [resetKey]);

  useEffect(() => {
    const strip = thumbViewport.current;
    const thumb = thumbRefs.current[idx];
    if (!strip || !thumb) return;
    const bounds = strip.getBoundingClientRect();
    const target = thumb.getBoundingClientRect();
    if (target.left < bounds.left) strip.scrollBy({ left: target.left - bounds.left, behavior: "smooth" });
    else if (target.right > bounds.right) strip.scrollBy({ left: target.right - bounds.right, behavior: "smooth" });
  }, [idx]);

  useEffect(() => {
    if (media.length === 0) {
      if (idx !== 0) setIdx(0);
      return;
    }
    if (idx >= media.length) {
      setIdx(media.length - 1);
      viewport.current?.scrollTo({ left: (media.length - 1) * viewport.current.clientWidth, behavior: "instant" });
    }
  }, [idx, media.length]);

  const goTo = (i: number) => {
    if (media.length === 0) return;
    const next = ((i % media.length) + media.length) % media.length;
    setIdx(next);
    viewport.current?.scrollTo({ left: next * viewport.current.clientWidth, behavior: "smooth" });
  };

  const onLightboxIndex = useCallback((i: number) => {
    setIdx(i);
    viewport.current?.scrollTo({ left: i * viewport.current.clientWidth, behavior: "instant" });
  }, []);

  const openMediaLightbox = (atIndex?: number) => {
    const i = atIndex ?? idx;
    if (!media[i]) return;
    setIdx(i);
    setMediaLightbox(true);
  };

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => element.scrollTo({ left: activeIndex.current * element.clientWidth, behavior: "instant" }));
    observer.observe(element);
    return () => { observer.disconnect(); if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current); };
  }, []);


  const onScroll = () => {
    if (scrollFrame.current != null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const element = viewport.current;
      if (!element?.clientWidth || !media.length) return;
      const next = Math.max(0, Math.min(media.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
      setIdx(previous => previous === next ? previous : next);
    });
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-0 sm:gap-1.5 p-0 sm:p-4 lg:p-3 xl:p-4">
      <div
        className="relative aspect-square w-full max-w-full sm:max-w-[min(400px,calc(100vh-250px))] lg:max-w-[min(440px,calc(100vh-250px))] xl:max-w-[min(460px,calc(100vh-240px))] mx-auto min-w-0 overflow-hidden rounded-none sm:rounded-xl bg-stone-100 sm:bg-[var(--aloha-cream)] shadow-none sm:shadow-2xs select-none"
      >
        <div ref={viewport} onScroll={onScroll}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
          onTouchStart={event => { const t = event.touches[0]; touchStart.current = t ? { x: t.clientX, y: t.clientY } : null; dragged.current = false; }}
          onTouchMove={event => { const t = event.touches[0]; const start = touchStart.current; if (t && start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) dragged.current = true; }}
          onClickCapture={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}>
        {media.length ? media.map((current, slideIndex) => (
          <div key={`${current.kind}-${current.src}`} className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden">
          {current.kind === "video" ? (
            <GalleryVideoSlide
              src={current.src}
              file={current.file}
              poster={poster}
              alt={alt}
              isActive={slideIndex === idx}
              isFirstSlide={slideIndex === 0}
              mediaLightbox={mediaLightbox}
              slideIndex={slideIndex}
              onOpenLightbox={() => openMediaLightbox(slideIndex)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.src}
              src={current.src}
              alt={alt}
              className="absolute inset-0 h-full w-full cursor-zoom-in object-cover sm:object-contain"
              onClick={() => openMediaLightbox(slideIndex)}
              loading={slideIndex <= idx + 1 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
            />
          )}
          </div>
        )) : (
          <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
            Chưa có ảnh
          </div>
        )}
        </div>

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
          <div ref={thumbViewport} className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-none overscroll-x-contain py-2 px-3 sm:py-0 sm:px-1">
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
