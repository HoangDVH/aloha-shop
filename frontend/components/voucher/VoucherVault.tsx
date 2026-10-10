"use client";

import Link from "next/link";
import { Check, Gift, Sparkles, TicketPercent, Tag, Truck, Zap } from "lucide-react";
import type { CampaignVoucherUI, CampaignViewerUI } from "@/lib/campaign/campaignApi";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { splitCountdown, useCountdown } from "@/lib/hooks/useCountdown";
import {
  cleanVoucherTitle,
  formatCompactVnd,
  formatVoucherBadge,
  isUnopenedMystery,
  pctText,
  sortVouchersGrouped,
  voucherConditionText,
  voucherUseHref,
  withDrawn,
} from "@/lib/voucherFormat";
import { MysteryOdds } from "./MysteryOdds";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { VoucherTicket, type TicketTone } from "./VoucherTicket";
import { ClaimButton, claimStateOf, type ClaimState } from "./ClaimButton";
import { ClaimSuccessModal } from "./ClaimSuccessModal";

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

const DAY_MS = 86_400_000;

export type VaultVariant = "full" | "compact" | "newUser";

function vnDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function remainingOf(v: CampaignVoucherUI): number | null {
  return v.claimLimitTotal ? Math.max(0, v.claimLimitTotal - v.claimedCount) : null;
}

function claimedPercentOf(v: CampaignVoucherUI): number | null {
  if (!v.claimLimitTotal) return null;
  return Math.min(100, Math.round((v.claimedCount / v.claimLimitTotal) * 100));
}

/** "13h : 22m" — đếm ngược tới hết hạn voucher (bù lệch đồng hồ server). */
function VoucherEndsIn({ endMs, offsetMs }: { endMs: number; offsetMs: number }) {
  const ticked = useCountdown(endMs, offsetMs);
  // Lần render đầu hook chưa chạy (ms = 0) → tự tính, tránh nháy «Đã hết hạn».
  const c = ticked.ms > 0 ? ticked : splitCountdown(endMs - (Date.now() + offsetMs));
  if (c.done) return <span className="text-slate-400">Đã hết hạn</span>;
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      Còn:{" "}
      <span className="font-bold text-red-600">
        {Number(c.h)}h : {c.m}m
      </span>
    </span>
  );
}

function VoucherStatusLine({
  v,
  state,
  nowMs,
  offsetMs,
}: {
  v: CampaignVoucherUI;
  state: ClaimState;
  nowMs: number;
  offsetMs: number;
}) {
  const endMs = v.endDate ? Date.parse(v.endDate) : NaN;
  if (Number.isFinite(endMs) && endMs > nowMs && endMs - nowMs <= DAY_MS) {
    return <VoucherEndsIn endMs={endMs} offsetMs={offsetMs} />;
  }
  if (state === "auto" || state === "claimed") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
        {state === "auto" ? "Tự động áp dụng" : "Đã lưu vào ví"}
        <Check size={12} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return null;
}

/** Giờ chót: vé còn ít lượt lên đầu; khách mới: vé khách mới lên đầu; vé được nhắc tới (popup) luôn đứng đầu. */
function orderVouchers(list: CampaignVoucherUI[], variant: VaultVariant, lastHours: boolean, focus: string[]) {
  const out = sortVouchersGrouped(list);
  if (variant === "newUser") {
    out.sort((a, b) => Number(b.targetCustomer === "new_web") - Number(a.targetCustomer === "new_web"));
  } else if (lastHours) {
    out.sort((a, b) => (remainingOf(a) ?? Infinity) - (remainingOf(b) ?? Infinity));
  }
  if (focus.length) {
    const rank = (v: CampaignVoucherUI) => {
      const i = focus.indexOf(v.id);
      return i < 0 ? focus.length : i;
    };
    out.sort((a, b) => rank(a) - rank(b));
  }
  return variant === "full" ? out : out.slice(0, variant === "compact" ? 6 : 3);
}

