"use client";

import Link from "next/link";
import { Check, TicketPercent, Truck } from "lucide-react";
import type { CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { cleanVoucherTitle, formatCompactVnd, formatVoucherBadge, pctText, voucherCustomerTitle, voucherScopeHint, voucherUseHref } from "@/lib/voucherFormat";
import type { ClaimState } from "./ClaimButton";

export function ProductScopedVoucherCard({ voucher: v, state, pending, onClaim, onProducts, popup = false }: {
  voucher: CampaignVoucherUI;
  state: ClaimState;
  pending?: boolean;
  onClaim: () => void;
  onProducts?: () => void;
  popup?: boolean;
}) {
  if (!popup) return <CompactVoucherCard voucher={v} state={state} pending={pending} onClaim={onClaim} onProducts={onProducts} />;
  const saved = state === "claimed";
  const canClaim = state === "claimable";
  const status = state === "locked" ? "Không áp dụng" : state === "soldOut" ? "Hết lượt"
    : state === "upcoming" ? "Sắp mở" : "";
  const conditions = [
    v.maxDiscountVnd ? `Tối đa ${formatCompactVnd(v.maxDiscountVnd).toUpperCase()}` : "",
    v.minOrderThreshold ? `Đơn từ ${formatCompactVnd(v.minOrderThreshold).toUpperCase()}` : "",
  ].filter(Boolean).join(" · ");
  return <article className={`min-w-0 shrink-0 overflow-hidden border border-rose-200 bg-white ${popup ? "rounded-2xl px-4 py-3 text-center shadow-md" : "flex min-h-[100px] rounded-xl text-left shadow-xs"}`}>
    {!popup && <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-dashed border-rose-200 bg-rose-50 text-[#FE2C55]">
      <TicketPercent size={20} aria-hidden /><span className="mt-1 text-center text-[9px] font-semibold">Sản phẩm</span>
    </div>}
    <div className={`min-w-0 flex-1 ${popup ? "" : "px-2.5 py-2"}`}>
      <h4 title={voucherCustomerTitle(v.title)} className="truncate text-xs font-bold leading-4 text-slate-900">{cleanVoucherTitle(v)}</h4>
      <p className={`mt-0.5 font-black leading-6 text-[#FE2C55] ${popup ? "text-xl" : "text-lg"}`}>Giảm {v.discountType === "percentage" ? pctText(v) : `${formatCompactVnd(v.discountValue).toUpperCase()}đ`}</p>
      {conditions ? <p className="truncate text-[11px] leading-4 text-slate-500" title={conditions}>{conditions}</p> : null}
      <div className={`mt-1 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 ${popup ? "justify-center" : ""}`}>
        {canClaim ? <button type="button" disabled={pending} onClick={onClaim}
          className="h-6 rounded-full bg-[#FE2C55] px-2.5 text-[11px] font-bold text-white disabled:opacity-50">{pending ? "Đang lưu…" : "Lưu mã"}</button>
          : saved ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700"><Check size={11} aria-hidden />Đã lưu</span>
          : status ? <span className="text-[10px] text-slate-500">{status}</span> : null}
        <Link href={voucherUseHref(v.id)} onClick={onProducts} title={voucherScopeHint(v)} aria-label={`Xem sản phẩm áp dụng: ${voucherScopeHint(v)}`} className="py-0.5 text-[11px] font-semibold text-[#C2185B] underline underline-offset-2">Sản phẩm áp dụng ›</Link>
      </div>
    </div>
  </article>;
}

/** Same compact information hierarchy as the product-page voucher badges. */
export function CompactVoucherCard({voucher: v, state, pending, onClaim, onProducts}: {
  voucher: CampaignVoucherUI; state: ClaimState; pending?: boolean; onClaim: () => void; onProducts?: () => void;
}) {
  const ship = v.benefitType === "shipping";
  const canClaim = state === "claimable";
  const usable = state === "claimed" || state === "auto";
  const scope = v.scope === "product";
  const label = formatVoucherBadge(v).label;
  const condition = v.minOrderThreshold ? `Đơn từ ${formatCompactVnd(v.minOrderThreshold).toUpperCase()}` : "Không có mức tối thiểu";
  const action = "inline-flex min-h-7 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-semibold";
  return <article title={voucherCustomerTitle(v.title)} className={`flex min-h-[68px] min-w-0 shrink-0 items-stretch overflow-hidden rounded-lg border text-left ${ship ? "border-[#bce9df] bg-[#f0fbf8] text-[#087a69]" : "border-[#f4cfc2] bg-[#fff5ef] text-[#b5482d]"}`}>
    <span className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-current/20 px-1 text-center text-[9px] leading-tight">
      {ship ? <Truck size={16} aria-hidden /> : <TicketPercent size={16} aria-hidden />}<span>{ship ? "Vận chuyển" : "Sản phẩm"}</span>
    </span>
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-2">
      <p className="line-clamp-2 text-xs font-bold leading-4">{label}</p>
      <p className="truncate text-[10px] leading-3 text-slate-500" title={condition}>{condition}</p>
      {scope && <Link href={voucherUseHref(v.id)} onClick={onProducts} aria-label="Xem sản phẩm áp dụng" className="w-fit text-[10px] leading-3 underline underline-offset-2">Sản phẩm áp dụng ›</Link>}
    </div>
    <div className="my-auto mr-2 shrink-0">
      {canClaim ? <button type="button" disabled={pending} onClick={onClaim} className={`${action} ${ship ? "bg-[#087a69]" : "bg-[#bf4e32]"} text-white disabled:opacity-50`}>{pending ? "Đang lưu…" : "Nhận"}</button>
        : usable ? <Link href={voucherUseHref(v.id)} onClick={onProducts} className={`${action} ${ship ? "bg-[#d9f2e9]" : "bg-[#ffe6d8]"}`}>{state === "claimed" ? "Đã lưu" : "Dùng"}</Link>
        : <span className={`${action} bg-stone-100 text-stone-500`}>{state === "soldOut" ? "Hết lượt" : state === "upcoming" ? "Sắp mở" : "Không áp dụng"}</span>}
    </div>
  </article>;
}
