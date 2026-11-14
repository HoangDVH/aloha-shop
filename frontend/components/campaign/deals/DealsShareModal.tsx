"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Gift,
  Loader2,
  QrCode,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { QRCodeSVG } from "@rc-component/qrcode";
import type { CampaignUI } from "@/lib/campaign/campaignApi";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useToast } from "@/components/Toast";
import { normalizeCtvCode } from "@/lib/ctv";
import {
  canShareFilesOnDevice,
  copyText,
  downloadFile,
  isMobileBrowser,
  loadShareFile,
} from "@/lib/shareMedia";
import { productShareData } from "@/lib/productShareData";
import { absUrl, SHOP_ORIGIN, shortHash } from "@/lib/seo";
import { ProductExtensionGuideModal } from "@/components/pdp/ProductExtensionGuideModal";

export function DealsShareModal({
  campaign,
  onClose,
}: {
  campaign?: CampaignUI | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cachedFile = useRef<File | null>(null);
  const toast = useToast();
  const { user } = useShopAuth();

  const [copied, setCopied] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deviceShare, setDeviceShare] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // CHỈ coi là CTV khi tài khoản đang đăng nhập có quyền CTV thực thụ:
  const isCtv = Boolean(user?.roles?.includes("ctv") && user?.ctvCode);
  const ctvCode = isCtv && user?.ctvCode ? normalizeCtvCode(user.ctvCode) : "";

  // Tạo URL chia sẻ: gắn mã CTV khi đủ điều kiện, còn lại dùng URL canonical để gom cache OG
  const shareUrl = useMemo(() => {
    try {
      const u = new URL("/uu-dai", SHOP_ORIGIN);
      if (ctvCode) u.searchParams.set("ctv", ctvCode);
      return u.toString();
    } catch {
      return `${SHOP_ORIGIN}/uu-dai`;
    }
  }, [ctvCode]);

  const campaignTitle = campaign?.display?.hero?.title || campaign?.name || "Đại Tiệc Ưu Đãi & Voucher Giảm Giá";
  const campaignSubtitle =
    campaign?.display?.hero?.subtitle ||
    "Săn ngay hàng trăm voucher giảm sâu, quà tặng 0Đ và deal cây cảnh chậu kiểng đang diễn ra tại ALOHA!";
  const shareBanner = campaign?.display?.banners?.find((b) => (b.kind as string) === "share" && b.imageUrl)?.imageUrl;
  const bannerImage =
    shareBanner ||
    campaign?.display?.banners?.find((b) => b.kind === "main" && b.imageUrl)?.imageUrl ||
    "/banners/banner-1010-desktop.webp";

  // Ưu tiên ảnh PNG/JPG gốc độ nét cao cho Photo Post & tải về; fallback /og/uu-dai.jpg 1200x630 nếu ảnh cũ là WebP
  const hdShareImageUrl = useMemo(() => {
    const trimmed = String(bannerImage || "").trim();
    if (!trimmed) return "";
    if (/\.(png|jpe?g)(\?|$)/i.test(trimmed)) return absUrl(trimmed);
    const u = new URL("/og/uu-dai.jpg", SHOP_ORIGIN);
    if (campaign?.id) u.searchParams.set("cid", campaign.id);
    u.searchParams.set("v", shortHash(`${trimmed}_og1200_v3`));
    return u.toString();
  }, [bannerImage, campaign?.id]);

  const defaultCaption = `🔥 ${campaignTitle.toUpperCase()} TẠI ALOHA!
${campaignSubtitle}

👉 Vào săn voucher và mua sắm ngay tại:
${shareUrl}`;

  useEffect(() => {
    cachedFile.current = null;
  }, [hdShareImageUrl]);

  // Phát hiện Web Share API & Chrome Extension nạp ảnh Facebook 1-click
  useEffect(() => {
    const el = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();

    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
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
      el?.close();
      document.body.style.overflow = overflow;
      window.removeEventListener("aloha-extension-ready", handleReady);
      clearTimeout(extTimer);
    };
  }, []);

  const loadBannerFile = async (): Promise<File | null> => {
    if (!hdShareImageUrl) return null;
    if (cachedFile.current) return cachedFile.current;
    try {
      const baseName = `aloha-uu-dai-${shortHash(hdShareImageUrl)}`;
      const file = await loadShareFile({ src: hdShareImageUrl, kind: "image" }, baseName);
      cachedFile.current = file;
      return file;
    } catch {
      return null;
    }
  };

  // Sao chép link 1-click
  const handleCopyLink = async () => {
    const ok = await copyText(shareUrl);
    if (ok) {
      setCopied(true);
      toast.push("Đã sao chép liên kết ưu đãi vào bộ nhớ tạm!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.push("Không thể sao chép liên kết. Hãy thử chọn liên kết thủ công.");
    }
  };

  // Sao chép lời giới thiệu soạn sẵn
  const handleCopyCaption = async () => {
    const ok = await copyText(defaultCaption);
    if (ok) {
      setCopiedCaption(true);
      toast.push("Đã sao chép bài đăng giới thiệu kèm link!");
      setTimeout(() => setCopiedCaption(false), 2500);
    } else {
      toast.push("Không thể sao chép bài đăng.");
    }
  };

  // Native Web Share API kèm File ảnh độ nét cao trên mobile để đăng Photo Post thay vì Link Card mờ
  const shareNativeWithFile = async (target: "facebook" | "zalo" | "system") => {
    try {
      setDownloading(true);
      const file = await loadBannerFile();
      setDownloading(false);
      await copyText(defaultCaption);

      const files = file ? [file] : [];
      const data =
        files.length > 0 && target !== "system"
          ? productShareData({
              selectedCount: files.length,
              files,
              target,
              title: campaignTitle,
              caption: defaultCaption,
              url: shareUrl,
              canShare: (d) => Boolean(navigator.canShare?.(d)),
            })
          : {
              title: campaignTitle,
              text: defaultCaption,
              url: shareUrl,
              ...(files.length > 0 && navigator.canShare?.({ files }) ? { files } : {}),
            };

      await navigator.share(data);
      toast.push(
        files.length > 0
          ? "Đã đính kèm ảnh ưu đãi nét cao — chạm 'Dán' lời nhắn để đăng!"
          : `Đã mở chia sẻ ${target === "zalo" ? "Zalo" : "Facebook"}.`
      );
    } catch (err: unknown) {
      setDownloading(false);
      if (err instanceof Error && err.name === "AbortError") return;
      if (target === "facebook") {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer,width=640,height=600"
        );
      } else if (target === "zalo") {
        window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
      } else {
        toast.push("Không thể mở menu chia sẻ của thiết bị.");
      }
    }
  };

  // Tự động đẩy ảnh gốc & nội dung sang Aloha Facebook Extension để đăng Photo Post nét 100%
  const handleExtensionPhotoPost = () => {
    if (!hasExtension || !hdShareImageUrl) {
      setShowExtensionGuide(true);
      return;
    }
    void copyText(defaultCaption);
    window.postMessage(
      {
        type: "ALOHA_SHARE_TO_FB_EXTENSION",
        payload: {
          name: campaignTitle,
          caption: defaultCaption,
          url: shareUrl,
          media: [{ src: hdShareImageUrl, kind: "image" }],
          images: [hdShareImageUrl],
        },
      },
      "*"
    );
    toast.push("Đang mở Facebook và tự động nạp ảnh ưu đãi độ nét cao...");
  };

  // Tải 1-click ảnh nét về máy (PNG/JPG) kèm copy sẵn caption
  const handleDownloadHdImage = async () => {
    if (downloading) return;
    setDownloading(true);
    const file = await loadBannerFile();
    setDownloading(false);
    void copyText(defaultCaption);
    if (file) {
      downloadFile(file);
      toast.push("Đã lưu ảnh ưu đãi nét & chép lời nhắn — kéo ảnh vào bài viết Facebook sẽ không bị mờ!");
    } else if (hdShareImageUrl) {
      window.open(hdShareImageUrl, "_blank", "noopener,noreferrer");
      toast.push("Đã mở ảnh gốc trong tab mới để bạn lưu về máy.");
    } else {
      toast.push("Không tìm thấy ảnh chiến dịch để tải xuống.");
    }
  };

  // Chia sẻ Zalo - mobile có file ưu tiên Web Share đính kèm ảnh; desktop mở Zalo Web không block pop-up
  const handleZaloShare = () => {
    if (isMobile && deviceShare) {
      void shareNativeWithFile("zalo");
      return;
    }
    void copyText(defaultCaption);
    window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
    toast.push("Đã sao chép nội dung & mở Zalo — dán vào tin nhắn để gửi ngay!");
  };

  // Chia sẻ Facebook - mobile đính kèm ảnh; desktop ưu tiên Aloha Extension Photo Post, fallback sharer.php
  const handleFacebookShare = () => {
    if (isMobile && deviceShare) {
      void shareNativeWithFile("facebook");
      return;
    }
    if (hasExtension && hdShareImageUrl) {
      handleExtensionPhotoPost();
      return;
    }
    void copyText(defaultCaption);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer,width=640,height=600"
    );
    toast.push("Đã mở Facebook & chép lời nhắn! Mẹo: bấm 'Lưu ảnh nét' để đăng dạng ảnh nếu muốn sắc nét nhất.");
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Chia sẻ chương trình ưu đãi"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-5 text-stone-900 shadow-2xl backdrop:bg-black/60 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {/* Tiêu đề & Nút đóng */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <Share2 size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
              Chia sẻ trang ưu đãi
            </h2>
            <p className="text-xs text-stone-500">Lan tỏa ưu đãi đến bạn bè & người thân</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Thẻ xem trước đúng tỉ lệ 1.91:1 (1200x630) nếu có ảnh chia sẻ riêng, hoặc 8:3 với banner chính */}
        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-50 shadow-xs">
          <div
            className={`relative w-full bg-stone-100 overflow-hidden flex items-center justify-center ${
              shareBanner ? "aspect-[1200/630]" : "aspect-[8/3]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerImage}
              alt={campaignTitle}
              className={shareBanner ? "h-full w-full object-cover" : "h-full w-full object-contain sm:object-cover"}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/banners/banner-1010-desktop.webp";
              }}
            />
          </div>
          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-rose-700">
                Ưu đãi ALOHA
              </span>
              <span className="text-[11px] font-semibold text-stone-500">
                alohathegioichaucay.com
              </span>
            </div>
            <h3 className="text-sm font-bold text-stone-900 line-clamp-1">
              {campaignTitle}
            </h3>
            <p className="mt-0.5 text-xs text-stone-600 line-clamp-2 leading-relaxed">
              {campaignSubtitle}
            </p>
          </div>
        </div>

        {/* Huy hiệu dành cho CTV (Affiliate Attribution) */}
        {ctvCode && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
            <Gift size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Mã CTV của bạn: {ctvCode}</span>
              <p className="text-emerald-700 text-[11px] mt-0.5">
                Link chia sẻ đã được tự động gắn mã giới thiệu của bạn. Khi khách mua qua link này, hoa hồng sẽ tự động cộng vào tài khoản của bạn!
              </p>
            </div>
          </div>
        )}

        {/* Ô sao chép liên kết 1-Click */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">
            Liên kết ưu đãi
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs active:scale-95 ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-[var(--aloha-green,#2D5A27)] hover:opacity-90 text-white"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Đã chép" : "Sao chép"}
            </button>
          </div>
        </div>

        {/* Các kênh chia sẻ nhanh (Social / Apps) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-stone-700">Chia sẻ nhanh qua</p>
            {canShare && (
              <button
                type="button"
                onClick={() => void shareNativeWithFile("system")}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900"
              >
                <ExternalLink size={12} />
                Chia sẻ khác...
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Zalo */}
            <button
              type="button"
              onClick={handleZaloShare}
              disabled={downloading}
              className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs font-semibold text-blue-900 hover:bg-blue-100 hover:border-blue-200 transition active:scale-95 disabled:opacity-60"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0068FF] text-white shadow-xs group-hover:scale-105 transition-transform">
                <span className="font-black text-xs tracking-tighter">Zalo</span>
              </div>
              <span>Zalo</span>
            </button>

            {/* Facebook */}
            <button
              type="button"
              onClick={handleFacebookShare}
              disabled={downloading}
              className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs font-semibold text-blue-900 hover:bg-blue-100 hover:border-blue-200 transition active:scale-95 disabled:opacity-60"
            >
              {(hasExtension || (isMobile && deviceShare)) && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  Nét
                </span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span>{hasExtension ? "Đăng FB" : "Facebook"}</span>
            </button>

            {/* Lưu ảnh nét (Photo Post thủ công giữ nguyên 100% độ phân giải) */}
            <button
              type="button"
              onClick={handleDownloadHdImage}
              disabled={downloading}
              className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition active:scale-95 disabled:opacity-60"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              </div>
              <span>Lưu ảnh nét</span>
            </button>

            {/* Mã QR */}
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition active:scale-95 ${
                showQr
                  ? "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-stone-200 bg-stone-50/80 text-stone-800 hover:bg-stone-100"
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-800 text-white shadow-xs group-hover:scale-105 transition-transform">
                <QrCode size={18} />
              </div>
              <span>{showQr ? "Ẩn mã QR" : "Mã QR"}</span>
            </button>
          </div>

          {!isMobile && (
            <div className="mt-2.5 flex items-start justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950">
              <p className="leading-relaxed">
                {hasExtension
                  ? "Đã bật Aloha Extension: bấm Đăng FB để tự động đính kèm ảnh gốc (tránh bị Facebook thu nhỏ làm mờ chữ như thẻ link)."
                  : "Mẹo giữ ảnh nét 100% trên Facebook: bấm Lưu ảnh nét rồi thả ảnh vào bài đăng (thay vì chỉ dán link), hoặc dùng tiện ích tự động."}
              </p>
              {!hasExtension && (
                <button
                  type="button"
                  onClick={() => setShowExtensionGuide(true)}
                  className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition"
                >
                  Đăng 1-click
                </button>
              )}
            </div>
          )}
        </div>

        {/* Khung hiển thị Mã QR khi bật */}
        {showQr && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/90 bg-stone-50 p-4 text-center animate-in fade-in duration-200">
            <div className="rounded-xl bg-white p-3 shadow-xs border border-stone-100">
              <QRCodeSVG
                value={shareUrl}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-2.5 text-xs font-bold text-stone-800">
              Quét mã để mở trang ưu đãi
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Dùng ứng dụng Zalo hoặc Camera điện thoại để quét
            </p>
          </div>
        )}

        {/* Lời giới thiệu soạn sẵn (Dành cho đăng bài / gửi tin nhắn) */}
        <div className="rounded-2xl border border-stone-200/70 bg-stone-50/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              Lời nhắn mẫu soạn sẵn
            </span>
            <button
              type="button"
              onClick={handleCopyCaption}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
            >
              {copiedCaption ? <Check size={12} /> : <Copy size={12} />}
              {copiedCaption ? "Đã sao chép" : "Sao chép lời nhắn"}
            </button>
          </div>
          <p className="text-xs text-stone-600 whitespace-pre-line leading-relaxed bg-white rounded-xl p-2.5 border border-stone-100 select-all font-mono text-[11px]">
            {defaultCaption}
          </p>
        </div>
      </div>

      {showExtensionGuide && (
        <ProductExtensionGuideModal
          onClose={() => setShowExtensionGuide(false)}
          onCheckAgain={() => {
            const ok = document.documentElement.getAttribute("data-aloha-extension-installed") === "true";
            setHasExtension(ok);
            if (ok) {
              setShowExtensionGuide(false);
              toast.push("Đã kết nối Aloha Extension! Bấm Đăng FB để tự động nạp ảnh nét.");
            } else {
              toast.push("Chưa thấy tiện ích — hãy tải lại trang (F5) sau khi bật extension.");
            }
          }}
        />
      )}
    </dialog>
  );
}
