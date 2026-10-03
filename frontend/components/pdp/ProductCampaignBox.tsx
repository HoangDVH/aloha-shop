"use client";

import { Gift, Lock, ShoppingCart, Zap } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { CountdownText } from "@/components/campaign/CountdownText";
import { isPromoSelling, promoAnchorPrice } from "@/components/campaign/CardPromo";
import { FlashSaleBar } from "@/components/campaign/FlashSaleBar";
import { anchorDealProgress, flashDealProgress } from "@/lib/campaign/dealProgress";
import { stockMax } from "@/lib/cart";

type Props = {
  ma: string;
  promo: CampaignPromoUI | null | undefined;
  dvt?: string;
  regularPrice?: number;
  webPrice?: number;
  ton?: number;
  allowBackorder?: boolean;
  onBuyNow: () => void;
  onAddCart?: () => void;
  purchaseDisabled?: boolean;
  isPreOrder?: boolean;
};

function vnWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 1 quà: 1 dòng như cũ; nhiều quà: liệt kê từng quà (số lượng tặng theo mỗi sản phẩm mua). */
function GiftList({ promo }: { promo: CampaignPromoUI }) {
  const gifts = promo.gifts ?? [];
  if (gifts.length < 2) {
    if (!promo.giftLabel) return null;
    return (
      <p className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
        <Gift size={13} aria-hidden /> {promo.giftLabel}
      </p>
    );
  }
  return (
    <div className="rounded-lg bg-amber-50 px-2.5 py-2 ring-1 ring-amber-200">
      <p className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
        <Gift size={13} aria-hidden /> Tặng kèm {gifts.length} quà cho mỗi sản phẩm
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
        {gifts.map((g) => (
          <li key={g.ma} className="flex gap-1.5">
            <span aria-hidden>•</span>
            <span>
              <b>{g.qty}</b> × {g.name}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-amber-700">Số lượng quà có hạn, quà nào hết sẽ ngừng tặng quà đó.</p>
    </div>
  );
}

export function ProductCampaignBox({
  promo,
  dvt,
  regularPrice,
  webPrice,
  ton,
  allowBackorder,
  onBuyNow,
  onAddCart,
  purchaseDisabled,
  isPreOrder,
}: Props) {
  const view = useCampaignView();
  if (!promo) return null;
  const selling = isPromoSelling(promo);
  const stock = stockMax(ton);
  const flash = selling
    ? flashDealProgress(promo, true, allowBackorder === false ? stock : null, Date.now(), stock)
    : anchorDealProgress(promo, stock, allowBackorder);
  const saleOpen = selling && !flash?.soldOut && promo.remaining !== 0;
  const hasSale = promo.salePrice != null && promo.salePrice < (promo.listPrice || regularPrice || Infinity);
  const anchor = promoAnchorPrice(promo, regularPrice || promo.listPrice);
  if (!selling && !hasSale && !anchor && !promo.giftLabel && !(promo.gifts && promo.gifts.length > 0)) return null;
  const viewer = view.viewer;
  const locked = Boolean(viewer && viewer.loggedIn && !viewer.canUse);
  const lockText = viewer?.lockReason === "account_locked" ? "Tài khoản bị khoá" : "Dành cho khách lẻ";

  // Giá chính = giá khách trả nếu đặt ngay: giá sale chỉ khi đang trong khung và còn suất, ngoài ra giá thường.
  const regular = regularPrice || promo.listPrice || 0;
  const onSaleNow = saleOpen && hasSale;
  const current = onSaleNow ? (promo.salePrice as number) : regular;
  const listPrice = Math.max(promo.listPrice || 0, regularPrice || 0, webPrice || 0, onSaleNow ? 0 : anchor);
  const strike = listPrice > current ? listPrice : 0;
  const discountPct = strike ? Math.round(((strike - current) / strike) * 100) : 0;
  const opensAt = promo.opensAt || (promo.kind === "teaser" ? promo.endsAt : null);
  const upcomingSale = !selling && hasSale;
  const dealOpen = !selling && anchor > 0;

  return (
    <section className="overflow-hidden rounded-2xl ring-1 ring-red-200/80 shadow-xs" aria-label="Ưu đãi chiến dịch">
      <div className="flex items-center justify-between gap-2 bg-[#C8102E] px-3.5 py-2 text-white">
        <span className="inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-wide">
          <Zap size={15} aria-hidden className="fill-white" />
          {selling ? "Flash Sale" : view.campaign?.name || "Ưu đãi"}
        </span>
        {selling ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
            Kết thúc sau
            <CountdownText target={Date.parse(promo.endsAt)} offsetMs={view.offsetMs} boxClass="rounded bg-black/25 px-1.5 py-0.5" />
          </span>
        ) : opensAt ? (
          <span className="text-[11px] font-semibold bg-black/20 rounded-full px-2 py-0.5">Mở bán {vnWhen(opensAt)}</span>
        ) : null}
      </div>
      <div className="space-y-2.5 bg-red-50/50 p-3 sm:p-3.5">
        {/* HÀNG GIÁ GỘP VÀO KHUNG (CÙNG NẰM TRÊN MỘT HÀNG CÓ PHẦN TRĂM GIỐNG CARD SẢN PHẨM) */}
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-2.5">
          <span className="text-2xl sm:text-[1.75rem] font-black tracking-tight text-[#C8102E]">
            {formatVnd(current)}
          </span>
          {dvt ? (
            <span className="text-sm sm:text-base font-semibold text-slate-500">
              / {dvt}
            </span>
          ) : null}
          {strike ? (
            <span className="text-sm sm:text-base font-medium text-slate-400 line-through">
              {formatVnd(strike)}
            </span>
          ) : null}
          {discountPct > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[#FFF0F0] px-2 py-0.5 text-xs sm:text-sm font-bold text-[#C8102E] border border-red-200">
              -{discountPct}%
            </span>
          ) : null}
        </div>
        {upcomingSale ? (
          <p className="inline-flex flex-wrap items-center gap-1 rounded-md border border-amber-200/80 bg-amber-100/90 px-2 py-1 text-xs font-bold text-amber-900">
            <Zap size={12} aria-hidden className="fill-amber-500 text-amber-500" />
            Giá Flash Sale {formatVnd(promo.salePrice as number)}
            {opensAt ? ` · mở bán ${vnWhen(opensAt)}` : ""}
            <span className="font-medium text-amber-800">(đặt bây giờ tính giá thường)</span>
          </p>
        ) : null}

        {flash ? <FlashSaleBar p={flash} /> : null}
        <GiftList promo={promo} />
        {selling && promo.perCustomerLimit > 0 ? (
          <p className="text-[11px] text-slate-500">Tối đa {promo.perCustomerLimit} sản phẩm giá sale mỗi khách.</p>
        ) : null}
        {locked ? (
          <button type="button" disabled className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-200 text-sm font-bold text-slate-500">
            <Lock size={14} aria-hidden /> {lockText}
          </button>
        ) : saleOpen || dealOpen ? (
          <div className="flex gap-2 sm:gap-3 items-center pt-0.5">
            {onAddCart ? (
              <button
                type="button"
                disabled={purchaseDisabled}
                onClick={onAddCart}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-[#C8102E] bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-[#C8102E] hover:bg-red-50 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 transition shadow-2xs"
              >
                <ShoppingCart size={15} />
                <span>{isPreOrder ? "Đặt trước" : "Thêm giỏ hàng"}</span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={purchaseDisabled}
              onClick={onBuyNow}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C8102E] to-[#E53935] px-3 py-2.5 text-xs sm:text-sm font-black text-white hover:brightness-105 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 transition shadow-xs"
            >
              <Zap size={14} aria-hidden className="fill-white" />
              <span>{saleOpen ? "Mua Ngay Giờ Vàng" : isPreOrder ? "Đặt trước ngay" : "Mua ngay"}</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
