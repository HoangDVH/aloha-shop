"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  ShoppingBag,
  Check,
  ChevronRight,
  Gift,
  Ticket,
} from "lucide-react";
import type {
  CampaignVoucherUI,
  CampaignViewerUI,
  CampaignUI,
} from "@/lib/campaign/campaignApi";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { formatCompactVnd, pctText, shipSupportText, sortVouchersGrouped, voucherUseHref, withDrawn } from "@/lib/voucherFormat";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { claimStateOf } from "@/components/voucher/ClaimButton";
import { ClaimSuccessModal } from "@/components/voucher/ClaimSuccessModal";

function vnDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getVoucherDisplay(v: CampaignVoucherUI) {
  let primary = "";
  if (v.benefitType === "shipping") {
    primary = shipSupportText(v);
  } else if (v.discountType === "fixed") {
    primary = `Giảm ${formatCompactVnd(v.discountValue).toUpperCase()} đ`;
  } else if (v.discountType === "percentage") {
    primary = `Giảm ${pctText(v)}`;
    if (v.maxDiscountVnd && v.maxDiscountVnd > 0) {
      primary += ` (Tối đa ${formatCompactVnd(v.maxDiscountVnd).toUpperCase()})`;
    }
  } else {
    primary = v.title || "Voucher ưu đãi";
  }

  let condition = "";
  if (!v.minOrderThreshold || v.minOrderThreshold <= 0) {
    condition = "Không mức chi tiêu tối thiểu";
  } else {
    condition = `Đơn tối thiểu ${formatCompactVnd(v.minOrderThreshold).toUpperCase()}`;
  }

  const title = v.title?.trim();
  if (title && !v.mystery?.drawnPercent) {
    const cap =
      v.benefitType !== "shipping" && v.discountType === "percentage" && v.maxDiscountVnd && v.maxDiscountVnd > 0
        ? `Tối đa ${formatCompactVnd(v.maxDiscountVnd).toUpperCase()} · `
        : "";
    return { primary: title, condition: `${cap}${condition}` };
  }
  return { primary, condition };
}

