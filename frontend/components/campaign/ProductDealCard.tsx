"use client";

import Link from "next/link";
import { Loader2, Play, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isPreOrderTon, stockMax } from "@/lib/cart";
import { formatVnd, type ShopProduct } from "@/lib/api";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { isPromoSelling, promoAnchorPrice } from "@/components/campaign/CardPromo";
import { anchorDealProgress, flashDealProgress } from "@/lib/campaign/dealProgress";
import { FlashSaleBar } from "@/components/campaign/FlashSaleBar";
import { useCampaignView } from "@/lib/campaign/useCampaignView";
import { shipSupportFor } from "@/lib/campaign/voucherPrice";
import { formatCompactVnd } from "@/lib/voucherFormat";
import { canPurchaseZeroPrice } from "@/lib/testBuyer";
import { firstFileVideo } from "@/lib/campaign/productVideo";
import { DealQuickAdd } from "./DealQuickAdd";
import { DealGiftBox } from "./DealGiftBox";
import { DealCardVideo } from "./DealCardVideo";

const RANK_STYLE = [
  "from-[#FFD54F] to-[#F59E0B] text-[#5B3A00]",
  "from-[#E5E7EB] to-[#9CA3AF] text-[#1F2937]",
  "from-[#F4B183] to-[#B45309] text-white",
];

function ImagePendingOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
      <Loader2 className="h-7 w-7 animate-spin text-[var(--aloha-green,#2D5A27)]" aria-hidden />
    </span>
  );
}

