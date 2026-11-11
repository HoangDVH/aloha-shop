"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Gift,
  Link2,
  Loader2,
  Play,
  QrCode,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { QRCodeSVG } from "@rc-component/qrcode";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { buildProductShareUrl, isValidCtvCode, normalizeCtvCode } from "@/lib/ctv";
import { SHOP_ORIGIN } from "@/lib/seo";
import { useToast } from "@/components/Toast";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { productShareData } from "@/lib/productShareData";
import {
  buildProductCaption,
  publicSharePrice,
  shareCaptionWithLink,
} from "@/lib/shareCaption";
import { fetchPublicSharePreview, fetchPublicShareProduct } from "@/lib/publicShareProduct";
import type { PublicSharePreview } from "../../../shared/publicSharePreview";
import { ShareCaptionEditor } from "@/components/ShareCaptionEditor";
import { useHydrated } from "@/lib/useHydratedQuery";
import { ProductExtensionGuideModal } from "./ProductExtensionGuideModal";
import {
  canShareFilesOnDevice,
  copyText,
  downloadFile,
  isMobileBrowser,
  isShareableVideoUrl,
  loadShareFile,
  type ShareMediaItem,
} from "@/lib/shareMedia";

const MAX_MEDIA = 12;
const MAX_PICK = 9;
const DEFAULT_PICK = 6;

type LoadState = "loading" | "ok" | "error";

