"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Flame, Gift, Lock, Sparkles, TicketPercent, Truck, Zap } from "lucide-react";
import type { CampaignVoucherUI, CampaignViewerUI } from "@/lib/campaign/campaignApi";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { formatCompactVnd, isUnopenedMystery, pctText, withDrawn } from "@/lib/voucherFormat";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { claimStateOf, type ClaimState } from "@/components/voucher/ClaimButton";
import { ClaimSuccessModal } from "@/components/voucher/ClaimSuccessModal";

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
  if (v.mystery?.drawnPercent) return `Bạn đã bóc được ${v.mystery.drawnPercent}%`;
  if (v.mystery) return `Bóc ngẫu nhiên · may mắn tới ${v.mystery.max}%`;
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

function Action({
  state,
  isShip,
  mystery,
  busy,
  saved,
  onClaim,
}: {
  state: ClaimState;
  isShip: boolean;
  mystery: boolean;
  busy: boolean;
  saved: boolean;
  onClaim: () => void;
}) {
  if (state === "claimable" && mystery) {
    return (
      <button
        type="button"
        onClick={onClaim}
        disabled={busy}
        className="aloha-mystery-wiggle inline-flex h-7.5 shrink-0 items-center justify-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-3 text-xs font-black text-white shadow-xs shadow-orange-900/20 transition hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer"
      >
        <Gift size={12} strokeWidth={2.6} aria-hidden />
        {busy ? "Bóc…" : "Bóc"}
      </button>
    );
  }
  if (state === "claimable") {
    return (
      <button
        type="button"
        onClick={onClaim}
        disabled={busy}
        className={`inline-flex h-7.5 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-black text-white shadow-xs transition hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer ${
          isShip
            ? "bg-gradient-to-r from-[#0D9488] to-[#0F766E] shadow-teal-900/15"
            : "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] to-[#E11D48] shadow-rose-950/15"
        }`}
      >
        {busy ? "Lưu…" : "Lưu"}
      </button>
    );
  }
  if (state === "claimed") {
    return (
      <span
        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold ${
          isShip
            ? "bg-teal-50 text-[#0F766E] ring-1 ring-teal-600/25"
            : "bg-rose-50 text-[var(--campaign-primary,#C8102E)] ring-1 ring-rose-200/80"
        } ${saved ? "aloha-saved-pop" : ""}`}
      >
        <Check size={12} strokeWidth={3} aria-hidden />
        Đã lưu
      </span>
    );
  }
  if (state === "auto") {
    return (
      <span
        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold ${
          isShip
            ? "bg-teal-50 text-[#0F766E] ring-1 ring-teal-600/25"
            : "bg-rose-50 text-[var(--campaign-primary,#C8102E)] ring-1 ring-rose-200/80"
        }`}
      >
        <Check size={12} strokeWidth={3} aria-hidden />
        Tự áp dụng
      </span>
    );
  }
  if (state === "upcoming") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-amber-50 px-2.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
        Sắp mở
      </span>
    );
  }
  if (state === "soldOut") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-400">
        Hết lượt
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <Lock size={12} aria-hidden />
    </span>
  );
}

