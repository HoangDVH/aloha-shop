"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Gift, Lock, Sparkles, TicketPercent, Truck, Zap, X } from "lucide-react";
import type { CampaignVoucherUI, CampaignViewerUI } from "@/lib/campaign/campaignApi";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import {
  cleanVoucherTitle,
  formatCompactVnd,
  isUnopenedMystery,
  pctText,
  sortVouchersGrouped,
  voucherUseHref,
  withDrawn,
} from "@/lib/voucherFormat";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { claimStateOf, type ClaimState } from "@/components/voucher/ClaimButton";
import { ClaimSuccessModal } from "@/components/voucher/ClaimSuccessModal";
import { openVoucherModal } from "@/lib/campaign/useVoucherModal";

const DAY_MS = 86_400_000;
/** HSD chỉ nhắc khi sắp hết; "người đã lưu" chỉ hiện khi đủ đông để thành bằng chứng. */
const EXPIRY_HINT_MS = 3 * DAY_MS;
const SOCIAL_PROOF_MIN = 50;
const SAVED_FX_MS = 1400;

function valueOf(v: CampaignVoucherUI): { top: string; value: string; isShip: boolean } {
  const amount =
    v.discountType === "percentage" ? pctText(v) : formatCompactVnd(v.discountValue).toUpperCase();
  if (v.benefitType === "shipping") {
    return { top: "FREESHIP", value: v.discountValue > 0 ? amount : "FREE", isShip: true };
  }
  return { top: isUnopenedMystery(v) ? "TÚI MÙ" : "GIẢM", value: amount, isShip: false };
}

function voucherDetails(v: CampaignVoucherUI): { minSpend: string; cap: string } {
  const minSpend =
    v.minOrderThreshold && v.minOrderThreshold > 0
      ? `Đơn từ ${formatCompactVnd(v.minOrderThreshold).toUpperCase()}`
      : "Mọi đơn hàng";

  let cap = "";
  if (v.discountType === "percentage" && v.maxDiscountVnd && v.maxDiscountVnd > 0) {
    cap = `Tối đa ${formatCompactVnd(v.maxDiscountVnd).toUpperCase()}`;
  } else if (v.benefitType === "shipping") {
    cap = "Trừ thẳng vào ship";
  } else {
    cap = "Tất cả sản phẩm";
  }

  return { minSpend, cap };
}

function hintOf(v: CampaignVoucherUI, nowMs: number): string {
  const endMs = v.endDate ? Date.parse(v.endDate) : NaN;
  if (Number.isFinite(endMs) && endMs > nowMs && endMs - nowMs <= EXPIRY_HINT_MS) {
    const hours = Math.ceil((endMs - nowMs) / 3_600_000);
    return hours <= 24 ? `Sắp hết hạn (${hours}h)` : `Còn ${Math.ceil(hours / 24)} ngày`;
  }
  if (v.claimLimitTotal) {
    const left = Math.max(0, v.claimLimitTotal - v.claimedCount);
    if (left > 0 && left / v.claimLimitTotal <= 0.2) return `Chỉ còn ${left} lượt`;
  }
  if (v.mystery?.drawnPercent) return `Đã bóc trúng ${v.mystery.drawnPercent}%`;
  if (v.mystery) return `May mắn tới ${v.mystery.max}%`;
  if (v.claimRequired && v.claimedCount >= SOCIAL_PROOF_MIN) {
    return `${v.claimedCount.toLocaleString("vi-VN")} người đã lưu`;
  }
  return "";
}

/** Vé vừa chuyển sang "đã lưu" trong phiên này → chạy hiệu ứng lóe sáng một lần. */
function useJustSaved(claimedIds: Set<string>): Set<string> {
  const key = [...claimedIds].sort().join(",");
  const prev = useRef<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = prev.current;
    prev.current = key;
    if (before == null) return;
    const old = new Set(before ? before.split(",") : []);
    const added = (key ? key.split(",") : []).filter((id) => !old.has(id));
    if (!added.length) return;
    setFresh(new Set(added));
    const t = setTimeout(() => setFresh(new Set()), SAVED_FX_MS);
    return () => clearTimeout(t);
  }, [key]);
  return fresh;
}