export function ProductDealCard({
  product,
  liveWebPrice,
  liveGia,
  liveTon,
  livePriceKind,
  liveAllowBackorder,
  liveCampaignPromo,
  rank,
  soldCount,
}: {
  product: ShopProduct;
  liveWebPrice?: number;
  liveGia?: number;
  liveTon?: number;
  livePriceKind?: ShopProduct["priceKind"];
  liveAllowBackorder?: boolean;
  liveCampaignPromo?: ShopProduct["campaignPromo"];
  /** Hạng 1–3 trong "Bán chạy nhất" (huy hiệu góc ảnh). */
  rank?: number;
  /** Số đã bán thật trong chiến dịch (server đã lọc số quá nhỏ). */
  soldCount?: number;
}) {
  const pathname = usePathname();
  const { user } = useShopAuth();
  const imageRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  const displayTon = liveTon != null && Number.isFinite(liveTon) ? liveTon : product.ton;
  const preOrder = isPreOrderTon(displayTon);
  const [navPending, setNavPending] = useState(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const promo = liveCampaignPromo !== undefined ? liveCampaignPromo : product.campaignPromo;
  const allowBackorder = liveAllowBackorder ?? product.allowBackorder;
  const flash =
    flashDealProgress(promo, isPromoSelling(promo), allowBackorder === false ? stockMax(displayTon) : null, Date.now(), stockMax(displayTon)) ??
    anchorDealProgress(promo, stockMax(displayTon), allowBackorder);
  const promoSelling = isPromoSelling(promo) && !flash?.soldOut;
  const baseGia = liveGia != null && liveGia >= 0 ? liveGia : product.gia;
  const displayGia = promoSelling && promo?.salePrice != null ? promo.salePrice : baseGia;
  const priceKind = livePriceKind ?? product.priceKind;

  const expectsSi = user?.siStatus === "active" && user.roles.includes("si");
  const pricePending = Boolean(expectsSi) !== (priceKind === "si" || priceKind === "si_missing");
  const webPrice = liveWebPrice ?? product.webPrice;

  // Giá gạch chỉ khi có giá thật cao hơn (giá trước khuyến mãi / giá web); không có thì không gạch.
  let listPrice = 0;
  const anchor = promoSelling ? 0 : promoAnchorPrice(promo, displayGia);
  if (anchor) {
    listPrice = anchor;
  } else if (promo?.listPrice && promo.listPrice > displayGia) {
    listPrice = promo.listPrice;
  } else if (webPrice && webPrice > displayGia) {
    listPrice = webPrice;
  }

  const discountPct = listPrice > displayGia ? Math.round(((listPrice - displayGia) / listPrice) * 100) : 0;

  const { vouchers, viewer, offsetMs } = useCampaignView();
  const priceKnown = !pricePending && priceKind !== "si_missing" && priceKind !== "si";
  const shipSupport = priceKnown ? shipSupportFor(displayGia, vouchers, viewer, Date.now() + offsetMs) : 0;

  const zeroPriceBlocked = priceKind === "si_missing" || (!(displayGia > 0) && !canPurchaseZeroPrice(user?.email));
  const purchaseBlocked = pricePending || zeroPriceBlocked || (preOrder && allowBackorder === false);
  const cartProduct: ShopProduct = { ...product, gia: displayGia, ton: displayTon, priceKind, allowBackorder };
  const videoSrc = firstFileVideo(product);

  // SP flash sale dùng FlashSaleBar (số suất thật); SP thường chỉ hiện tình trạng tồn kho.
  let soldText = "";
  let remainingText = "";

  if (displayTon <= 0 && allowBackorder !== false) {
    soldText = "Nhận đặt trước";
    remainingText = "Aloha xác nhận";
  } else if (displayTon <= 3 && displayTon > 0) {
    soldText = `Chỉ còn ${displayTon} cây cuối!`;
    remainingText = "Sắp hết";
  } else if (displayTon > 0) {
    soldText = "Sẵn hàng";
    remainingText = `Còn ${displayTon}`;
  } else {
    soldText = "Hết hàng";
  }

  const clearNavTimer = () => {
    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearNavTimer();
    setNavPending(false);
  }, [pathname]);


  const markPending = (e?: React.MouseEvent) => {
    if (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
    }
    clearNavTimer();
    setNavPending(true);
    navTimerRef.current = setTimeout(() => {
      setNavPending(false);
      navTimerRef.current = null;
    }, 3000);
  };

  const hasVideo =
    (Array.isArray(product.videos) && product.videos.length > 0) ||
    Boolean(String(product.videoUrl || "").trim());

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-black/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(194,24,91,0.14)] motion-reduce:hover:translate-y-0"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      {/* 1. KHUNG ẢNH SẢN PHẨM */}
      <div ref={imageRef} className="relative aspect-square w-full overflow-hidden bg-[#F7F9F6]">
        <Link
          href={product.path}
          onClick={markPending}
          className={`block h-full w-full ${navPending ? "cursor-wait" : ""}`}
        >
          {product.anh ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.anh}
              alt={product.ten}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--aloha-muted)]">
              <span className="text-xs">Chưa có ảnh</span>
            </div>
          )}
        </Link>

        <DealCardVideo src={videoSrc} hovering={hovering} />

        {rank ? (
          <span
            className={`pointer-events-none absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-sm font-black shadow-md ring-2 ring-white ${RANK_STYLE[rank - 1] || RANK_STYLE[2]}`}
            aria-label={`Top ${rank} bán chạy`}
          >
            {rank}
          </span>
        ) : null}

        {discountPct > 0 ? (
          <span className="pointer-events-none absolute right-0 top-2 z-10 rounded-l-full bg-[#E53935] py-0.5 pl-2 pr-1.5 text-[11px] font-black text-white shadow-sm sm:text-xs">
            -{discountPct}%
          </span>
        ) : null}

        {hasVideo ? (
          <span
            className="pointer-events-none absolute bottom-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm"
            title="Có video"
          >
            <Play size={10} className="ml-0.5 fill-white" strokeWidth={0} aria-hidden />
          </span>
        ) : null}

        {purchaseBlocked ? null : <DealQuickAdd product={cartProduct} imageRef={imageRef} preOrder={preOrder} />}

        <ImagePendingOverlay active={navPending} />
      </div>

      {/* 2. NỘI DUNG CARD */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        {/* Tên sản phẩm */}
        <Link
          href={product.path}
          onClick={markPending}
          className={`line-clamp-1 font-bold text-sm sm:text-[15px] leading-snug text-neutral-900 transition-colors group-hover:text-[var(--aloha-green,#2D5A27)] ${
            navPending ? "cursor-wait" : ""
          }`}
        >
          {product.ten}
        </Link>

        {/* Hàng 3: Giá ưu đãi, giá gốc gạch ngang, % giảm */}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className="text-base sm:text-lg font-black tracking-tight text-[#E53935]">
            {pricePending ? "Đang cập nhật…" : priceKind === "si_missing" ? "Liên hệ" : formatVnd(displayGia)}
          </span>
          {listPrice > displayGia && (
            <span className="text-xs text-neutral-400 line-through">
              {formatVnd(listPrice)}
            </span>
          )}
        </div>

        {soldCount ? (
          <div className="mt-0.5 text-[11px] font-bold text-[#C2410C]">🔥 Đã bán {soldCount} trong đợt này</div>
        ) : null}

        {shipSupport > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 sm:text-[11px]">
              <Truck size={12} className="shrink-0" aria-hidden />
              Hỗ trợ ship {formatCompactVnd(shipSupport).toUpperCase()}
            </span>
          </div>
        ) : null}

        {/* Hàng 4: Thanh tiến độ suất flash sale / tình trạng tồn kho */}
        <div className="mt-2 text-[11px]">
          {flash ? (
            <FlashSaleBar p={flash} />
          ) : (
            <div className="flex items-center justify-between gap-1 font-semibold">
              <span className={displayTon > 0 && displayTon <= 3 ? "text-[#E53935]" : "text-neutral-600"}>{soldText}</span>
              <span className="text-neutral-500 font-medium">{remainingText}</span>
            </div>
          )}
        </div>

        <DealGiftBox promo={promo} />
      </div>
    </article>
  );
}