/** Chọn icon và màu sắc phù hợp từng loại voucher đang có của shop theo phong cách Ảnh 3. */
export function voucherIconAndTone(v: CampaignVoucherUI): {
  icon: React.ReactNode;
  tone: TicketTone;
  stubTopLabel: string;
  stubValue: string;
  isShip: boolean;
  isNewWeb: boolean;
} {
  const isShip = v.benefitType === "shipping";
  const titleLower = (v.title || "").toLowerCase();
  const isNewWeb =
    v.targetCustomer === "new_web" ||
    titleLower.includes("khách mới") ||
    titleLower.includes("bạn mới");

  if (isShip) {
    return {
      icon: <Truck size={16} strokeWidth={2.4} className="shrink-0" />,
      tone: "green",
      stubTopLabel: "SHIP",
      stubValue:
        v.discountType === "fixed" && v.discountValue > 0
          ? formatCompactVnd(v.discountValue).toUpperCase()
          : "FREE",
      isShip: true,
      isNewWeb: false,
    };
  }

  if (isNewWeb) {
    return {
      icon: <Gift size={16} strokeWidth={2.4} className="shrink-0" />,
      tone: "red",
      stubTopLabel: "GIẢM",
      stubValue:
        v.discountType === "percentage"
          ? pctText(v)
          : formatCompactVnd(v.discountValue).toUpperCase(),
      isShip: false,
      isNewWeb: true,
    };
  }

  if (v.discountType === "percentage") {
    return {
      icon: isUnopenedMystery(v) ? (
        <Gift size={16} strokeWidth={2.4} className="shrink-0" />
      ) : (
        <TicketPercent size={16} strokeWidth={2.4} className="shrink-0" />
      ),
      tone: "red",
      stubTopLabel: isUnopenedMystery(v) ? "TÚI MÙ" : "GIẢM",
      stubValue: pctText(v),
      isShip: false,
      isNewWeb: false,
    };
  }

  return {
    icon: <Tag size={16} strokeWidth={2.4} className="shrink-0" />,
    tone: "red",
    stubTopLabel: "GIẢM",
    stubValue: formatCompactVnd(v.discountValue).toUpperCase(),
    isShip: false,
    isNewWeb: false,
  };
}