export function HeaderVoucherModal({
  open,
  onClose,
  campaign,
  vouchers,
  viewer,
  offsetMs,
  headerPillText,
}: {
  open: boolean;
  onClose: () => void;
  campaign?: CampaignUI | null;
  vouchers: CampaignVoucherUI[];
  viewer: CampaignViewerUI | null;
  offsetMs: number;
  headerPillText?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const claims = useVoucherClaims();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Khoá cuộn body và lắng nghe phím ESC khi mở Modal
  useEffect(() => {
    if (!open) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const drawnKey = JSON.stringify(claims.drawn);
  const visibleVouchers = useMemo(() => {
    const drawn = JSON.parse(drawnKey) as Record<string, number>;
    const list = vouchers
      .filter((v) => viewer?.newBuyer !== false || v.targetCustomer !== "new_web")
      .map((v) => withDrawn(v, drawn));
    return sortVouchersGrouped(list);
  }, [vouchers, viewer, drawnKey]);
  const justClaimed = claims.claimedVoucherId
    ? visibleVouchers.find((v) => v.id === claims.claimedVoucherId) ?? null
    : null;

  const nowMs = Date.now() + offsetMs;

  // Đếm số lượng voucher có thể bấm lưu
  const claimableCount = useMemo(() => {
    return visibleVouchers.filter(
      (v) => claimStateOf(v, viewer, claims.claimedIds.has(v.id), nowMs) === "claimable"
    ).length;
  }, [visibleVouchers, viewer, claims.claimedIds, nowMs]);

  if (!mounted || !open) return null;

  const handleMainAction = () => {
    if (claimableCount > 0) {
      claims.collectAll();
      return;
    }
    onClose();
    if (visibleVouchers.length > 0) router.push("/tim");
  };

  const openVoucherProducts = (id: string) => {
    onClose();
    router.push(voucherUseHref(id));
  };

  let mainButtonLabel = "Nhận hết";
  if (claims.collecting) {
    mainButtonLabel = "Đang lưu...";
  } else if (claimableCount === 0 && visibleVouchers.length > 0) {
    mainButtonLabel = "Dùng ngay";
  }

  const content = (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tiktok-voucher-title"
    >
      {/* KHỐI POPUP PHONG CÁCH TIKTOK SHOP */}
      <div
        className="relative flex flex-col w-full max-w-[340px] sm:max-w-[360px] rounded-[30px] shadow-2xl shadow-rose-950/40 animate-in zoom-in-95 duration-200 bg-gradient-to-b from-[#FF4D6D] via-[#FE2C55] to-[#FF4767]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng nhỏ góc trên phải (dành cho desktop / tiện tay) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-black/20 hover:text-white transition"
          aria-label="Đóng popup"
        >
          <X size={16} strokeWidth={2.4} />
        </button>

        {/* 1. MÁI HIÊN CỬA HÀNG (CANOPY / AWNING) VỚI LOGO SHOP Ở CHÍNH GIỮA */}
        <div className="relative w-full pt-6 select-none">
          {/* Badge logo tròn ALOHA nằm chính giữa phía trên mái hiên */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md border-[2.5px] border-[#FE2C55] ring-4 ring-white/25">
            <span className="text-[12px] font-black text-[#FE2C55] tracking-wider uppercase">
              ALOHA
            </span>
          </div>

          {/* SVG Mái hiên sọc đỏ - trắng uốn lượn có viền răng cưa (scallops) */}
          <div className="w-full overflow-hidden">
            <svg
              className="w-full h-11 block drop-shadow-sm"
              viewBox="0 0 360 44"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* 6 múi vòm mái hiên đan xen Trắng và Đỏ hồng */}
              <path d="M0,0 L60,0 L60,26 Q30,42 0,26 Z" fill="#FFFFFF" />
              <path d="M60,0 L120,0 L120,26 Q90,42 60,26 Z" fill="#FE2C55" />
              <path d="M120,0 L180,0 L180,26 Q150,42 120,26 Z" fill="#FFFFFF" />
              <path d="M180,0 L240,0 L240,26 Q210,42 180,26 Z" fill="#FE2C55" />
              <path d="M240,0 L300,0 L300,26 Q270,42 240,26 Z" fill="#FFFFFF" />
              <path d="M300,0 L360,0 L360,26 Q330,42 300,26 Z" fill="#FE2C55" />
              {/* Bóng mờ chân viền mái hiên */}
              <path
                d="M0,26 Q30,42 60,26 Q90,42 120,26 Q150,42 180,26 Q210,42 240,26 Q270,42 300,26 Q330,42 360,26"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="2.5"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* 2. CÁC HỌA TIẾT TRANG TRÍ BAY BỔNG (STARS & FLOATING TICKETS NHƯ TIKTOK) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          {/* Ngôi sao vàng góc trái trên */}
          <span className="absolute left-2.5 top-28 text-amber-300 text-xl drop-shadow-md animate-pulse">
            ⭐
          </span>
          {/* Vé coupon mini hồng xoay nghiêng bên phải trên */}
          <div className="absolute -right-1 top-20 rotate-12 flex items-center gap-0.5 rounded-sm bg-gradient-to-r from-pink-300 to-rose-400 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
            <span>%</span>
          </div>
          {/* Vé coupon mini xanh ngọc xoay nghiêng bên phải dưới */}
          <div className="absolute -right-1.5 bottom-28 -rotate-12 flex items-center gap-0.5 rounded-sm bg-gradient-to-r from-cyan-300 to-teal-400 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
            <span>%</span>
          </div>
          {/* Ngôi sao lấp lánh góc trái dưới */}
          <span className="absolute left-3 bottom-36 text-amber-300 text-base drop-shadow-sm">
            ✨
          </span>
        </div>

        {/* 3. TIÊU ĐỀ POPUP (CHUẨN TIKTOK SHOP: "Tiết kiệm với voucher" + "Ưu đãi độc quyền từ người bán") */}
        <div className="relative px-5 pt-1.5 pb-3 text-center">
          <h3
            id="tiktok-voucher-title"
            className="text-lg sm:text-[20px] font-black text-white tracking-tight drop-shadow-xs"
          >
            Tiết kiệm với voucher
          </h3>
          <p className="mt-0.5 text-xs sm:text-[13px] font-medium text-white/95">
            Ưu đãi độc quyền từ người bán
          </p>
        </div>

        {/* 4. DANH SÁCH VOUCHER (CÁC VÉ TRẮNG BO GÓC CÓ VẾT CẮT KHUYẾT HAI BÊN NHƯ TIKTOK) */}
        <div className="relative px-4 pb-3 max-h-[50vh] overflow-y-auto space-y-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-contain">
          {visibleVouchers.length === 0 ? (
            <div className="rounded-2xl bg-white/95 p-6 text-center text-slate-500 shadow-sm">
              <ShoppingBag size={32} className="mx-auto text-rose-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Hiện chưa có voucher mới</p>
              <p className="text-xs text-slate-400 mt-0.5">Vui lòng quay lại sau bạn nhé!</p>
            </div>
          ) : (
            visibleVouchers.map((v) => {
              const state = claimStateOf(v, viewer, claims.claimedIds.has(v.id), nowMs);
              const { primary, condition } = getVoucherDisplay(v);
              const isClaimable = state === "claimable";
              const isUsable = state === "claimed" || state === "auto";

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    if (isClaimable) claims.claim(v.id);
                    else if (isUsable) openVoucherProducts(v.id);
                  }}
                  className={`group relative rounded-2xl bg-white px-4 py-3 sm:py-3.5 text-center shadow-md border border-rose-100/70 transition-all ${
                    isClaimable || isUsable
                      ? "cursor-pointer hover:shadow-lg active:scale-[0.98]"
                      : ""
                  }`}
                >
                  {/* Vết cắt khuyết tròn hai bên vé (notches) tạo hiệu ứng vé coupon chuẩn TikTok */}
                  <span
                    className="absolute -left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[#FE2C55] shadow-inner"
                    aria-hidden="true"
                  />
                  <span
                    className="absolute -right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[#FE2C55] shadow-inner"
                    aria-hidden="true"
                  />

                  {/* Dòng 1: Mức giảm in đậm nổi bật màu đỏ rực */}
                  <h4 className="text-lg sm:text-[21px] font-black leading-tight text-[#FE2C55] tracking-tight">
                    {primary}
                  </h4>

                  {/* Dòng 2: Điều kiện chi tiêu tối thiểu */}
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {condition}
                  </p>

                  {/* Dòng 3: Điều khoản / Trạng thái */}
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                    {state === "claimed" ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check size={11} strokeWidth={2.8} />
                        <span>Đã lưu vào ví</span>
                      </span>
                    ) : state === "auto" ? (
                      <span className="inline-flex items-center gap-1 font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        <Sparkles size={11} />
                        <span>Tự động áp dụng</span>
                      </span>
                    ) : v.mystery && isClaimable ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Gift size={11} />
                        <span>Bấm để bóc túi mù · tới {v.mystery.max}%</span>
                      </span>
                    ) : (
                      <span>
                        Có áp dụng điều khoản
                        {v.endDate ? ` · HSD: ${vnDate(v.endDate)}` : ""}
                      </span>
                    )}
                    {isUsable ? <span className="font-bold text-[#FE2C55]">Dùng ngay ›</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 5. PHẦN ĐÁY MODAL: NỀN TRẮNG CHỨA NÚT "NHẬN HẾT" RỰC RỠ */}
        <div className="bg-white rounded-b-[30px] p-4 pt-3.5 border-t border-rose-100/40">
          <button
            type="button"
            onClick={handleMainAction}
            disabled={claims.collecting}
            className="w-full py-3 sm:py-3.5 rounded-full font-black text-sm sm:text-base text-white bg-gradient-to-r from-[#FF244D] via-[#FE2C55] to-[#FA1945] hover:brightness-105 active:scale-98 transition shadow-lg shadow-rose-600/35 flex items-center justify-center gap-1.5 disabled:opacity-75"
          >
            {claims.collecting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" />
            ) : null}
            <span>{mainButtonLabel}</span>
          </button>

          {/* Link phụ xem thể lệ chi tiết */}
          <Link
            href="/uu-dai?tab=voucher"
            onClick={onClose}
            className="mt-2.5 flex items-center justify-center gap-1 text-[11.5px] font-semibold text-slate-400 hover:text-[#FE2C55] transition"
          >
            <span>Xem tất cả ưu đãi & thể lệ</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* 6. NÚT ĐÓNG TRÒN NẰM DƯỚI ĐÁY ĐÚNG CHUẨN TIKTOK SHOP */}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/75 bg-black/40 text-white/90 hover:bg-black/60 hover:text-white hover:scale-105 active:scale-95 transition shadow-lg cursor-pointer"
        aria-label="Đóng popup voucher"
      >
        <X size={20} strokeWidth={2.4} />
      </button>

      {/* Bảng đăng nhập tự động kích hoạt nếu người dùng chưa đăng nhập khi bấm "Nhận hết" */}
      <LoginSheet
        open={claims.loginOpen}
        onClose={claims.cancelLogin}
        onDone={claims.loginDone}
      />
      {justClaimed?.mystery ? (
        <ClaimSuccessModal
          voucher={justClaimed}
          open
          onClose={claims.clearClaimedVoucherId}
          onShopNow={onClose}
        />
      ) : null}
    </div>
  );

  return createPortal(content, document.body);
}
