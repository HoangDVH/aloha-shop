"use client";

import { Gift } from "lucide-react";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { formatVnd } from "@/lib/api";

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

/** % giảm so với giá gạch (giá sale đang bán hoặc giá gạch chiến dịch); 0 = không giảm. */
export function promoDiscountPct(promo: CampaignPromoUI, price?: number): number {
  const selling = isPromoPriceActive(promo);
  const from = selling ? promo.listPrice : promoAnchorPrice(promo, price);
  const to = selling ? (promo.salePrice as number) : (price ?? promo.listPrice);
  if (!(from > 0) || !(to < from)) return 0;
  return Math.round(((from - to) / from) * 100);
}

/**
 * Dòng dưới giá cho thẻ ở trang thường (danh mục, tìm kiếm): chip "-18%" + "2 quà tặng".
 * Không thanh tiến độ, không nhấp nháy — hiệu ứng gấp chỉ dành cho trang ưu đãi / flash sale.
 */
export function PromoCalmLine({ promo, price }: { promo: CampaignPromoUI; price?: number }) {
  const pct = promoDiscountPct(promo, price);
  const giftCount = promo.giftLabel ? promo.gifts?.length || 1 : 0;
  if (!pct && !giftCount) return <div className="mt-0.5 h-[1.05rem]" aria-hidden />;
  return (
    <div className="mt-0.5 flex h-[1.05rem] min-w-0 items-center gap-1.5 text-[10px] font-semibold">
      {pct ? (
        <span className="shrink-0 rounded-sm bg-[#FDECEE] px-1 leading-[1rem] text-[#C8102E]">-{pct}%</span>
      ) : null}
      {giftCount ? (
        <span className="inline-flex min-w-0 items-center gap-0.5 truncate text-amber-700">
          <Gift size={11} aria-hidden className="shrink-0" />
          <span className="truncate">{giftCount > 1 ? `${giftCount} quà tặng` : "Quà tặng"}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Giá gạch ngang cạnh giá sale. */
export function PromoListPrice({ promo, price }: { promo: CampaignPromoUI; price?: number }) {
  const struck = isPromoPriceActive(promo) ? promo.listPrice : promoAnchorPrice(promo, price);
  if (!struck) return null;
  return <span className="ml-1 text-[10px] font-medium text-slate-400 line-through">{formatVnd(struck)}</span>;
}
