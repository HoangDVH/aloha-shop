"use client";

import { Gift, Lock, Zap } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { CountdownText } from "@/components/campaign/CountdownText";
import { isPromoSelling, promoAnchorPrice } from "@/components/campaign/CardPromo";
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
  onBuyNow?: () => void;
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

/** Quà tặng đi kèm chiến dịch: kiểu badge gọn gàng chuẩn sàn TMĐT */
function GiftList({ promo }: { promo: CampaignPromoUI }) {
  const gifts = promo.gifts ?? [];
  if (gifts.length < 2) {
    if (!promo.giftLabel) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs font-semibold text-amber-900">
        <Gift size={15} className="shrink-0 text-amber-700" />
        <span>{promo.giftLabel}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3">
      <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
        <Gift size={15} className="text-amber-700" /> Tặng kèm {gifts.length} quà cho mỗi sản phẩm:
      </p>
      <ul className="mt-1.5 space-y-1 text-xs text-amber-950 font-medium pl-4 list-disc">
        {gifts.map((g) => (
          <li key={g.ma}>
            <span className="font-bold">{g.qty}</span> × {g.name}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-amber-800/80">Số lượng quà có hạn, quà nào hết sẽ ngừng tặng quà đó.</p>
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

  return (
    <section className="overflow-hidden rounded-2xl border border-rose-200/80 shadow-xs" aria-label="Ưu đãi chiến dịch">
      {/* 1. DẢI RIBBON HEADER (CHUẨN TMĐT: SHOPEE / LAZADA / TIKTOK SHOP) */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#C8102E] via-[#D32F2F] to-[#E53935] px-3.5 sm:px-4 py-2 sm:py-2.5 text-white">
        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-wider">
          <Zap size={15} aria-hidden className="fill-amber-300 text-amber-300 animate-pulse" />
          <span>{selling ? "Flash Sale" : view.campaign?.name || "Ưu Đãi Đặc Biệt"}</span>
        </span>
        {selling ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold">
            <span className="opacity-90">Kết thúc sau</span>
            <CountdownText
              target={Date.parse(promo.endsAt)}
              offsetMs={view.offsetMs}
              boxClass="rounded bg-black/35 px-1.5 py-0.5 font-mono font-bold text-amber-200 shadow-2xs"
            />
          </span>
        ) : opensAt ? (
          <span className="text-[11px] sm:text-xs font-bold bg-black/25 rounded-full px-2.5 py-0.5 text-amber-200">
            Mở bán {vnWhen(opensAt)}
          </span>
        ) : null}
      </div>

      {/* 2. THÂN KHỐI GIÁ & QUÀ TẶNG: NỀN HỮU CƠ TỰ NHIÊN, KHÔNG CHỨA NÚT MUA TRÙNG LẶP */}
      <div className="space-y-2.5 bg-gradient-to-b from-[#FFF5F3] to-[#FFFBF9] p-3 sm:p-4">
        {/* Dòng giá ưu đãi */}
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
          <span className="text-2xl sm:text-[1.85rem] font-black tracking-tight text-[#C8102E]">
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
            <span className="inline-flex items-center rounded-lg bg-[#FFE4E4] px-2 py-0.5 text-xs sm:text-sm font-black text-[#C8102E] border border-rose-200">
              -{discountPct}%
            </span>
          ) : null}
        </div>

        {/* Thông báo sắp mở bán nếu có */}
        {upcomingSale ? (
          <p className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-300/80 bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-950">
            <Zap size={13} aria-hidden className="fill-amber-600 text-amber-600" />
            Giá Flash Sale {formatVnd(promo.salePrice as number)}
            {opensAt ? ` · mở bán ${vnWhen(opensAt)}` : ""}
            <span className="font-medium text-amber-800">(đặt bây giờ tính giá thường)</span>
          </p>
        ) : null}

        {/* Danh sách quà tặng */}
        <GiftList promo={promo} />

        {/* Giới hạn số lượng mua */}
        {selling && promo.perCustomerLimit > 0 ? (
          <p className="text-[11px] text-slate-500 font-medium">
            * Mỗi khách hàng được mua tối đa {promo.perCustomerLimit} sản phẩm với giá ưu đãi này.
          </p>
        ) : null}

        {/* Thông báo tài khoản bị khóa nếu có */}
        {locked ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
            <Lock size={14} aria-hidden /> {lockText}
          </div>
        ) : null}
      </div>
    </section>
  );
}