const PILL = "inline-flex h-6 sm:h-[26px] shrink-0 items-center justify-center gap-1 rounded-full px-2.5 sm:px-3 text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap";

/** Nút kiểu Shopee: chưa lưu → "Lưu" (đặc); đã lưu / tự áp dụng → "Dùng ngay" (viền) tới SP áp dụng. */
function Action({
  voucherId,
  state,
  isShip,
  mystery,
  busy,
  saved,
  onClaim,
}: {
  voucherId: string;
  state: ClaimState;
  isShip: boolean;
  mystery: boolean;
  busy: boolean;
  saved: boolean;
  onClaim: () => void;
}) {
  const solid = isShip ? "bg-[#0F766E] text-white" : "bg-[var(--campaign-primary,#C8102E)] text-white";
  const outline = isShip
    ? "border border-[#0F766E] text-[#0F766E] hover:bg-teal-50"
    : "border border-[var(--campaign-primary,#C8102E)] text-[var(--campaign-primary,#C8102E)] hover:bg-rose-50";

  if (state === "claimable") {
    return (
      <button
        type="button"
        onClick={onClaim}
        disabled={busy}
        className={`${PILL} transition hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer shadow-xs ${
          mystery ? "aloha-mystery-wiggle bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white" : solid
        }`}
      >
        {mystery ? <Gift size={11} strokeWidth={2.6} aria-hidden /> : null}
        {mystery ? (busy ? "Bóc…" : "Bóc") : busy ? "Lưu…" : "Lưu"}
      </button>
    );
  }
  if (state === "claimed" || state === "auto") {
    return (
      <Link href={voucherUseHref(voucherId)} className={`${PILL} bg-white transition ${outline} ${saved ? "aloha-saved-pop" : ""}`}>
        Dùng ngay
      </Link>
    );
  }
  if (state === "upcoming") {
    return <span className={`${PILL} bg-amber-50 text-amber-700`}>Sắp mở</span>;
  }
  if (state === "soldOut") {
    return <span className={`${PILL} bg-slate-100 font-medium text-slate-400`}>Hết lượt</span>;
  }
  return (
    <span className={`${PILL} w-6 sm:w-6.5 bg-slate-100 px-0 text-slate-400`}>
      <Lock size={11} aria-hidden />
    </span>
  );
}