/**
 * Dải voucher phong cách TikTok Shop: vé đục lỗ bán nguyệt (perforated coupon ticket),
 * khối giá trị nổi bật, điều kiện 2 dòng rõ ràng không bị đứt chữ, CTA pill button bắt mắt.
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
  if (!visible.length) return null;
  const nowMs = Date.now() + offsetMs;
  const rank = (v: CampaignVoucherUI) => {
    const i = focusIds.indexOf(v.id);
    return i < 0 ? focusIds.length : i;
  };
  const list = [...visible].sort((a, b) => rank(a) - rank(b));
  const states = new Map(list.map((v) => [v.id, claimStateOf(v, viewer, claims.claimedIds.has(v.id), nowMs)]));
  const claimable = [...states.values()].filter((s) => s === "claimable").length;

  return (
    <section id="kho-voucher" aria-label="Kho voucher" className="scroll-mt-24 space-y-3.5 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
      {/* Header section */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--campaign-primary,#C2185B)]/10 text-[var(--campaign-primary,#C2185B)]">
            <TicketPercent size={17} strokeWidth={2.5} aria-hidden />
          </span>
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 sm:text-base">
            Voucher ưu đãi
          </h2>
          <span className="rounded-full bg-rose-100/80 px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--campaign-primary,#C2185B)]">
            {list.length} mã
          </span>
        </div>

        <div className="flex items-center gap-2">
          {claimable >= 2 ? (
            <button
              type="button"
              onClick={claims.collectAll}
              disabled={claims.collecting}
              className="group inline-flex h-7.5 items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#C8102E] bg-[length:200%_auto] px-3.5 text-xs font-bold text-white shadow-xs transition-all duration-300 hover:bg-right hover:shadow-sm active:scale-95 disabled:opacity-60 select-none cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-300 transition-transform duration-300 group-hover:scale-110" aria-hidden />
              <span>{claims.collecting ? "Đang lưu…" : "Thu thập tất cả"}</span>
            </button>
          ) : null}

          <Link
            href="/uu-dai?tab=voucher"
            className="inline-flex min-h-[32px] items-center gap-0.5 text-xs font-bold text-[var(--campaign-primary,#C2185B)] hover:underline"
          >
            <span>Chi tiết</span>
            <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      </div>

      {/* Danh sách voucher kiểu TikTok Shop */}
      <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {list.map((v) => {
          const state = states.get(v.id) as ClaimState;
          const { top, value, isShip } = valueOf(v);
          const { minSpend, cap } = voucherDetails(v);
          const name = v.title?.trim();
          const hint = hintOf(v, nowMs);
          const dim = state === "soldOut" || state === "locked";
          const focused = focusIds.includes(v.id);

          return (
            <li
              key={v.id}
              className={`relative flex w-[78vw] max-w-[320px] shrink-0 snap-start items-stretch overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.08] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] sm:w-auto sm:max-w-none ${
                dim ? "opacity-60" : ""
              } ${focused ? "aloha-focus-pulse" : ""} ${justSaved.has(v.id) ? "aloha-voucher-shine" : ""}`}
            >
              {/* Vết khuyết bán nguyệt trên và dưới (Punch-hole coupon notches) */}
              <span
                className="pointer-events-none absolute -top-1.5 left-[84px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white ring-1 ring-black/[0.08]"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute -bottom-1.5 left-[84px] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-white ring-1 ring-black/[0.08]"
                aria-hidden="true"
              />

              {/* Khối giá trị bên trái - Nổi bật đậm nét, tương phản hoàn toàn với nền trang ngoài */}
              <div
                className={`relative flex w-[84px] shrink-0 flex-col items-center justify-center border-r border-dashed border-white/40 px-1 py-2.5 text-white ${
                  isShip
                    ? "bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#115E59]"
                    : "bg-gradient-to-br from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#9F1239]"
                }`}
              >
                <span className="flex items-center gap-0.5 text-[9.5px] font-black uppercase tracking-wider text-white/90">
                  {isShip ? (
                    <Truck size={10} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Zap size={10} className="fill-white" strokeWidth={0} aria-hidden />
                  )}
                  {top}
                </span>
                <span className="mt-1 text-xl font-black leading-none tabular-nums tracking-tight text-white drop-shadow-xs">
                  {value}
                </span>
              </div>

              {/* Khối điều kiện & nút hành động bên phải */}
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 pl-3 pr-2.5">
                <div className="min-w-0 flex-1 leading-snug">
                  {name ? (
                    <>
                      <p className="line-clamp-2 text-xs font-bold text-slate-900" title={name}>
                        {name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500" title={`${minSpend} · ${cap}`}>
                        {minSpend} · {cap}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="truncate text-xs font-bold text-slate-900">{minSpend}</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{cap}</p>
                    </>
                  )}
                  {hint ? (
                    <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] font-bold text-amber-600">
                      <Flame size={11} className="shrink-0 fill-amber-500 text-amber-500" aria-hidden />
                      <span className="truncate">{hint}</span>
                    </p>
                  ) : null}
                </div>
                <Action
                  state={state}
                  isShip={isShip}
                  mystery={Boolean(v.mystery)}
                  busy={claims.pendingId === v.id}
                  saved={justSaved.has(v.id)}
                  onClaim={() => claims.claim(v.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <LoginSheet open={claims.loginOpen} onClose={claims.cancelLogin} onDone={claims.loginDone} />
      <ClaimSuccessModal
        voucher={justClaimed}
        open={Boolean(justClaimed)}
        onClose={claims.clearClaimedVoucherId}
        targetHref="/uu-dai?tab=deal-hot"
      />
    </section>
  );
}
