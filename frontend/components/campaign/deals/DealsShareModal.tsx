"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Gift,
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
import { copyText } from "@/lib/shareMedia";
import { SHOP_ORIGIN } from "@/lib/seo";

export function DealsShareModal({
  campaign,
  onClose,
}: {
  campaign?: CampaignUI | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const { user } = useShopAuth();

  const [copied, setCopied] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // CHỈ coi là CTV khi tài khoản đang đăng nhập có quyền CTV thực thụ:
  const isCtv = Boolean(user?.roles?.includes("ctv") && user?.ctvCode);
  const ctvCode = isCtv && user?.ctvCode ? normalizeCtvCode(user.ctvCode) : "";

  // Tạo URL chia sẻ: Gắn mã CTV (khi người dùng thực sự là CTV) hoặc dùng link chuẩn canonical không kèm query params
  // để tránh phân mảnh cache Open Graph trên Facebook/Zalo
  const shareUrl = useMemo(() => {
    try {
      const u = new URL("/uu-dai", SHOP_ORIGIN);
      if (ctvCode) {
        u.searchParams.set("ctv", ctvCode);
      }
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

  const defaultCaption = `🔥 ${campaignTitle.toUpperCase()} TẠI ALOHA!
${campaignSubtitle}

👉 Vào săn voucher và mua sắm ngay tại:
${shareUrl}`;

  // Kiểm tra thiết bị có hỗ trợ Web Share API chuẩn không (Mobile iOS Safari, Android Chrome,...)
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  // Khóa cuộn trang khi mở modal
  useEffect(() => {
    const el = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

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

  // Native Web Share API
  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: campaignTitle,
          text: campaignSubtitle,
          url: shareUrl,
        });
      } catch (err: unknown) {
        // Người dùng hủy chia sẻ (AbortError) thì không báo lỗi
        if (err instanceof Error && err.name !== "AbortError") {
          toast.push("Không thể mở menu chia sẻ của thiết bị.");
        }
      }
    }
  };

  // Chia sẻ Zalo - mở trực tiếp không await để trình duyệt không chặn pop-up
  const handleZaloShare = () => {
    void copyText(defaultCaption);
    window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
    toast.push("Đã sao chép nội dung & mở Zalo — dán vào tin nhắn để gửi ngay!");
  };

  // Chia sẻ Facebook - mở trực tiếp không await để trình duyệt không chặn pop-up
  const handleFacebookShare = () => {
    void copyText(defaultCaption);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer,width=640,height=600"
    );
    toast.push("Đã mở Facebook & sao chép nội dung bài đăng!");
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
        {/* Thẻ xem trước (Preview Card) chuẩn Open Graph — Tỉ lệ 8:3 hiển thị trọn vẹn 100% banner */}
        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-50 shadow-xs">
          <div className="relative aspect-[8/3] w-full bg-stone-100 overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerImage}
              alt={campaignTitle}
              className="h-full w-full object-contain sm:object-cover"
              onError={(e) => {
                // Fallback nếu ảnh không tải được
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
          <p className="text-xs font-semibold text-stone-700 mb-2">Chia sẻ nhanh qua</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Zalo */}
            <button
              type="button"
              onClick={handleZaloShare}
              className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs font-semibold text-blue-900 hover:bg-blue-100 hover:border-blue-200 transition active:scale-95"
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
              className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs font-semibold text-blue-900 hover:bg-blue-100 hover:border-blue-200 transition active:scale-95"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span>Facebook</span>
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

            {/* Native Web Share nếu thiết bị hỗ trợ */}
            {canShare ? (
              <button
                type="button"
                onClick={handleNativeShare}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50/80 p-3 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition active:scale-95"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-700 text-white shadow-xs group-hover:scale-105 transition-transform">
                  <ExternalLink size={17} />
                </div>
                <span>Thêm...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyCaption}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50/80 p-3 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition active:scale-95"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                  <Sparkles size={17} />
                </div>
                <span>Lời nhắn</span>
              </button>
            )}
          </div>
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
    </dialog>
  );
}