export function VoucherVault({
  vouchers: rawVouchers,
  viewer,
  offsetMs,
  variant = "full",
  lastHours = false,
  notchBg,
  focusIds = [],
  focusLabel = "",
  filterNode,
}: {
  vouchers: CampaignVoucherUI[];
  viewer: CampaignViewerUI | null;
  offsetMs: number;
  variant?: VaultVariant;
  lastHours?: boolean;
  notchBg?: string;
  /** Voucher khách vừa thấy (vd. trên popup): đưa lên đầu, viền nổi bật. */
  focusIds?: string[];
  /** Nhãn nhỏ cạnh tiêu đề vé được nhắc tới, vd. "Từ popup". */
  focusLabel?: string;
  /** Khối lọc loại voucher đi kèm (hiển thị cùng hàng với nút Lưu tất cả). */
  filterNode?: React.ReactNode;
}) {
  const claims = useVoucherClaims();
  const vouchers = rawVouchers.map((v) => withDrawn(v, claims.drawn));
  const justClaimed = claims.claimedVoucherId
    ? vouchers.find((v) => v.id === claims.claimedVoucherId) ?? null
    : null;
  const visible = vouchers.filter((v) => viewer?.newBuyer !== false || v.targetCustomer !== "new_web");
  const list = orderVouchers(visible, variant, lastHours, focusIds);
  if (!list.length) return null;
  const nowMs = Date.now() + offsetMs;
  const canCollect = list.some((v) => claimStateOf(v, viewer, claims.claimedIds.has(v.id), nowMs) === "claimable");

  return (
    <div>
      {variant === "full" && (filterNode || canCollect) ? (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-rose-100/50 pb-2 sm:pb-3">
          {filterNode ? <div className="min-w-0 flex-1">{filterNode}</div> : <div />}
          {canCollect ? (
            <button
              type="button"
              onClick={claims.collectAll}
              disabled={claims.collecting}
              className="group inline-flex min-h-[32px] sm:min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] via-[#E11D48] to-[#C8102E] bg-[length:200%_auto] px-3.5 sm:px-5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-rose-950/15 transition-all duration-300 hover:bg-right hover:shadow-md active:scale-95 disabled:opacity-60 select-none cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-300 shrink-0 sm:w-3.5 sm:h-3.5 transition-transform group-hover:scale-110" />
              <span>{claims.collecting ? "Đang lưu…" : "Lưu tất cả"}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      <ul
        className={`${
          variant === "newUser"
            ? "flex flex-col gap-2.5 sm:gap-3"
            : "flex flex-col gap-2 sm:gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-3"
        } ${focusIds.length && focusLabel ? "pt-2.5" : ""}`}
      >
        {list.map((v) => {
          const state = claimStateOf(v, viewer, claims.claimedIds.has(v.id), nowMs);
          const isShip = v.benefitType === "shipping";
          const isMystery = Boolean(v.mystery);
          const isClaimed = state === "claimed" || state === "auto";
          const discountText = tikTokDiscountText(v);
          const minOrderText = tikTokMinOrderText(v);
          const title = cleanVoucherTitle(v);
          const left = remainingOf(v);
          const claimedPct = claimedPercentOf(v);
          const focused = focusIds.includes(v.id);
          const dim = state === "soldOut" || state === "locked";

          return (
            <li
              key={v.id}
              className={`relative flex flex-col h-full ${
                variant === "newUser" ? "w-full" : "w-full sm:w-auto"
              }`}
            >
              {focused && focusLabel ? (
                <span className="absolute -top-2 right-4 z-20 rounded-full bg-[var(--campaign-primary,#C8102E)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm ring-2 ring-white">
                  {focusLabel}
                </span>
              ) : null}

              <div
                className={`relative flex min-h-[76px] sm:min-h-[82px] w-full overflow-hidden rounded-xl sm:rounded-2xl bg-white border border-stone-200/90 shadow-2xs select-none transition-all duration-200 hover:shadow-md ${
                  dim ? "opacity-60" : ""
                } ${focused ? "ring-2 ring-[var(--campaign-primary,#C8102E)]/60 ring-offset-1" : ""}`}
              >
                {/* Cuống vé bên trái - Chuẩn TikTok Shop (Ảnh 2 & 3) */}
                <div
                  className={`flex w-[62px] sm:w-[68px] shrink-0 flex-col items-center justify-center p-1 sm:p-1.5 border-r border-dashed ${
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
                  <span className="mt-1 text-[9.5px] sm:text-[10px] font-bold leading-none text-center">
                    {isShip ? "Vận chuyển" : isMystery ? "Túi mù" : "Sản phẩm"}
                  </span>
                </div>

                {/* Vết khuyết bán nguyệt (Notches) */}
                <span
                  className="pointer-events-none absolute -top-1.5 left-[62px] sm:left-[68px] z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-stone-200/90"
                  style={{ backgroundColor: notchBg || "#FFF0F5" }}
                  aria-hidden="true"
                />
                <span
                  className="pointer-events-none absolute -bottom-1.5 left-[62px] sm:left-[68px] z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-stone-200/90"
                  style={{ backgroundColor: notchBg || "#FFF0F5" }}
                  aria-hidden="true"
                />

                {/* Thân vé bên phải */}
                <div className="flex min-w-0 flex-1 flex-col justify-between py-1.5 pl-2.5 pr-2 sm:py-2 sm:pl-3 sm:pr-3">
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
                      <div className="flex items-baseline gap-1 flex-wrap">
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
                      <div className="flex items-center gap-1.5 mt-0.5 text-[9px] sm:text-[10px] text-slate-400 leading-none">
                        {v.endDate ? <span>HSD: {vnDate(v.endDate)}</span> : null}
                        {claimedPct != null && left != null && left <= 20 ? (
                          <span className="text-red-500 font-semibold">· Còn {left} lượt</span>
                        ) : null}
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
    </div>
  );
}
