"use client";

import Link from "next/link";
import { formatVnd } from "@/lib/api";
import { Check, TicketPercent, Truck } from "lucide-react";
import type { CampaignVoucherUI } from "@/lib/campaign/campaignApi";
import { cleanVoucherTitle, formatCompactVnd, formatVoucherBadge, pctText, shipSupportText, voucherCustomerTitle, voucherScopeHint, voucherUseHref } from "@/lib/voucherFormat";
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
  return <article className={`min-w-0 shrink-0 overflow-hidden border border-rose-200 bg-white ${popup ? "rounded-2xl px-4 py-3 text-center shadow-md" : "flex min-h-[100px] rounded-xl text-left shadow-xs"}`}>
    {!popup && <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-dashed border-rose-200 bg-rose-50 text-[#FE2C55]">
      <TicketPercent size={20} aria-hidden /><span className="mt-1 text-center text-[9px] font-semibold">Sản phẩm</span>
    </div>}
    <div className={`min-w-0 flex-1 ${popup ? "" : "px-2.5 py-2"}`}>
      <h4 title={voucherCustomerTitle(v.title, v)} className="line-clamp-2 text-xs font-bold leading-4 text-slate-900">{cleanVoucherTitle(v)}</h4>
      <p className={`mt-0.5 font-black leading-6 text-[#FE2C55] ${popup ? "text-xl" : "text-lg"}`}>Giảm {v.discountType === "percentage" ? pctText(v) : `${formatCompactVnd(v.discountValue).toUpperCase()}đ`}</p>
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

  const rawTitle = v.title ? voucherCustomerTitle(v.title, v) : "";
  const displayTitle = ship
    ? (v.title && /ship|vận chuyển/i.test(v.title) ? voucherCustomerTitle(v.title, v) : shipSupportText(v))
    : (rawTitle || formatVoucherBadge({ ...v, maxDiscountVnd: undefined, minOrderThreshold: undefined }).label);

  const tooltipTitle = ship
    ? `Hỗ trợ phí ship ${v.discountType === "fixed" ? formatVnd(v.discountValue) : pctText(v)}`
    : displayTitle;

  const action = "inline-flex min-h-[28px] shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-bold tracking-tight transition-all select-none cursor-pointer";

  return (
    <article
      title={tooltipTitle}
      className="group relative flex min-h-[72px] min-w-0 shrink-0 items-stretch overflow-hidden rounded-xl bg-white text-left shadow-xs ring-1 ring-black/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-black/[0.12]"
    >
      {/* CUỐNG VÉ BÊN TRÁI (TICKET STUB) CHUẨN SHOPEE */}
      <div
        className={`relative flex w-12 sm:w-14 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed ${
          ship
            ? "border-teal-200/90 bg-teal-50/80 text-teal-700"
            : "border-rose-200/90 bg-rose-50/80 text-[var(--campaign-primary,#C8102E)]"
        } px-1 text-center`}
      >
        {/* Rãnh khuyết vé tròn phía trên (Top Ticket Notch) */}
        <span
          className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 h-3 w-3 rounded-full bg-[var(--campaign-cream,#FFF0F5)] ring-1 ring-black/[0.08]"
          aria-hidden="true"
        />
        {/* Rãnh khuyết vé tròn phía dưới (Bottom Ticket Notch) */}
        <span
          className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10 h-3 w-3 rounded-full bg-[var(--campaign-cream,#FFF0F5)] ring-1 ring-black/[0.08]"
          aria-hidden="true"
        />

        {ship ? (
          <Truck size={17} strokeWidth={2.3} aria-hidden />
        ) : (
          <TicketPercent size={17} strokeWidth={2.3} aria-hidden />
        )}
        <span className="text-[9px] font-black uppercase tracking-tight leading-none">
          {ship ? "Vận chuyển" : "Sản phẩm"}
        </span>
      </div>

      {/* THÂN VÉ NỀN TRẮNG TINH KHIẾT (MAIN BODY) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 bg-white">
        <p className="line-clamp-2 text-xs font-bold leading-4 text-slate-900 group-hover:text-[var(--campaign-primary,#C8102E)] transition-colors">
          {displayTitle}
        </p>
        {v.minLeadDays && v.minLeadDays >= 3 ? (
          <p className="text-[10px] leading-3 font-semibold text-emerald-700">
            Áp dụng khi chọn Chờ giao sau {v.minLeadDays} ngày
          </p>
        ) : null}
        {ship && (v.minOrderThreshold || 0) > 0 ? (
          <p className="text-[10px] leading-3 font-medium text-slate-500">
            Đơn từ {formatVnd(v.minOrderThreshold!)}
          </p>
        ) : null}
        {scope ? (
          <Link
            href={voucherUseHref(v.id)}
            onClick={onProducts}
            aria-label="Xem sản phẩm áp dụng"
            className="mt-0.5 w-fit text-[10.5px] font-semibold text-[var(--campaign-primary,#C8102E)] hover:underline underline-offset-2"
          >
            Sản phẩm áp dụng ›
          </Link>
        ) : null}
      </div>

      {/* KHỐI NÚT ACTION BÊN PHẢI */}
      <div className="my-auto mr-2.5 sm:mr-3 shrink-0">
        {canClaim ? (
          <button
            type="button"
            disabled={pending}
            onClick={onClaim}
            className={`${action} ${
              ship
                ? "bg-[#0F766E] hover:bg-[#0D655E] text-white shadow-xs"
                : "bg-gradient-to-r from-[var(--campaign-primary,#C8102E)] to-[#E11D48] text-white shadow-xs hover:brightness-110 active:scale-95"
            } disabled:opacity-50`}
          >
            {pending ? "Đang lưu…" : "Lưu mã"}
          </button>
        ) : usable ? (
          <Link
            href={voucherUseHref(v.id)}
            onClick={onProducts}
            className={`${action} ${
              ship
                ? "border border-teal-300 bg-teal-50/70 text-teal-700 hover:bg-teal-100"
                : "border border-rose-200 bg-rose-50/80 text-[var(--campaign-primary,#C8102E)] hover:bg-rose-100"
            }`}
          >
            Dùng
          </Link>
        ) : (
          <span className={`${action} bg-slate-100 text-slate-400 font-medium cursor-not-allowed`}>
            {state === "soldOut" ? "Hết lượt" : state === "upcoming" ? "Sắp mở" : "Không áp dụng"}
          </span>
        )}
      </div>
    </article>
  );
}
