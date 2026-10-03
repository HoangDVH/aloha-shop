"use client";

import { Gift, Zap } from "lucide-react";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { discountTagText, formatCompactVnd } from "@/lib/voucherFormat";
import { formatVnd } from "@/lib/api";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { anchorDealProgress, flashDealProgress } from "@/lib/campaign/dealProgress";
import { CountdownText } from "./CountdownText";

/** Đang bán giá sale thật (khung giờ mở). Còn lại chỉ là nhãn báo trước. */
export function isPromoSelling(p: CampaignPromoUI | null | undefined): boolean {
  return Boolean(p && p.kind === "flash" && p.slotOpen && p.salePrice != null && p.salePrice < p.listPrice);
}

/** Khung giờ mở nhưng hết suất: giỏ hàng tính giá thường nên thẻ cũng phải về giá thường. */
export function isPromoSoldOut(p: CampaignPromoUI | null | undefined): boolean {
  return isPromoSelling(p) && p?.remaining === 0;
}

/** Giá sale đang áp dụng thật cho đơn mới. */
export function isPromoPriceActive(p: CampaignPromoUI | null | undefined): boolean {
  return isPromoSelling(p) && !isPromoSoldOut(p);
}

/** Giá trước KM để gạch ngang khi không bán giá sale; `price` = giá khách đang thấy (mặc định giá web). */
export function promoAnchorPrice(p: CampaignPromoUI | null | undefined, price?: number): number {
  if (!p || isPromoPriceActive(p)) return 0;
  const anchor = Number(p.compareAtPrice) || 0;
  return anchor > (price ?? p.listPrice) ? anchor : 0;
}

function vnTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Nhãn góc ảnh: "-38%" / "Giảm 150K" khi đang bán, "Quà tặng" khi kèm quà. */
export function PromoBadge({ promo }: { promo: CampaignPromoUI }) {
  const anchor = promoAnchorPrice(promo);
  const tag = isPromoPriceActive(promo)
    ? discountTagText(promo.listPrice, promo.salePrice as number)
    : anchor
      ? discountTagText(anchor, promo.listPrice)
      : "";
  const giftCount = promo.gifts?.length ?? 0;
  return (
    <>
      {tag ? (
        <span className="product-card__badge inline-flex h-5 w-max items-center gap-0.5 rounded-full bg-[#C8102E] px-2 text-[10px] font-black leading-none text-white shadow-sm whitespace-nowrap">
          <Zap size={10} aria-hidden className="fill-white" />
          {tag}
        </span>
      ) : null}
      {promo.giftLabel ? (
        <span className="product-card__badge inline-flex h-5 w-max items-center gap-0.5 rounded-full bg-amber-500 px-2 text-[10px] font-bold leading-none text-white shadow-sm whitespace-nowrap">
          <Gift size={10} aria-hidden />
          {giftCount > 1 ? `${giftCount} quà tặng` : "Quà tặng"}
        </span>
      ) : null}
    </>
  );
}

/**
 * Dòng dưới giá, cùng chiều cao với chỗ trống của card thường để lưới không lệch:
 * đang bán → thanh "Đã bán" + đếm ngược; chưa mở → "Giá sale 124K lúc 09:00".
 */
export function PromoMetaLine({ promo, stock = null, allowBackorder }: { promo: CampaignPromoUI; stock?: number | null; allowBackorder?: boolean }) {
  const { offsetMs } = useCampaignView();
  const cap = allowBackorder === false ? stock : null;
  const flash = isPromoSelling(promo) ? flashDealProgress(promo, true, cap, Date.now(), stock) : anchorDealProgress(promo, stock, allowBackorder);
  if (flash?.state === "low") {
    return (
      <div className="mt-0.5 flex h-[1.05rem] items-center gap-1.5 text-[10px] font-bold text-[#C8102E]">
        <span className="min-w-0 flex-1 truncate animate-pulse">🔥 {flash.left}</span>
        <span className="shrink-0">{flash.right}</span>
      </div>
    );
  }
  if (isPromoSoldOut(promo) || flash?.soldOut) {
    return (
      <div className="mt-0.5 h-[1.05rem] truncate text-[10px] font-semibold text-slate-500">
        Đã hết suất giá sale · Về giá thường
      </div>
    );
  }
  if (flash) {
    return (
      <div className="mt-0.5 flex h-[1.05rem] items-center gap-1.5 text-[10px] font-semibold text-[#C8102E]">
        {flash.state === "selling" ? (
          <>
            <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-red-100" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-full bg-[#C8102E]" style={{ width: `${Math.max(flash.pct, 6)}%` }} />
            </span>
            <span className="shrink-0">{flash.right || flash.left}</span>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">🔥 {flash.left}</span>
            {isPromoSelling(promo) ? (
              <CountdownText target={Date.parse(promo.endsAt)} offsetMs={offsetMs} className="shrink-0" />
            ) : flash.right ? (
              <span className="shrink-0">{flash.right}</span>
            ) : null}
          </>
        )}
      </div>
    );
  }
  if (promo.salePrice != null && promo.salePrice < promo.listPrice) {
    const when = promo.opensAt ? ` lúc ${vnTime(promo.opensAt)}` : "";
    return (
      <div className="mt-0.5 h-[1.05rem] truncate text-[10px] font-semibold text-[#C8102E]">
        Giá sale {formatCompactVnd(promo.salePrice).toUpperCase()}
        {when}
      </div>
    );
  }
  return <div className="mt-0.5 h-[1.05rem]" aria-hidden />;
}

/** Giá gạch ngang cạnh giá sale. */
export function PromoListPrice({ promo, price }: { promo: CampaignPromoUI; price?: number }) {
  const struck = isPromoPriceActive(promo) ? promo.listPrice : promoAnchorPrice(promo, price);
  if (!struck) return null;
  return <span className="ml-1 text-[10px] font-medium text-slate-400 line-through">{formatVnd(struck)}</span>;
}
