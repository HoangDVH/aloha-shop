"use client";

import { Check, Gift, Sparkles, TicketPercent, Tag, Truck } from "lucide-react";
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
  withDrawn,
} from "@/lib/voucherFormat";
import { MysteryOdds } from "./MysteryOdds";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import { VoucherTicket, type TicketTone } from "./VoucherTicket";
import { ClaimButton, claimStateOf, type ClaimState } from "./ClaimButton";
import { ClaimSuccessModal } from "./ClaimSuccessModal";

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
          const claimedPct = claimedPercentOf(v);
          const left = remainingOf(v);
          const { icon, tone, stubTopLabel, stubValue } = voucherIconAndTone(v);
          const headline = cleanVoucherTitle(v);
          const focused = focusIds.includes(v.id);

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
              <VoucherTicket
                size="lg"
                stubValue={stubValue}
                stubTopLabel={stubTopLabel}
                icon={icon}
                tone={tone}
                title={headline}
                disabled={state === "soldOut" || state === "locked"}
                notchBg={notchBg || "var(--campaign-cream, #FFF0F5)"}
                className={`h-full w-full ${focused ? "ring-2 ring-[var(--campaign-primary,#C8102E)]/60 ring-offset-1" : ""}`}
                action={
                  <ClaimButton
                    state={state}
                    voucher={v}
                    viewer={viewer}
                    offsetMs={offsetMs}
                    busy={claims.pendingId === v.id}
                    onClaim={() => claims.claim(v.id)}
                    tone={tone}
                  />
                }
              >
                <p className="truncate text-[11px] sm:text-xs font-medium text-slate-600">{voucherConditionText(v)}</p>
                {v.mystery ? <MysteryOdds mystery={v.mystery} /> : null}
                {claimedPct != null && left != null ? (
                  <div className="flex items-center gap-1.5 sm:gap-2" title={`Đã lưu ${claimedPct}% số lượt`}>
                    <div
                      className="h-1.5 min-w-8 max-w-20 sm:max-w-24 flex-1 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-valuenow={claimedPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Tỉ lệ đã lưu"
                    >
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500" style={{ width: `${claimedPct}%` }} />
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap text-[10px] sm:text-[10.5px] font-semibold ${claimedPct >= 80 ? "text-red-600" : "text-slate-500"}`}
                    >
                      {left > 0 ? `Còn ${left} lượt` : "Hết lượt"}
                    </span>
                  </div>
                ) : v.claimRequired && v.claimedCount >= 50 ? (
                  <p className="text-[10px] sm:text-[10.5px] font-semibold text-slate-500">{v.claimedCount.toLocaleString("vi-VN")} người đã lưu</p>
                ) : null}
                <div className="flex items-center gap-2 text-[10.5px] sm:text-[11px] font-medium text-slate-500">
                  {v.endDate ? <p>HSD: {vnDate(v.endDate)}</p> : null}
                  <p className="empty:hidden">
                    <VoucherStatusLine v={v} state={state} nowMs={nowMs} offsetMs={offsetMs} />
                  </p>
                </div>
              </VoucherTicket>
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
