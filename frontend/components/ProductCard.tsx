"use client";

import Link from "next/link";
import { SiPriceBadge } from "@/components/si-pricing/SiPriceBadge";
import { Play, ShoppingBag } from "lucide-react";
import { ProductLinkPending } from "@/components/ProductLinkPending";
import { isPreOrderTon, useCart } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { canPurchaseZeroPrice } from "@/lib/testBuyer";
import {
  livePropsForMa,
  useLiveProductPrices,
} from "@/lib/useLiveProductPrices";
import { PromoCalmLine, PromoListPrice, isPromoPriceActive, promoAnchorPrice, promoDiscountPct } from "@/components/campaign/CardPromo";
import { ProductDealCard } from "@/components/campaign/ProductDealCard";

const MAX_IMAGE_BADGES = 2;

type CardBadge = { label: string; tone: "sale" | "warn" };

/** Nhãn trạng thái góc ảnh theo thứ tự ưu tiên; % giảm và quà nằm dưới giá, không đặt trên ảnh. */
export function cardStatusBadges(s: {
  preOrder: boolean;
  lowStock: boolean;
  manualBadge?: string;
  promoDeal: boolean;
  hasPromo: boolean;
}): CardBadge[] {
  const out: CardBadge[] = [];
  if (s.preOrder || s.manualBadge === "dat_truoc") out.push({ label: "ĐẶT\u00A0TRƯỚC", tone: "sale" });
  if (!s.preOrder && (s.lowStock || s.manualBadge === "ban_chay_sap_het" || s.manualBadge === "ban_chay")) {
    out.push({ label: "SẮP\u00A0HẾT", tone: "warn" });
  }
  if (!s.preOrder && s.manualBadge === "giam_gia" && !s.promoDeal) out.push({ label: "SALE", tone: "sale" });
  if (!s.preOrder && s.manualBadge === "uu_dai" && !s.hasPromo) out.push({ label: "ƯU\u00A0ĐÃI", tone: "sale" });
  return out;
}

type ProductCardProps = {
  product: ShopProduct;
  shopee?: boolean;
  discountOnImage?: boolean;
  largePrice?: boolean;
  variant?: "default" | "deal";
  /** Giá mới từ API prices — nếu có thì hiện thay product.gia */
  liveWebPrice?: number;
  liveGia?: number;
  liveTon?: number;
  livePriceKind?: ShopProduct["priceKind"];
  liveAllowBackorder?: boolean;
  liveCampaignPromo?: ShopProduct["campaignPromo"];
};

export function ProductCard({ variant = "default", ...props }: ProductCardProps) {
  if (variant === "deal") {
    return (
      <ProductDealCard
        product={props.product}
        liveWebPrice={props.liveWebPrice}
        liveGia={props.liveGia}
        liveTon={props.liveTon}
        livePriceKind={props.livePriceKind}
        liveAllowBackorder={props.liveAllowBackorder}
        liveCampaignPromo={props.liveCampaignPromo}
      />
    );
  }
  return <ProductCardDefault {...props} />;
}