/** Dòng dưới của vé: thanh "Đã lưu x%" khi mã giới hạn lượt, không thì nhắc HSD / gợi ý. */
function Footnote({ v, hint, nowMs, isShip }: { v: CampaignVoucherUI; hint: string; nowMs: number; isShip: boolean }) {
  if (v.claimLimitTotal && v.claimLimitTotal > 0) {
    const pct = Math.min(100, Math.round((v.claimedCount / v.claimLimitTotal) * 100));
    return (
      <div className="min-w-0 flex-1">
        <div className="h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${isShip ? "bg-[#0F766E]" : "bg-[var(--campaign-primary,#C8102E)]"}`}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
        <p className="mt-0.5 truncate text-[9.5px] sm:text-[10px] font-semibold text-slate-500">
          {pct >= 80 ? <span className="text-[var(--campaign-primary,#C8102E)]">Sắp hết · </span> : null}
          Đã lưu {pct}%
        </p>
      </div>
    );
  }
  if (hint) {
    return (
      <p className="flex min-w-0 flex-1 items-center gap-0.5 text-[9.5px] sm:text-[10px] font-bold text-amber-600">
        <Flame size={10} className="shrink-0 fill-amber-500 text-amber-500" aria-hidden />
        <span className="truncate">{hint}</span>
      </p>
    );
  }
  const endMs = v.endDate ? Date.parse(v.endDate) : NaN;
  if (Number.isFinite(endMs) && endMs > nowMs) {
    const d = new Date(endMs);
    return (
      <p className="min-w-0 flex-1 truncate text-[9.5px] sm:text-[10px] font-medium text-slate-400">
        HSD: {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
      </p>
    );
  }
  return <span className="flex-1" />;
}

/** Mũi tên cuộn hàng vé (máy tính) — chỉ hiện khi còn vé bị khuất phía đó. */
function useRowScroll(count: number) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdge({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [count]);
  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return { ref, edge, by };
}

/**
 * Dải voucher kiểu Shopee: một hàng vé ngang cùng cỡ (vuốt / mũi tên), cuống màu theo loại mã,
 * điều kiện mỗi ý một dòng, thanh "Đã lưu %" + nút Lưu → Dùng ngay.
 */
function tikTokDiscountText(v: CampaignVoucherUI): string {
  if (v.discountType === "percentage") {
    return `Giảm ${pctText(v)}`;
  }
  return `Giảm ${formatCompactVnd(v.discountValue).toUpperCase()}`;
}

function tikTokMinOrderText(v: CampaignVoucherUI): string {
  if (v.minOrderThreshold && v.minOrderThreshold > 0) {
    return `Đơn từ ${formatCompactVnd(v.minOrderThreshold).toUpperCase()}`;
  }
  return "Đơn từ 0đ";
}

function TikTokLargeVoucherCard({
  v,
  state,
  claims,
}: {
  v: CampaignVoucherUI;
  state: ClaimState;
  claims: ReturnType<typeof useVoucherClaims>;
}) {
  const isShip = v.benefitType === "shipping";
  const isClaimed = state === "claimed" || state === "auto";
  const discountText = tikTokDiscountText(v);
  const minOrderText = tikTokMinOrderText(v);
  const title = cleanVoucherTitle(v);

  return (
    <div
      className={`relative flex min-h-[100px] w-full overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs ${
        state === "soldOut" ? "opacity-60" : ""
      }`}
    >
      {/* Cuống trái to */}
      <div
        className={`flex w-[76px] shrink-0 flex-col items-center justify-center p-2 border-r border-dashed ${
          isShip
            ? "bg-[#E6F8F6] text-[#00B5A5] border-[#B2EBE6]"
            : "bg-[#FFF0F2] text-[#FE2C55] border-[#FDD3D9]"
        }`}
      >
        {isShip ? (
          <Truck size={22} strokeWidth={2.2} />
        ) : (
          <TicketPercent size={22} strokeWidth={2.2} />
        )}
        <span className="mt-1 text-[10.5px] font-bold leading-tight">
          {isShip ? "Vận chuyển" : "Sản phẩm"}
        </span>
      </div>

      {/* Vết khuyết bán nguyệt (Notches) */}
      <span className="pointer-events-none absolute -top-1.5 left-[76px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200" />
      <span className="pointer-events-none absolute -bottom-1.5 left-[76px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200" />

      {/* Thân thẻ */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5 pl-3.5 relative">
        {/* Góc trên phải: x4 badge nếu có */}
        {v.claimLimitTotal && v.claimLimitTotal > 1 ? (
          <span
            className={`absolute right-2.5 top-2 rounded-xs px-1 text-[9px] font-black text-white ${
              isShip ? "bg-[#00B5A5]" : "bg-[#FE2C55]"
            }`}
          >
            x{v.claimLimitTotal}
          </span>
        ) : null}

        {/* Header tag */}
        <div className="flex items-center gap-1.5 pr-8">
          {isShip ? (
            <span className="rounded-xs bg-[#00B5A5] px-1 py-0.5 text-[8.5px] font-black uppercase text-white leading-none">
              XTRA
            </span>
          ) : (
            <span className="rounded-xs border border-rose-300 bg-rose-50/80 px-1 py-0.5 text-[8.5px] font-bold text-[#FE2C55] leading-none">
              Quy đổi giới hạn
            </span>
          )}
          <span className="text-[10.5px] font-medium text-slate-500">
            Từ Aloha Shop
          </span>
        </div>

        {/* Khối tiêu đề voucher + giá trị + nút */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* TIÊU ĐỀ VOUCHER */}
            <h4 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-1" title={v.title || title}>
              {title}
            </h4>

            {/* MỨC GIẢM & ĐIỀU KIỆN */}
            <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
              <span
                className={`text-[15px] font-black leading-tight shrink-0 ${
                  isShip ? "text-[#008A7E]" : "text-[#FE2C55]"
                }`}
              >
                {discountText}
              </span>
              <span className="text-[11px] text-slate-600 font-medium leading-tight">
                · {minOrderText}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
              Cho sản phẩm đủ điều kiện
            </p>
          </div>

          <div className="shrink-0">
            {isClaimed ? (
              <Link
                href={voucherUseHref(v.id)}
                className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold border transition ${
                  isShip
                    ? "border-[#00B5A5] text-[#00B5A5] bg-cyan-50/40"
                    : "border-[#FE2C55] text-[#FE2C55] bg-rose-50/40"
                }`}
              >
                Dùng ngay
              </Link>
            ) : (
              <button
                type="button"
                disabled={claims.pendingId === v.id || state === "soldOut"}
                onClick={() => claims.claim(v.id)}
                className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95 disabled:opacity-50 transition cursor-pointer ${
                  isShip ? "bg-[#00B5A5] hover:bg-[#009E90]" : "bg-[#FE2C55] hover:bg-[#E01E43]"
                }`}
              >
                {claims.pendingId === v.id ? "…" : "Nhận"}
              </button>
            )}
          </div>
        </div>

        {/* Chú thích đáy */}
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
          <span>Áp dụng khi mua hàng tại Aloha</span>
          <span className="text-slate-500 hover:text-slate-700 cursor-pointer">
            Điều khoản & điều kiện
          </span>
        </div>
      </div>
    </div>
  );
}

function TikTokMobileVoucherStrip({
  vouchers,
  claims,
  states,
}: {
  vouchers: CampaignVoucherUI[];
  claims: ReturnType<typeof useVoucherClaims>;
  states: Map<string, ClaimState>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const shippingVouchers = vouchers.filter((v) => v.benefitType === "shipping");
  const sellerVouchers = vouchers.filter((v) => v.benefitType !== "shipping");

  return (
    <div id="kho-voucher-mobile" className="space-y-2 rounded-2xl bg-white p-3 shadow-2xs border border-rose-100/70">
      {/* 1. Header: Voucher & khuyến mãi > (Mở popup voucher) */}
      <div
        onClick={() => openVoucherModal()}
        className="flex items-center justify-between py-1 px-1 cursor-pointer select-none active:opacity-75 transition-opacity"
      >
        <h3 className="text-[15px] font-black tracking-tight text-slate-900">
          Voucher & khuyến mãi
        </h3>
        <div className="flex items-center text-slate-400 hover:text-slate-700">
          <ChevronRight size={18} strokeWidth={2.2} />
        </div>
      </div>

      {/* 2. Dải cuộn ngang voucher cards chuẩn TikTok Shop (Ảnh 1) */}
      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {vouchers.map((v) => {
          const isShip = v.benefitType === "shipping";
          const state = states.get(v.id) as ClaimState;
          const isClaimed = state === "claimed" || state === "auto";
          const discountText = tikTokDiscountText(v);
          const minOrderText = tikTokMinOrderText(v);
          const title = cleanVoucherTitle(v);
          const isMystery = Boolean(v.mystery);

          return (
            <div
              key={v.id}
              className="relative flex min-h-[74px] w-[275px] shrink-0 overflow-hidden rounded-xl bg-white border border-stone-200/90 shadow-2xs select-none"
            >
              {/* Cuống vé bên trái - Tối ưu 54px chuẩn gọn TikTok/Shopee */}
              <div
                className={`flex w-[54px] shrink-0 flex-col items-center justify-center p-1 border-r border-dashed ${
                  isShip
                    ? "bg-[#E6F8F6] text-[#00B5A5] border-[#B2EBE6]"
                    : "bg-[#FFF0F2] text-[#FE2C55] border-[#FDD3D9]"
                }`}
              >
                {isShip ? (
                  <Truck size={19} strokeWidth={2.2} />
                ) : isMystery ? (
                  <Zap size={19} className="fill-current" strokeWidth={0} />
                ) : (
                  <TicketPercent size={19} strokeWidth={2.2} />
                )}
                <span className="mt-1 text-[9.5px] font-bold leading-none text-center">
                  {isShip ? "Vận chuyển" : isMystery ? "Túi mù" : "Sản phẩm"}
                </span>
              </div>

              {/* Vết khuyết bán nguyệt (Notches) */}
              <span className="pointer-events-none absolute -top-1.5 left-[54px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200/90" />
              <span className="pointer-events-none absolute -bottom-1.5 left-[54px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200/90" />

              {/* Thân vé bên phải */}
              <div className="flex min-w-0 flex-1 flex-col justify-between py-1.5 pl-2.5 pr-2">
                {/* HÀNG 1: TIÊU ĐỀ VOUCHER (Trải rộng 100% thân vé, không bị nút đè, hiển thị trọn vẹn) */}
                <div className="flex items-center justify-between gap-1">
                  <h4
                    className="text-[11.5px] font-bold text-slate-900 leading-tight truncate"
                    title={v.title || title}
                  >
                    {title}
                  </h4>
                  {v.claimLimitTotal && v.claimLimitTotal > 1 ? (
                    <span
                      className={`shrink-0 rounded-xs px-1 text-[8.5px] font-black text-white ${
                        isShip ? "bg-[#00B5A5]" : "bg-[#FE2C55]"
                      }`}
                    >
                      x{v.claimLimitTotal}
                    </span>
                  ) : null}
                </div>

                {/* HÀNG 2: MỨC GIẢM + ĐIỀU KIỆN (BÊN TRÁI) & NÚT HÀNH ĐỘNG (BÊN PHẢI) */}
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-[13px] font-black leading-tight shrink-0 ${
                          isShip ? "text-[#008A7E]" : "text-[#FE2C55]"
                        }`}
                      >
                        {discountText}
                      </span>
                      <span className="text-[9.5px] font-medium text-slate-500 truncate leading-tight">
                        · {minOrderText}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isClaimed ? (
                      <Link
                        href={voucherUseHref(v.id)}
                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border transition ${
                          isShip
                            ? "border-[#00B5A5] text-[#00B5A5] bg-cyan-50/40"
                            : "border-[#FE2C55] text-[#FE2C55] bg-rose-50/40"
                        }`}
                      >
                        Dùng
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={claims.pendingId === v.id || state === "soldOut"}
                        onClick={() => claims.claim(v.id)}
                        className={`inline-flex items-center justify-center rounded-full px-3 py-0.5 text-[10.5px] font-bold text-white shadow-xs active:scale-95 disabled:opacity-50 transition cursor-pointer ${
                          isShip ? "bg-[#00B5A5] hover:bg-[#009E90]" : "bg-[#FE2C55] hover:bg-[#E01E43]"
                        }`}
                      >
                        {claims.pendingId === v.id ? "…" : "Nhận"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom Sheet Modal khi bấm vào header / nút > (Ảnh 2 chuẩn TikTok Shop) */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          {/* Backdrop tối mờ */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Khung Sheet */}
          <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-[26px] bg-white shadow-2xl transition-transform animate-in slide-in-from-bottom duration-300">
            {/* Header Modal */}
            <div className="relative flex items-center justify-center border-b border-stone-100 px-4 py-3.5">
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Voucher & khuyến mãi
              </h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="absolute right-3.5 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            {/* Thông điệp chính sách TikTok Shop */}
            <div className="px-4 py-2.5 bg-stone-50/80 border-b border-stone-100 text-[11px] text-slate-500 leading-relaxed">
              Áp 1 voucher vận chuyển và 1 voucher giảm giá cho đơn hàng. Voucher đã nhận sẽ tự động áp dụng khi thanh toán. Có áp dụng điều khoản.
            </div>

            {/* Danh sách cuộn */}
            <div className="overflow-y-auto px-4 py-3.5 pb-12 space-y-4">
              {/* Nhóm 1: Voucher vận chuyển */}
              {shippingVouchers.length > 0 && (
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-900 mb-2.5">
                    Voucher vận chuyển
                  </h4>
                  <div className="space-y-3">
                    {shippingVouchers.map((v) => (
                      <TikTokLargeVoucherCard
                        key={v.id}
                        v={v}
                        state={states.get(v.id) as ClaimState}
                        claims={claims}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Nhóm 2: Voucher người bán */}
              {sellerVouchers.length > 0 && (
                <div>
                  <h4 className="text-[13.5px] font-black text-slate-900 mb-2.5">
                    Voucher người bán
                  </h4>
                  <div className="space-y-3">
                    {sellerVouchers.map((v) => (
                      <TikTokLargeVoucherCard
                        key={v.id}
                        v={v}
                        state={states.get(v.id) as ClaimState}
                        claims={claims}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dải voucher: trên mobile hiển thị kiểu TikTok Shop (Ảnh 1 & Ảnh 2),
 * trên desktop giữ nguyên hàng vé ngang Shopee truyền thống.
 */
export function DealsVoucherStrip({
  vouchers: rawVouchers,
  viewer,
  offsetMs,
  focusIds = [],
}: {
  vouchers: CampaignVoucherUI[];
  viewer: CampaignViewerUI | null;
  offsetMs: number;
  focusIds?: string[];
}) {
  const claims = useVoucherClaims();
  const vouchers = rawVouchers.map((v) => withDrawn(v, claims.drawn));
  const justClaimed = claims.claimedVoucherId
    ? vouchers.find((v) => v.id === claims.claimedVoucherId) ?? null
    : null;
  const justSaved = useJustSaved(claims.claimedIds);
  const visible = vouchers.filter((v) => viewer?.newBuyer !== false || v.targetCustomer !== "new_web");
  const row = useRowScroll(visible.length);
  if (!visible.length) return null;
  const nowMs = Date.now() + offsetMs;
  const rank = (v: CampaignVoucherUI) => {
    const i = focusIds.indexOf(v.id);
    return i < 0 ? focusIds.length : i;
  };
  const grouped = sortVouchersGrouped(visible);
  const list = focusIds.length ? [...grouped].sort((a, b) => rank(a) - rank(b)) : grouped;
  const states = new Map(list.map((v) => [v.id, claimStateOf(v, viewer, claims.claimedIds.has(v.id), nowMs)]));
  const claimable = [...states.values()].filter((s) => s === "claimable").length;

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE ONLY (< 640px): GIAO DIỆN VOUCHER TIKTOK SHOP CHUẨN ẢNH 1 & ẢNH 2 */}
      {/* ========================================================================= */}
      <div className="sm:hidden">
        <TikTokMobileVoucherStrip
          vouchers={list}
          claims={claims}
          states={states}
        />
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP ONLY (>= 640px): GIỮ NGUYÊN GIAO DIỆN HIỆN TẠI                    */}
      {/* ========================================================================= */}
      <section id="kho-voucher" aria-label="Kho voucher" className="hidden sm:block scroll-mt-24 space-y-3.5 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
        {/* Header section - Mobile First layout */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--campaign-primary,#C2185B)]/10 text-[var(--campaign-primary,#C2185B)]">
              <TicketPercent size={16} strokeWidth={2.5} aria-hidden />
            </span>
            <h2 className="text-sm font-black tracking-tight text-slate-900 whitespace-nowrap sm:text-base">
              Voucher ưu đãi
            </h2>
            <span className="shrink-0 rounded-full bg-rose-100/80 px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--campaign-primary,#C2185B)] whitespace-nowrap">
              {list.length} mã
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {claimable >= 2 ? (
              <button
                type="button"
                onClick={claims.collectAll}
                disabled={claims.collecting}
                className="group inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#C8102E] bg-[length:200%_auto] px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold text-white shadow-xs transition-all duration-300 hover:bg-right hover:shadow-sm active:scale-95 disabled:opacity-60 select-none cursor-pointer whitespace-nowrap"
              >
                <Sparkles size={12} className="text-amber-300 shrink-0 transition-transform duration-300 group-hover:scale-110" aria-hidden />
                <span>{claims.collecting ? "Đang lưu…" : "Lưu tất cả"}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => openVoucherModal()}
              className="inline-flex h-7 shrink-0 items-center gap-0.5 text-xs font-bold text-[var(--campaign-primary,#C2185B)] hover:underline whitespace-nowrap cursor-pointer"
              title="Xem tất cả voucher"
            >
              <span className="hidden min-[360px]:inline">Chi tiết</span>
              <ChevronRight size={14} className="shrink-0" aria-hidden />
            </button>
          </div>
        </div>

        {/* Một hàng vé ngang kiểu Shopee: điện thoại vuốt, máy tính có mũi tên */}
        <div className="relative">
          {row.edge.prev ? (
            <button
              type="button"
              aria-label="Xem voucher trước"
              onClick={() => row.by(-1)}
              className="absolute -left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/[0.08] transition hover:text-[var(--campaign-primary,#C8102E)] sm:flex"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
          ) : null}
          {row.edge.next ? (
            <button
              type="button"
              aria-label="Xem voucher tiếp"
              onClick={() => row.by(1)}
              className="absolute -right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/[0.08] transition hover:text-[var(--campaign-primary,#C8102E)] sm:flex"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          ) : null}
        <ul
          ref={row.ref}
          className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {list.map((v) => {
            const state = states.get(v.id) as ClaimState;
            const isShip = v.benefitType === "shipping";
            const isMystery = Boolean(v.mystery);
            const isClaimed = state === "claimed" || state === "auto";
            const discountText = tikTokDiscountText(v);
            const minOrderText = tikTokMinOrderText(v);
            const title = cleanVoucherTitle(v);
            const dim = state === "soldOut" || state === "locked";
            const focused = focusIds.includes(v.id);

            return (
              <li
                key={v.id}
                className={`relative flex min-h-[76px] w-[285px] shrink-0 snap-start overflow-hidden rounded-xl sm:rounded-2xl bg-white border border-stone-200/90 shadow-2xs select-none transition-all duration-200 hover:shadow-md ${
                  dim ? "opacity-60" : ""
                } ${focused ? "aloha-focus-pulse" : ""} ${justSaved.has(v.id) ? "aloha-voucher-shine" : ""}`}
              >
                {/* Cuống vé bên trái - Chuẩn TikTok Shop (Ảnh 2 & 3) */}
                <div
                  className={`flex w-[64px] shrink-0 flex-col items-center justify-center p-1.5 border-r border-dashed ${
                    isShip
                      ? "bg-[#E6F8F6] text-[#00B5A5] border-[#B2EBE6]"
                      : "bg-[#FFF0F2] text-[#FE2C55] border-[#FDD3D9]"
                  }`}
                >
                  {isShip ? (
                    <Truck size={20} strokeWidth={2.2} />
                  ) : isMystery ? (
                    <Zap size={20} className="fill-current" strokeWidth={0} />
                  ) : (
                    <TicketPercent size={20} strokeWidth={2.2} />
                  )}
                  <span className="mt-1 text-[10px] font-bold leading-none text-center">
                    {isShip ? "Vận chuyển" : isMystery ? "Túi mù" : "Sản phẩm"}
                  </span>
                </div>

                {/* Vết khuyết bán nguyệt (Notches) */}
                <span className="pointer-events-none absolute -top-1.5 left-[64px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200/90" />
                <span className="pointer-events-none absolute -bottom-1.5 left-[64px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white border border-stone-200/90" />

                {/* Thân vé bên phải */}
                <div className="flex min-w-0 flex-1 flex-col justify-between py-2 px-2.5 sm:px-3">
                  {/* HÀNG 1: TIÊU ĐỀ VOUCHER (Trải rộng 100% thân vé, hiển thị trọn vẹn) */}
                  <div className="flex items-center justify-between gap-1">
                    <h4
                      className="text-[12px] sm:text-[13px] font-bold text-slate-900 leading-tight truncate"
                      title={v.title || title}
                    >
                      {title}
                    </h4>
                    {v.claimLimitTotal && v.claimLimitTotal > 1 ? (
                      <span
                        className={`shrink-0 rounded-xs px-1 text-[8.5px] sm:text-[9px] font-black text-white ${
                          isShip ? "bg-[#00B5A5]" : "bg-[#FE2C55]"
                        }`}
                      >
                        x{v.claimLimitTotal}
                      </span>
                    ) : null}
                  </div>

                  {/* HÀNG 2: MỨC GIẢM + ĐIỀU KIỆN (BÊN TRÁI) & NÚT HÀNH ĐỘNG (BÊN PHẢI) */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-[13.5px] sm:text-[15px] font-black leading-tight shrink-0 ${
                            isShip ? "text-[#008A7E]" : "text-[#FE2C55]"
                          }`}
                        >
                          {discountText}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate leading-tight">
                          · {minOrderText}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isClaimed ? (
                        <Link
                          href={voucherUseHref(v.id)}
                          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold border transition ${
                            isShip
                              ? "border-[#00B5A5] text-[#00B5A5] bg-cyan-50/40 hover:bg-cyan-100/50"
                              : "border-[#FE2C55] text-[#FE2C55] bg-rose-50/40 hover:bg-rose-100/50"
                          }`}
                        >
                          Dùng
                        </Link>
                      ) : isMystery && !v.mystery?.drawnPercent ? (
                        <button
                          type="button"
                          disabled={claims.pendingId === v.id || state === "soldOut"}
                          onClick={() => claims.claim(v.id)}
                          className="inline-flex items-center justify-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-rose-500 shadow-xs active:scale-95 disabled:opacity-50 transition cursor-pointer"
                        >
                          <Gift size={12} strokeWidth={2.5} />
                          <span>{claims.pendingId === v.id ? "…" : "Bóc"}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={claims.pendingId === v.id || state === "soldOut"}
                          onClick={() => claims.claim(v.id)}
                          className={`inline-flex items-center justify-center rounded-full px-3.5 py-1 text-[11px] font-bold text-white shadow-xs active:scale-95 disabled:opacity-50 transition cursor-pointer ${
                            isShip
                              ? "bg-[#00B5A5] hover:bg-[#009E90]"
                              : "bg-[#FE2C55] hover:bg-[#E01E43]"
                          }`}
                        >
                          {claims.pendingId === v.id ? "…" : "Nhận"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        </div>
      </section>

      <LoginSheet open={claims.loginOpen} onClose={claims.cancelLogin} onDone={claims.loginDone} />
      <ClaimSuccessModal
        voucher={justClaimed}
        open={Boolean(justClaimed)}
        onClose={claims.clearClaimedVoucherId}
        targetHref="/uu-dai?tab=deal-hot"
      />
    </>
  );
}
