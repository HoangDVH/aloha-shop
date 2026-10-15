"use client";

import Link from "next/link";
import { Check, TicketPercent } from "lucide-react";
import type { CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { formatCompactVnd, pctText, voucherScopeHint, voucherUseHref } from "@/lib/voucherFormat";
import type { ClaimState } from "./ClaimButton";

export function ProductScopedVoucherCard({ voucher: v, state, pending, onClaim, onProducts, popup = false }: {
  voucher: CampaignVoucherUI;
  state: ClaimState;
  pending?: boolean;
  onClaim: () => void;
  onProducts?: () => void;
  popup?: boolean;
}) {
  const saved = state === "claimed";
  const canClaim = state === "claimable";
  const status = state === "locked" ? "Không áp dụng cho tài khoản này" : state === "soldOut" ? "Đã hết lượt lưu"
    : state === "upcoming" ? "Chưa mở lưu mã" : state === "auto" ? "Áp dụng khi đủ điều kiện" : "";
  return <article className={`flex h-full min-w-0 gap-2.5 rounded-2xl border border-rose-200 bg-white p-3 text-left ${popup ? "shadow-md" : "shadow-xs"}`}>
    <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-rose-50 text-[#FE2C55]">
      <TicketPercent size={20} aria-hidden /><span className="mt-1 text-center text-[9px] font-semibold">Sản phẩm</span>
    </div>
    <div className="min-w-0 flex-1">
      <h4 className="text-xs font-bold leading-4 text-slate-900">{v.title}</h4>
      <p className="mt-1 text-base font-black text-[#FE2C55]">Giảm {v.discountType === "percentage" ? pctText(v) : `${formatCompactVnd(v.discountValue).toUpperCase()}đ`}</p>
      {v.maxDiscountVnd ? <p className="text-[11px] text-slate-500">Tối đa {formatCompactVnd(v.maxDiscountVnd).toUpperCase()}</p> : null}
      <p className="mt-1 text-[11px] font-semibold text-rose-700">{voucherScopeHint(v)}</p>
      {v.minOrderThreshold ? <p className="text-[10px] text-slate-500">Đơn từ {formatCompactVnd(v.minOrderThreshold).toUpperCase()} hàng áp dụng</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {canClaim ? <button type="button" disabled={pending} onClick={onClaim}
          className="min-h-8 rounded-full bg-[#FE2C55] px-3 text-[11px] font-bold text-white disabled:opacity-50">{pending ? "Đang lưu…" : "Lưu mã"}</button>
          : saved ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Check size={12} aria-hidden />Đã lưu vào ví</span>
          : <span className="text-[10px] text-slate-500">{status}</span>}
        <Link href={voucherUseHref(v.id)} onClick={onProducts} className="py-1 text-[11px] font-semibold text-[#C2185B] underline underline-offset-2">Xem sản phẩm áp dụng</Link>
      </div>
    </div>
  </article>;
}
