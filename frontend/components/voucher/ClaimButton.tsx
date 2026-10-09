"use client";

import Link from "next/link";
import { Gift, Lock } from "lucide-react";
import type { CampaignVoucherUI, CampaignViewerUI } from "@/lib/campaign/campaignApi";
import { voucherUseHref } from "@/lib/voucherFormat";
import { CountdownText } from "@/components/campaign/CountdownText";
import type { TicketTone } from "./VoucherTicket";

export type ClaimState = "locked" | "claimed" | "upcoming" | "soldOut" | "auto" | "claimable";

export function claimStateOf(
  v: CampaignVoucherUI,
  viewer: CampaignViewerUI | null,
  claimed: boolean,
  nowMs: number
): ClaimState {
  if (viewer && !viewer.canUse) return "locked";
  if (!v.claimRequired) return "auto";
  if (claimed) return "claimed";
  if (v.claimStartDate && Date.parse(v.claimStartDate) > nowMs) return "upcoming";
  if (v.claimLimitTotal && v.claimedCount >= v.claimLimitTotal) return "soldOut";
  return "claimable";
}

const BTN =
  "inline-flex min-h-[26px] sm:min-h-[28px] items-center justify-center rounded-full px-2.5 sm:px-3.5 py-0.5 text-[11px] sm:text-xs font-bold transition-all select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400";

const BTN_TONE: Record<TicketTone, string> = {
  green: "bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white hover:brightness-110 shadow-sm shadow-teal-900/15",
  red: "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] to-[#E11D48] text-white hover:brightness-110 shadow-sm shadow-rose-950/15",
  bronze: "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] to-[#E11D48] text-white hover:brightness-110 shadow-sm shadow-rose-950/15",
  peach: "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] to-[#E11D48] text-white hover:brightness-110 shadow-sm shadow-rose-950/15",
  cream: "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] to-[#E11D48] text-white hover:brightness-110 shadow-sm shadow-rose-950/15",
  gray: "bg-slate-200 text-slate-500",
};

/** Nút trên vé voucher theo chuẩn Shopee/TikTok: "Lưu mã" nếu chưa lưu, "Dùng ngay" nếu đã có/tự áp dụng với màu sắc khớp cuống vé. */
export function ClaimButton({
  state,
  voucher,
  viewer,
  offsetMs,
  busy,
  onClaim,
  tone = "green",
}: {
  state: ClaimState;
  voucher: CampaignVoucherUI;
  viewer: CampaignViewerUI | null;
  offsetMs: number;
  busy?: boolean;
  onClaim: () => void;
  tone?: TicketTone;
}) {
  if (state === "locked") {
    return (
      <span className={`${BTN} gap-1 bg-slate-100 text-slate-500`} title={viewer?.lockMessage || undefined}>
        <Lock size={12} aria-hidden />
        {viewer?.lockReason === "account_locked" ? "Tài khoản bị khoá" : "Dành cho khách lẻ"}
      </span>
    );
  }

  // Voucher đã có sẵn / tự áp dụng: tới đúng các SP voucher áp dụng được
  if (state === "auto" || state === "claimed") {
    return (
      <Link
        href={voucherUseHref(voucher.id)}
        className={`${BTN} ${BTN_TONE[tone]} active:scale-95 shadow-sm cursor-pointer`}
      >
        Dùng ngay
      </Link>
    );
  }

  if (state === "upcoming") {
    return (
      <span className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
        <span className={`${BTN} bg-amber-50 text-amber-700`}>Sắp mở lưu</span>
        <CountdownText target={Date.parse(voucher.claimStartDate as string)} offsetMs={offsetMs} />
      </span>
    );
  }

  if (state === "soldOut") {
    return <span className={`${BTN} bg-slate-100 text-slate-400 font-medium`}>Hết lượt</span>;
  }

  if (voucher.mystery) {
    return (
      <button
        type="button"
        onClick={onClaim}
        disabled={busy}
        className={`${BTN} gap-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-sm shadow-orange-900/20 hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer aloha-mystery-wiggle`}
      >
        <Gift size={13} strokeWidth={2.6} aria-hidden />
        {busy ? "Đang bóc…" : "Bóc ngay"}
      </button>
    );
  }

  // Chưa lưu: Nút "Lưu mã" rõ ràng
  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={busy}
      className={`${BTN} ${BTN_TONE[tone]} active:scale-95 disabled:opacity-60 cursor-pointer shadow-sm`}
    >
      {busy ? "Đang lưu…" : "Lưu mã"}
    </button>
  );
}
