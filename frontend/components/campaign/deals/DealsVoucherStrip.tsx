"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Gift, Lock, Sparkles, TicketPercent, Truck, Zap } from "lucide-react";
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
    <section id="kho-voucher" aria-label="Kho voucher" className="scroll-mt-24 space-y-3.5 rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-rose-100/80">
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

          <Link
            href="/uu-dai?tab=voucher"
            className="inline-flex h-7 shrink-0 items-center gap-0.5 text-xs font-bold text-[var(--campaign-primary,#C2185B)] hover:underline whitespace-nowrap"
            title="Xem tất cả voucher"
          >
            <span className="hidden min-[360px]:inline">Chi tiết</span>
            <ChevronRight size={14} className="shrink-0" aria-hidden />
          </Link>
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
          const { top, value, isShip } = valueOf(v);
          const { minSpend, cap } = voucherDetails(v);
          const cleanedTitle = cleanVoucherTitle(v);
          const hint = hintOf(v, nowMs);
          const dim = state === "soldOut" || state === "locked";
          const focused = focusIds.includes(v.id);

          return (
            <li
              key={v.id}
              className={`relative flex w-[13.8rem] shrink-0 snap-start items-stretch overflow-hidden rounded-xl sm:rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.06] sm:w-[15rem] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                dim ? "opacity-60" : ""
              } ${focused ? "aloha-focus-pulse" : ""} ${justSaved.has(v.id) ? "aloha-voucher-shine" : ""}`}
            >
              {/* Vết khuyết bán nguyệt trên và dưới (Punch-hole coupon notches) */}
              <span
                className="pointer-events-none absolute -top-1.5 left-[66px] sm:left-[70px] z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white ring-1 ring-black/[0.08]"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute -bottom-1.5 left-[66px] sm:left-[70px] z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white ring-1 ring-black/[0.08]"
                aria-hidden="true"
              />

              {/* Khối giá trị bên trái - Nổi bật đậm nét, cuống vé gọn gàng chuẩn TMĐT */}
              <div
                className={`relative flex w-[66px] sm:w-[70px] shrink-0 flex-col items-center justify-center border-r border-dashed border-white/40 px-1 py-1.5 text-white select-none ${
                  isShip
                    ? "bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#115E59]"
                    : "bg-gradient-to-br from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#9F1239]"
                }`}
              >
                <span className="flex items-center gap-0.5 text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-white/90">
                  {isShip ? (
                    <Truck size={9} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Zap size={9} className="fill-white" strokeWidth={0} aria-hidden />
                  )}
                  {top}
                </span>
                <span className="mt-0.5 text-[16px] sm:text-[18px] font-black leading-none tabular-nums tracking-tight text-white drop-shadow-xs">
                  {value}
                </span>
              </div>

              {/* Thân vé: tiêu đề 1 dòng gọn gàng, điều kiện gom inline, footnote + nút mini */}
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-1.5 pl-2.5 pr-2 sm:py-2 sm:pl-3 sm:pr-2.5">
                <div className="min-w-0 space-y-0.5">
                  <p
                    className="truncate text-[11.5px] sm:text-[12px] font-bold text-slate-900 leading-snug"
                    title={v.title || cleanedTitle}
                  >
                    {cleanedTitle}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] sm:text-[10.5px] text-slate-500 leading-tight truncate">
                    <span className="truncate">{minSpend}</span>
                    {cap ? <span className="truncate text-slate-400">· {cap}</span> : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <Footnote v={v} hint={hint} nowMs={nowMs} isShip={isShip} />
                  <Action
                    voucherId={v.id}
                    state={state}
                    isShip={isShip}
                    mystery={Boolean(v.mystery)}
                    busy={claims.pendingId === v.id}
                    saved={justSaved.has(v.id)}
                    onClaim={() => claims.claim(v.id)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      </div>
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