function publicShareUrl(raw: string): string {
  try {
    const u = new URL(raw, SHOP_ORIGIN);
    return `${SHOP_ORIGIN}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

export type ShareProps = {
  ma: string;
  name: string;
  path: string;
  price: number;
  images: string[];
  videos: string[];
  ctvCode?: string;
};

export { ProductShareButton } from "./ProductShareButton";

export function ProductShareSheet({
  ma,
  name,
  path,
  images,
  videos,
  ctvCode: propCtvCode,
  onClose,
}: ShareProps & { onClose: () => void }) {
  const toast = useToast();
  const { user } = useShopAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const files = useRef(new Map<string, File>());
  const inflight = useRef(new Set<string>());
  const loader = useRef<AbortController | null>(null);

  const [loadState, setLoadState] = useState<Record<string, LoadState>>({});
  const [deviceShare, setDeviceShare] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [publicProduct, setPublicProduct] = useState<ShopProduct | null>(null);
  const [captionLoading, setCaptionLoading] = useState(true);
  const [captionError, setCaptionError] = useState(false);
  const [editedCaption, setEditedCaption] = useState<string | null>(null);
  const [preview, setPreview] = useState<PublicSharePreview>();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);

  // CHỈ hiển thị mã CTV khi tài khoản đang đăng nhập có quyền CTV thực thụ
  const isCtv = Boolean(user?.roles?.includes("ctv") && user?.ctvCode);
  const effectiveCtv = isCtv && user?.ctvCode ? normalizeCtvCode(user.ctvCode) : (isValidCtvCode(propCtvCode || "") ? normalizeCtvCode(propCtvCode || "") : "");

  const media = useMemo<ShareMediaItem[]>(() => {
    const vids = [...new Set(videos.filter(isShareableVideoUrl))].map((src) => ({
      src,
      kind: "video" as const,
    }));
    const imgs = [...new Set(images.filter(Boolean))].map((src) => ({
      src,
      kind: "image" as const,
    }));
    return [...vids.slice(0, 2), ...imgs].slice(0, MAX_MEDIA);
  }, [images, videos]);

  const [picked, setPicked] = useState<string[]>(() =>
    media.slice(0, DEFAULT_PICK).map((m) => m.src)
  );
  const pickedItems = media.filter((m) => picked.includes(m.src));
  const poster = images[0] || "";
  const url = publicShareUrl(buildProductShareUrl(path, effectiveCtv, ma));
  const publicPrice = publicProduct ? publicSharePrice(publicProduct).price : 0;
  const priceLabel = publicPrice > 0 ? formatVnd(publicPrice) : "";
  const defaultCaption = publicProduct
    ? buildProductCaption(publicProduct, url, Date.now(), preview)
    : `${name}\n\nXem mẫu và giá tại ALOHA: ${url}`;
  const caption = editedCaption ?? defaultCaption;
  const fullCaption = shareCaptionWithLink(caption, url);
  const fileBase = `aloha-${ma}`.replace(/[^\w-]+/g, "-");

  useEffect(() => {
    const ctrl = new AbortController();
    setCaptionLoading(true);
    setCaptionError(false);
    setPublicProduct(null);
    setEditedCaption(null);
    setPreview(undefined);
    const load = async () => {
      const [product, offer] = await Promise.allSettled([
        fetchPublicShareProduct(ma, ctrl.signal),
        fetchPublicSharePreview(ma, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (product.status === "fulfilled") {
        setPublicProduct(product.value);
        setCaptionError(false);
      } else {
        setCaptionError(true);
      }
      setPreview(offer.status === "fulfilled" ? offer.value : undefined);
      setCaptionLoading(false);
    };
    void load();
    const refresh = window.setInterval(() => {
      void load();
    }, 45_000);
    return () => {
      ctrl.abort();
      window.clearInterval(refresh);
    };
  }, [ma]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    setIsMobile(isMobileBrowser());
    setDeviceShare(canShareFilesOnDevice());

    const checkExt = () => {
      if (document.documentElement.getAttribute("data-aloha-extension-installed") === "true") {
        setHasExtension(true);
      }
    };
    checkExt();
    const handleReady = () => setHasExtension(true);
    window.addEventListener("aloha-extension-ready", handleReady);
    const extTimer = setTimeout(checkExt, 300);

    return () => {
      el.close();
      document.body.style.overflow = before;
      window.removeEventListener("aloha-extension-ready", handleReady);
      clearTimeout(extTimer);
    };
  }, []);

  useEffect(() => () => loader.current?.abort(), []);

  useEffect(() => {
    loader.current ??= new AbortController();
    const { signal } = loader.current;
    for (const item of pickedItems) {
      if (
        files.current.has(item.src) ||
        inflight.current.has(item.src) ||
        loadState[item.src] === "error"
      )
        continue;
      inflight.current.add(item.src);
      setLoadState((s) => ({ ...s, [item.src]: "loading" }));
      loadShareFile(item, `${fileBase}-${media.indexOf(item) + 1}`, signal)
        .then((f) => {
          files.current.set(item.src, f);
          setLoadState((s) => ({ ...s, [item.src]: "ok" }));
        })
        .catch(() => {
          if (!signal.aborted) setLoadState((s) => ({ ...s, [item.src]: "error" }));
        })
        .finally(() => inflight.current.delete(item.src));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, loadState]);

  const readyFiles = pickedItems
    .map((m) => files.current.get(m.src))
    .filter((f): f is File => Boolean(f));

  const toggle = (src: string) => {
    setPicked((p) => {
      if (p.includes(src)) return p.filter((s) => s !== src);
      if (p.length >= MAX_PICK) {
        toast.push(`Chọn tối đa ${MAX_PICK} ảnh/video`);
        return p;
      }
      return [...p, src];
    });
    setLoadState((s) => {
      if (s[src] !== "error") return s;
      const { [src]: _retry, ...rest } = s;
      return rest;
    });
  };

  // Chia sẻ bằng ứng dụng native trên điện thoại (App Facebook / Zalo tự nạp toàn bộ ảnh & video)
  const shareNative = async (target: "facebook" | "zalo") => {
    try {
      let currentFiles = readyFiles;
      if (currentFiles.length < pickedItems.length) {
        setDownloading(true);
        toast.push("Đang chuẩn bị ảnh & video...");
        const loaded: File[] = [];
        for (const item of pickedItems) {
          let f = files.current.get(item.src);
          if (!f) {
            try {
              f = await loadShareFile(item, `${fileBase}-${media.indexOf(item) + 1}`);
              files.current.set(item.src, f);
            } catch {}
          }
          if (f) loaded.push(f);
        }
        currentFiles = loaded;
        setDownloading(false);
      }

      await copyText(fullCaption);

      const data = productShareData({
        selectedCount: currentFiles.length,
        files: currentFiles,
        target,
        title: name,
        caption: fullCaption,
        url,
        canShare: (d) => Boolean(navigator.canShare?.(d)),
      });

      await navigator.share(data);
      toast.push(
        target === "facebook" && currentFiles.length
          ? "Đã mở Facebook kèm ảnh/video — chỉ cần chạm 'Dán' vào bài đăng!"
          : `Đã mở chia sẻ ${target === "facebook" ? "Facebook" : "Zalo"}.`
      );
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      if (target === "facebook") {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank",
          "noopener,noreferrer,width=640,height=600"
        );
      } else {
        window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
      }
    }
  };

  // Bắn dữ liệu sang Chrome Extension Aloha để tự động nạp ảnh & video vào Facebook
  const handleExtensionShare = () => {
    if (hasExtension) {
      window.postMessage(
        {
          type: "ALOHA_SHARE_TO_FB_EXTENSION",
          payload: {
            name,
            caption: fullCaption,
            url,
            media: pickedItems.map((p) => ({
              src: p.src,
              kind: p.kind,
            })),
            images: pickedItems.map((p) => p.src),
          },
        },
        "*"
      );
      toast.push("🌿 Đang mở Facebook và tự động nạp ảnh & video...");
    } else {
      setShowExtensionGuide(true);
    }
  };

  // Sao chép link 1-click
  const handleCopyOnlyUrl = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopiedUrl(true);
      toast.push("Đã sao chép liên kết sản phẩm!");
      setTimeout(() => setCopiedUrl(false), 2500);
    } else {
      toast.push("Không thể sao chép liên kết.");
    }
  };

  // Sao chép toàn bộ bài viết (caption + link)
  const handleCopyCaption = async () => {
    const ok = await copyText(fullCaption);
    if (ok) {
      setCopiedCaption(true);
      toast.push("Đã sao chép nội dung bài viết & link SP!");
      setTimeout(() => setCopiedCaption(false), 2500);
    } else {
      toast.push("Không thể sao chép nội dung bài viết.");
    }
  };

  // Chia sẻ Zalo
  const handleZaloShare = () => {
    if (isMobile && deviceShare) {
      void shareNative("zalo");
      return;
    }
    // Trên máy tính: mở trực tiếp Zalo Web và sao chép nội dung
    void copyText(fullCaption);
    window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
    toast.push("Đã sao chép link SP & mở Zalo. Nhấn Dán (Ctrl+V) để gửi ngay!");
  };

  // Chia sẻ Facebook (Tự động nạp qua tiện ích nếu có, hoặc mở khung chia sẻ)
  const handleFacebookShare = () => {
    if (isMobile && deviceShare) {
      void shareNative("facebook");
      return;
    }
    // Trên máy tính: nếu đã cài tiện ích Aloha -> tự động nạp toàn bộ ảnh & video
    if (hasExtension) {
      handleExtensionShare();
      return;
    }
    // Trên máy tính chưa cài tiện ích: mở trực tiếp khung popup Facebook và sao chép nội dung
    void copyText(fullCaption);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=640,height=600"
    );
    toast.push("Đã mở khung Tạo bài viết Facebook & sao chép nội dung!");
  };

  // Tải trọn bộ ảnh & video đã chọn về máy
  const saveMedia = async () => {
    if (!pickedItems.length) {
      toast.push("Chọn ít nhất 1 ảnh hoặc video");
      return;
    }
    setDownloading(true);
    let failed = 0;
    for (let i = 0; i < pickedItems.length; i++) {
      const item = pickedItems[i]!;
      try {
        const n = media.indexOf(item) + 1;
        const f = files.current.get(item.src) ?? (await loadShareFile(item, `${fileBase}-${n}`));
        files.current.set(item.src, f);
        downloadFile(f);
        if (i < pickedItems.length - 1) {
          await new Promise((r) => setTimeout(r, 180));
        }
      } catch {
        failed += 1;
      }
    }
    setDownloading(false);
    void copyText(fullCaption);
    toast.push(
      failed
        ? `Đã lưu ${pickedItems.length - failed}/${pickedItems.length} file.`
        : `Đã lưu ${pickedItems.length} ảnh/video và sao chép sẵn bài viết!`
    );
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-5 text-stone-900 shadow-2xl backdrop:bg-black/60 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {/* Tiêu đề & Nút đóng */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-[var(--aloha-green,#2D5A27)]">
            <Share2 size={18} />
          </div>
          <div>
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
              Chia sẻ sản phẩm
            </h2>
            <p className="text-xs text-stone-500">Gửi bạn bè hoặc lưu ảnh/video để đăng bài</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chia sẻ"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Thẻ xem trước sản phẩm (Product Preview Card) */}
        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-50 shadow-xs">
          <div className="flex items-center gap-3 p-3">
            <div className="h-18 w-18 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-white border border-stone-200/60 shadow-2xs">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-emerald-800">
                  Sản phẩm ALOHA
                </span>
                <span className="text-[11px] font-semibold text-stone-500">
                  alohathegioichaucay.com
                </span>
              </div>
              <h3 className="line-clamp-2 text-sm font-bold text-stone-900 leading-snug">
                {name}
              </h3>
              {priceLabel ? (
                <p className="mt-1 text-sm font-extrabold text-[#e91e50]">
                  {priceLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Huy hiệu dành riêng cho CTV */}
        {isCtv && effectiveCtv && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
            <Gift size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Mã CTV của bạn: {effectiveCtv}</span>
              <p className="text-emerald-700 text-[11px] mt-0.5">
                Link chia sẻ đã được tự động gắn mã giới thiệu của bạn. Khách mua qua link này sẽ tự động tính hoa hồng cho bạn!
              </p>
            </div>
          </div>
        )}

        {/* Hàng nút chia sẻ nhanh 1-chạm */}
        <div>
          <div className="grid grid-cols-4 gap-2">
            {/* 1. Sao chép link */}
            <button
              type="button"
              onClick={handleCopyOnlyUrl}
              className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50/80 p-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 hover:border-stone-300 transition active:scale-95"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-xs group-hover:scale-105 transition-transform ${
                  copiedUrl ? "bg-emerald-600" : "bg-[var(--aloha-green,#2D5A27)]"
                }`}
              >
                {copiedUrl ? <Check size={17} /> : <Link2 size={17} />}
              </div>
              <span className="truncate max-w-full">{copiedUrl ? "Đã chép" : "Chép link"}</span>
            </button>

            {/* 2. Zalo */}
            <button
              type="button"
              onClick={handleZaloShare}
              className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-2.5 text-xs font-semibold text-blue-900 hover:bg-blue-100 hover:border-blue-200 transition active:scale-95"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0068FF] text-white shadow-xs group-hover:scale-105 transition-transform">
                <span className="font-black text-xs tracking-tighter">Zalo</span>
              </div>
              <span className="truncate max-w-full">Zalo</span>
            </button>

            {/* 3. Facebook (Thông minh: Auto nếu có tiện ích) */}
            <button
              type="button"
              onClick={handleFacebookShare}
              className="relative group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-2.5 text-xs font-semibold text-blue-900 hover:bg-blue-100 hover:border-blue-200 transition active:scale-95"
            >
              {hasExtension && (
                <span className="absolute -top-1.5 -right-1 flex h-4 items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 text-[9px] font-bold text-white shadow-xs">
                  ⚡ Auto
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span className="truncate max-w-full">Facebook</span>
            </button>

            {/* 4. Mã QR */}
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition active:scale-95 ${
                showQr
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-stone-200 bg-stone-50/80 text-stone-800 hover:bg-stone-100"
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-800 text-white shadow-xs group-hover:scale-105 transition-transform">
                <QrCode size={18} />
              </div>
              <span className="truncate max-w-full">{showQr ? "Ẩn QR" : "Mã QR"}</span>
            </button>
          </div>
        </div>

        {/* Gợi ý cài tiện ích nhẹ nhàng cho máy tính nếu chưa có */}
        {!hasExtension && !isMobile && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-xs">
            <span className="text-[11px] text-emerald-900 flex items-center gap-1.5 min-w-0 truncate">
              <Sparkles size={13} className="text-emerald-600 shrink-0" />
              Tự động nạp cả ảnh & video vào Facebook?
            </span>
            <button
              type="button"
              onClick={() => setShowExtensionGuide(true)}
              className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0"
            >
              Cài tiện ích Aloha (30s) &rarr;
            </button>
          </div>
        )}

        {/* Khung hiển thị Mã QR khi bật */}
        {showQr && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/90 bg-stone-50 p-4 text-center animate-in fade-in duration-200">
            <div className="rounded-xl bg-white p-3 shadow-xs border border-stone-100">
              <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />
            </div>
            <p className="mt-2.5 text-xs font-bold text-stone-800">
              Quét mã để xem và chia sẻ từ điện thoại
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5 max-w-xs">
              📱 Dùng điện thoại quét mã QR để mở sản phẩm — sau đó bấm chia sẻ để tự động nạp toàn bộ ảnh & video vào App Facebook/Zalo!
            </p>
          </div>
        )}

        {/* Bộ công cụ Media: Tải ảnh & video thực tế */}
        {media.length > 0 && (
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-stone-800">
                  Ảnh & video thực tế của sản phẩm
                </p>
                <p className="text-[11px] text-stone-500">
                  Đã chọn {pickedItems.length}/{Math.min(MAX_PICK, media.length)} file để tải
                </p>
              </div>
              <button
                type="button"
                onClick={saveMedia}
                disabled={downloading || pickedItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--aloha-green,#2D5A27)] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:opacity-90 active:scale-95 disabled:opacity-40 transition"
              >
                {downloading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>{downloading ? "Đang tải…" : "Lưu ảnh & video"}</span>
              </button>
            </div>

            <ul className="flex gap-2 overflow-x-auto pb-1">
              {media.map((m) => {
                const on = picked.includes(m.src);
                return (
                  <li key={m.src} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => toggle(m.src)}
                      aria-pressed={on}
                      className={`relative h-16 w-16 overflow-hidden rounded-xl bg-stone-100 ring-2 transition active:scale-95 ${
                        on ? "ring-[var(--aloha-green,#2D5A27)]" : "ring-transparent opacity-70"
                      }`}
                    >
                      {m.kind === "video" ? (
                        poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={poster} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <video src={m.src} muted playsInline className="h-full w-full object-cover" />
                        )
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.src} alt="" className="h-full w-full object-cover" />
                      )}
                      {m.kind === "video" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <Play size={16} className="fill-white text-white" />
                        </span>
                      )}
                      <span
                        className={`absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white ring-1 ring-white ${
                          on ? "bg-[var(--aloha-green,#2D5A27)]" : "bg-black/35"
                        }`}
                      >
                        {on && <Check size={10} strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Lời giới thiệu soạn sẵn (Caption Editor) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              Bài viết giới thiệu
            </span>
            <div className="flex items-center gap-3">
              {editedCaption !== null && (
                <button
                  type="button"
                  onClick={() => setEditedCaption(null)}
                  disabled={captionLoading}
                  className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 hover:underline transition"
                >
                  Khôi phục
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCaption}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--aloha-green,#2D5A27)] hover:underline"
              >
                {copiedCaption ? <Check size={12} /> : <Copy size={12} />}
                {copiedCaption ? "Đã sao chép" : "Sao chép bài viết"}
              </button>
            </div>
          </div>
          <ShareCaptionEditor
            value={caption}
            onChange={setEditedCaption}
            onReset={() => setEditedCaption(null)}
            loading={captionLoading}
            hideHeader={true}
          />
          {captionError && (
            <p role="status" className="text-xs text-amber-700">
              Chưa tải được giá hiện tại. Nội dung chia sẻ chỉ giữ tên và link để khách xem giá trên shop.
            </p>
          )}
        </div>
      </div>

      {showExtensionGuide && (
        <ProductExtensionGuideModal
          onClose={() => setShowExtensionGuide(false)}
          onCheckAgain={() => {
            if (document.documentElement.getAttribute("data-aloha-extension-installed") === "true") {
              setHasExtension(true);
              toast.push("🎉 Tuyệt vời! Tiện ích Aloha Auto Share đã kết nối thành công!");
            } else {
              toast.push("Chưa tìm thấy tiện ích. Hãy kiểm tra bạn đã bật Developer Mode và tải thư mục tiện ích chưa nhé!");
            }
          }}
        />
      )}
    </dialog>
  );
}