function ProductCardDefault({
  product,
  shopee = false,
  discountOnImage = false,
  largePrice = false,
  liveWebPrice,
  liveGia,
  liveTon,
  livePriceKind,
  liveAllowBackorder,
  liveCampaignPromo,
}: Omit<ProductCardProps, "variant">) {
  const add = useCart((s) => s.add);
  const toast = useToast();
  const { user } = useShopAuth();
  const displayTon = liveTon != null && Number.isFinite(liveTon) ? liveTon : product.ton;
  const preOrder = isPreOrderTon(displayTon);
  const lowStock = !preOrder && displayTon > 0 && displayTon <= 8;
  const manualBadge = product.webBadge;
  const priceKind = livePriceKind ?? product.priceKind;
  const expectsSi = user?.siStatus === "active" && user.roles.includes("si");
  const wholesalePricing = expectsSi || priceKind === "si" || priceKind === "si_missing";
  const promo = wholesalePricing ? null : liveCampaignPromo !== undefined ? liveCampaignPromo : product.campaignPromo;
  const promoSelling = isPromoPriceActive(promo);
  const baseGia = liveGia != null && liveGia >= 0 ? liveGia : product.gia;
  const displayGia = promoSelling && promo?.salePrice != null ? promo.salePrice : baseGia;
  const promoDeal = promoSelling || promoAnchorPrice(promo, displayGia) > 0;
  const allowBackorder = liveAllowBackorder ?? product.allowBackorder;
  const pricePending = Boolean(expectsSi) !== (priceKind === "si" || priceKind === "si_missing");
  const wholesaleCard = expectsSi && !pricePending && priceKind === "si" &&
    (user.siRegion === "HCM" || user.siRegion === "TINH");
  const webPrice = liveWebPrice ?? product.webPrice;
  const wholesaleDiscount = wholesaleCard && Number.isFinite(webPrice) && Number(webPrice) > displayGia && displayGia > 0
    ? Math.floor(((Number(webPrice) - displayGia) / Number(webPrice)) * 100)
    : 0;
  const imageDiscount = wholesaleDiscount || (discountOnImage && promo ? promoDiscountPct(promo, displayGia) : 0);
  const zeroPriceBlocked = priceKind === "si_missing" || (!(displayGia > 0) && !canPurchaseZeroPrice(user?.email));
  const purchaseBlocked = pricePending || zeroPriceBlocked || (preOrder && allowBackorder === false);

  const onAdd = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (purchaseBlocked) {
      toast.push("Sản phẩm này chưa mở bán");
      return;
    }
    const r = add({ ...product, gia: displayGia, ton: displayTon, priceKind, allowBackorder }, 1);
    if (!r.ok) {
      toast.push(
        r.max === 0 && !r.preOrder
          ? `“${product.ten}” đã hết hàng`
          : `Chỉ còn ${r.max} ${product.dvt || "sản phẩm"} — giỏ đã đủ số này`
      );
      return;
    }
    toast.push(
      r.preOrder
        ? "Đã thêm yêu cầu đặt trước — chờ Aloha xác nhận"
        : r.capped
          ? `Đã thêm tối đa ${r.qty} ${product.dvt || ""} (hết tồn kho)`
          : `Đã thêm “${product.ten}” vào giỏ`,
      {
        href: "/gio-hang",
        hrefLabel: "Xem giỏ hàng",
      }
    );
  };

  const hasVideo =
    (Array.isArray(product.videos) && product.videos.length > 0) ||
    Boolean(String(product.videoUrl || "").trim());

  const addBtn = purchaseBlocked ? null : (
    <button
      type="button"
      onClick={onAdd}
      className="product-card__add"
      aria-label={
        preOrder
          ? `Đặt trước ${product.ten}`
          : `Thêm ${product.ten} vào giỏ`
      }
    >
      <ShoppingBag size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
      <span className="product-card__add-label">
        {preOrder ? "Đặt trước" : "Thêm vào giỏ"}
      </span>
    </button>
  );

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-black/[0.06] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-black/[0.1] animate-fade-up"
    >
      <div className="relative">
        <Link
          href={product.path || (product.ma ? `/tim?q=${encodeURIComponent(product.ma)}` : "#")}
          className="relative block aspect-square w-full overflow-hidden bg-neutral-50"
        >
          {product.anh ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.anh}
              alt={product.ten}
              className={`h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105`}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--aloha-muted)]">
              <ShoppingBag size={28} strokeWidth={1.25} className="opacity-40" />
              <span className="text-xs">Chưa có ảnh</span>
            </div>
          )}

          {hasVideo ? (
            <span
              className="product-card__video-badge pointer-events-none absolute bottom-2 right-2 z-[15] inline-flex h-[1.65rem] w-[1.65rem] items-center justify-center rounded-full bg-black/55 text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] sm:h-7 sm:w-7"
              title="Có video"
              aria-label="Sản phẩm có video"
            >
              <Play
                size={12}
                className="ml-[1px] fill-white sm:h-[13px] sm:w-[13px]"
                strokeWidth={0}
                aria-hidden
              />
            </span>
          ) : null}

          <ProductLinkPending overlay />
        </Link>

        {imageDiscount > 0 ? (
          <span className="pointer-events-none absolute right-0 top-1.5 z-10 rounded-l-md bg-[#E53935] py-0.5 pl-2 pr-1.5 text-[10px] font-black text-white shadow-xs sm:text-[11px]">
            -{imageDiscount}%
          </span>
        ) : null}

        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          {cardStatusBadges({ preOrder, lowStock, manualBadge, promoDeal, hasPromo: Boolean(promo) })
            .slice(0, MAX_IMAGE_BADGES)
            .map((b) => (
              <span
                key={b.label}
                className={`product-card__badge inline-flex h-5 w-max max-w-none shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold leading-none tracking-normal text-white shadow-sm whitespace-nowrap [word-break:keep-all] [overflow-wrap:normal] ${
                  b.tone === "warn" ? "bg-[var(--aloha-warning,#f59e0b)]" : "bg-[var(--aloha-sale,#E53935)]"
                }`}
              >
                {b.label}
              </span>
            ))}
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${shopee ? "gap-1 p-2 sm:p-2.5" : "gap-1.5 p-2.5 sm:p-3"}`}>
        <Link
          href={product.path || (product.ma ? `/tim?q=${encodeURIComponent(product.ma)}` : "#")}
          className={`line-clamp-2 font-medium leading-snug text-neutral-800 transition-colors group-hover:text-[var(--aloha-green)] ${
            shopee
              ? "min-h-[2.1rem] sm:min-h-[2.35rem] text-[12px] sm:text-[13px]"
              : "min-h-[2.4rem] text-sm"
          }`}
        >
          {product.ten}
          <ProductLinkPending />
        </Link>

        <div className={`mt-auto flex items-end justify-between gap-1 pt-0.5 ${wholesaleCard ? "items-center" : "items-end"}`}>
          <div className="min-w-0 flex-1">
          {expectsSi && !pricePending && priceKind === "si" ? (
            <SiPriceBadge price={displayGia} webPrice={webPrice} unit={product.dvt} variant={wholesaleCard ? "wholesale-card" : "card"} largePrice={largePrice} />
          ) : (
          <div className="flex min-w-0 flex-col justify-end">
            <div
              className={`min-w-0 break-words font-extrabold tracking-tight ${
                promoDeal || shopee ? "text-[#EE4D2D]" : "text-[var(--aloha-price)]"
              } ${largePrice ? "flex h-5 items-baseline whitespace-nowrap text-[18px] leading-5 sm:h-6 sm:text-[22px] sm:leading-6 [&>span]:min-w-0 [&>span]:truncate [&>span]:text-[12px] sm:[&>span]:text-[13px]" : shopee ? "text-sm sm:text-base" : "text-base sm:text-lg"}`}
            >
              {pricePending ? "Đang cập nhật…" : priceKind === "si_missing" ? "Liên hệ" : formatVnd(displayGia)}
              {promo ? <PromoListPrice promo={promo} price={displayGia} /> : null}
              {product.dvt && !promoDeal ? (
                <span
                  className={`ml-1 font-normal text-neutral-400 ${
                    shopee ? "text-[10px] sm:text-[11px]" : "text-xs"
                  }`}
                >
                  / {product.dvt}
                </span>
              ) : null}
            </div>
            {promo ? <PromoCalmLine promo={promo} price={displayGia} showDiscount={!discountOnImage} /> : null}
          </div>
          )}
          </div>
          {!purchaseBlocked ? (
            <div className={`product-card__add-wrap shrink-0 ${wholesaleCard ? "!mt-0 self-center" : "self-end"}`}>{addBtn}</div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  shopee = false,
  discountOnImage = false,
  largePrice = false,
  /** Trang chủ: 6 SP / hàng (desktop), giữ card nhỏ gọn */
  homeRow6 = false,
  variant = "default",
  columns,
}: {
  products: ShopProduct[];
  shopee?: boolean;
  discountOnImage?: boolean;
  largePrice?: boolean;
  homeRow6?: boolean;
  variant?: "default" | "deal";
  columns?: 4 | 5 | 6;
}) {
  const liveMap = useLiveProductPrices(products);

  if (!products.length) {
    return (
      <p className="rounded-2xl bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm ring-1 ring-black/[0.04]">
        Chưa có sản phẩm phù hợp. Thử bỏ bớt bộ lọc hoặc chọn danh mục khác.
      </p>
    );
  }

  const colMode = columns ?? (homeRow6 ? 6 : variant === "deal" ? 4 : 5);

  const gridClass =
    colMode === 6
      ? "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 md:gap-2.5 lg:grid-cols-6 lg:gap-2.5"
      : colMode === 4
        ? "grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-3.5"
        : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-3";

  return (
    <div className={gridClass}>
      {products.map((p) => (
        <ProductCard
          key={p.ma}
          product={p}
          variant={variant}
          largePrice={largePrice}
          discountOnImage={discountOnImage}
          shopee={shopee || homeRow6 || colMode === 6 || variant === "deal"}
          {...livePropsForMa(liveMap, p.ma)}
        />
      ))}
    </div>
  );
}
