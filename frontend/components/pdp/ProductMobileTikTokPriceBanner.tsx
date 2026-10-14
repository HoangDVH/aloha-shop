"use client";

import { Zap } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { CountdownText } from "@/components/campaign/CountdownText";
import { isPromoSelling, promoAnchorPrice } from "@/components/campaign/CardPromo";
import { anchorDealProgress, flashDealProgress } from "@/lib/campaign/dealProgress";
import { stockMax } from "@/lib/cart";

type Props = {
  promo: CampaignPromoUI;
  dvt?: string;
  regularPrice?: number;
  webPrice?: number;
  ton?: number;
  allowBackorder?: boolean;
};

function vnWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Mobile TikTok Shop Promotional Price Banner (UI/UX chuẩn TikTok Shop).
 * Hiển thị full width trên mobile PDP cho sản phẩm ưu đãi:
 * - Vế trái: Nền đỏ hồng TikTok, badge -% giảm giá, giá khuyến mãi nổi bật, icon voucher vé, giá gốc gạch ngang.
 * - Vế phải: Nền cam cắt tia sét chớp, tiêu đề ⚡ Flash Sale, đếm ngược thời gian kết thúc hoặc mở bán.
 */
export function ProductMobileTikTokPriceBanner({
  promo,
  dvt,
  regularPrice,
  webPrice,
  ton,
  allowBackorder,
}: Props) {
  const view = useCampaignView();
  const selling = isPromoSelling(promo);
  const stock = stockMax(ton);
  const flash = selling
    ? flashDealProgress(promo, true, allowBackorder === false ? stock : null, Date.now(), stock)
    : anchorDealProgress(promo, stock, allowBackorder);
  const saleOpen = selling && !flash?.soldOut && promo.remaining !== 0;
  const hasSale = promo.salePrice != null && promo.salePrice < (promo.listPrice || regularPrice || Infinity);
  const anchor = promoAnchorPrice(promo, regularPrice || promo.listPrice);

  const regular = regularPrice || promo.listPrice || 0;
  const onSaleNow = saleOpen && hasSale;
  const current = onSaleNow ? (promo.salePrice as number) : regular;
  const listPrice = Math.max(promo.listPrice || 0, regularPrice || 0, webPrice || 0, onSaleNow ? 0 : anchor);
  const strike = listPrice > current ? listPrice : 0;
  const discountPct = strike ? Math.round(((strike - current) / strike) * 100) : 0;
  const opensAt = promo.opensAt || (promo.kind === "teaser" ? promo.endsAt : null);

  const titleText = selling
    ? "Flash Sale"
    : view.campaign?.name || "Flash Sale";

  return (
    <div
      className="relative flex h-[54px] w-full select-none items-stretch overflow-hidden bg-gradient-to-r from-[#FF1E44] via-[#FE2C55] to-[#FF2B54] shadow-xs"
      aria-label="Thanh giá ưu đãi Flash Sale TikTok Shop"
    >
      {/* VẾ TRÁI: GIÁ BÁN, BADGE GIẢM GIÁ & VÉ VOUCHER */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center py-1 pl-3.5 pr-2">
        <div className="flex items-center gap-1.5 flex-nowrap">
          {discountPct > 0 ? (
            <span className="shrink-0 rounded-[4px] bg-white px-1.5 py-0.5 text-xs font-black leading-none text-[#FE2C55] shadow-xs">
              -{discountPct}%
            </span>
          ) : null}

          <span className="truncate text-[21px] font-black tracking-tight text-white leading-none">
            {formatVnd(current)}
          </span>

          {/* Ticket/Coupon Icon (style TikTok Shop) */}
          <span className="inline-flex shrink-0 items-center text-white/95" title="Ưu đãi áp dụng">
            <svg
              className="h-3.5 w-4.5 shrink-0"
              viewBox="0 0 18 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M1 3C1 1.89543 1.89543 1 3 1H15C16.1046 1 17 1.89543 17 3V5C16.1716 5 15.5 5.67157 15.5 6.5C15.5 7.32843 16.1716 8 17 8V11C17 12.1046 16.1046 13 15 13H3C1.89543 13 1 12.1046 1 11V8C1.82843 8 2.5 7.32843 2.5 6.5C2.5 5.67157 1.82843 5 1 5V3Z" />
              <path d="M6 6.5L7.5 8L11.5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {/* Dòng phụ: Giá gốc gạch ngang */}
        {strike > current ? (
          <div className="mt-1 flex items-baseline gap-1 text-xs text-white/80 font-normal leading-none">
            <span className="line-through">{formatVnd(strike)}</span>
            {dvt ? <span className="text-[10px] text-white/60 font-normal">/ {dvt}</span> : null}
          </div>
        ) : dvt ? (
          <div className="mt-1 text-[11px] text-white/70 font-medium leading-none">
            / {dvt}
          </div>
        ) : null}
      </div>

      {/* VẾ PHẢI: NỀN CAM VỚI VẾT CẮT TIA SÉT & ĐẾM NGƯỢC */}
      <div className="relative flex shrink-0 flex-col justify-center items-end bg-gradient-to-r from-[#FF7A00] to-[#FF4E00] pl-6 pr-3.5 py-1 text-white">
        {/* Vết cắt tia sét nhọn chuyển tiếp giữa màu đỏ và màu cam */}
        <svg
          className="absolute -left-5 inset-y-0 h-full w-6 text-[#FF7A00] pointer-events-none"
          viewBox="0 0 24 56"
          preserveAspectRatio="none"
          fill="currentColor"
          aria-hidden="true"
        >
          {/* Bóng đổ tia sét vàng cam sáng như trong ảnh mẫu TikTok Shop */}
          <polygon
            points="6,0 16,0 9,28 16,28 0,56 4,32 0,32"
            fill="#FFB300"
            fillOpacity="0.85"
          />
          {/* Mảng cam chính hình tia sét nối với khối bên phải */}
          <polygon
            points="12,0 24,0 24,56 4,56 16,30 10,30"
            fill="currentColor"
          />
        </svg>

        {/* Dòng 1: Icon Zap + Tiêu đề Flash Sale */}
        <div className="relative z-10 flex items-center gap-1 leading-none">
          <Zap size={14} className="fill-white text-white shrink-0" aria-hidden />
          <span className="text-xs sm:text-sm font-black uppercase tracking-tight text-white">
            {titleText}
          </span>
        </div>

        {/* Dòng 2: Đếm ngược thời gian hoặc thông báo mở bán */}
        <div className="relative z-10 mt-1 flex items-center gap-1 leading-none">
          {selling && promo.endsAt ? (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-white/95">
              <span className="text-[10px] sm:text-[11px] text-white/85">Kết thúc sau</span>
              <CountdownText
                target={Date.parse(promo.endsAt)}
                offsetMs={view.offsetMs}
                className="font-mono font-bold tracking-tight text-white text-[11px]"
              />
            </div>
          ) : opensAt ? (
            <span className="text-[11px] font-bold text-white/95">
              Mở bán {vnWhen(opensAt)}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-white/90">
              Ưu đãi có hạn
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
