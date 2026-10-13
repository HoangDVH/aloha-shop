"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { useZaloAskProduct } from "@/lib/zaloAsk";
import { formatVnd } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useStickyBarHeight } from "@/lib/floatingStack";

type Props = {
  price: number;
  pricePending?: boolean;
  needPick: boolean;
  preOrder?: boolean;
  purchaseDisabled: boolean;
  buyDisabled?: boolean;
  onAddCart: () => void;
  onBuyNow: () => void;
  isCampaignSale?: boolean;
  campaignBuyLabel?: string;
  /** Tên / ảnh SP đang xem để nút Zalo soạn sẵn câu hỏi tư vấn. */
  productName?: string;
  productImage?: string;
  tierDiscountPercent?: number;
  tierSavedAmount?: number;
  tierQty?: number;
  totalPrice?: number;
  totalPending?: boolean;
  onPriceDetails?: () => void;
};

/** Thanh CTA cố định đáy màn hình (mobile) trên trang chi tiết SP. */
export function ProductStickyCta({
  price,
  pricePending = false,
  needPick,
  preOrder = false,
  purchaseDisabled,
  buyDisabled = purchaseDisabled,
  onAddCart,
  onBuyNow,
  isCampaignSale = false,
  campaignBuyLabel = "Mua Giờ Vàng",
  productName = "",
  productImage = "",
  tierDiscountPercent = 0,
  tierSavedAmount = 0,
  tierQty = 1,
  totalPrice,
  totalPending = false,
  onPriceDetails,
}: Props) {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const barRef = useStickyBarHeight<HTMLDivElement>();
  const setZaloProduct = useZaloAskProduct((s) => s.setProduct);

  const [cartBumping, setCartBumping] = useState(false);
  const [desktopVisible, setDesktopVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById("product-buy-actions");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setDesktopVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleBump = () => {
      setCartBumping(true);
      window.setTimeout(() => setCartBumping(false), 550);
    };
    window.addEventListener("aloha:cart-bump", handleBump);
    return () => window.removeEventListener("aloha:cart-bump", handleBump);
  }, []);

  useEffect(() => {
    if (!productName) return;
    setZaloProduct({ name: productName, price: pricePending ? null : price, image: productImage });
    return () => setZaloProduct(null);
  }, [productName, productImage, price, pricePending, setZaloProduct]);

  return (
    <div
      ref={barRef}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--aloha-line)] bg-white/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur ${desktopVisible ? "" : "lg:hidden"} transform-gpu will-change-transform`}
      style={{
        WebkitTransform: "translate3d(0, 0, 0)",
        transform: "translate3d(0, 0, 0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2.5">
        <Link
          href="/gio-hang"
          className={`relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--aloha-line)] bg-white text-[var(--aloha-ink)] transition hover:bg-[var(--aloha-cream)] active:scale-95 lg:flex ${
            cartBumping ? "aloha-cart-bump" : ""
          }`}
          aria-label={`Giỏ hàng${count ? `, ${count} sản phẩm` : ""}`}
        >
          <ShoppingCart size={19} strokeWidth={1.85} />
          {count > 0 ? (
            <span className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--aloha-terracotta,#EE6055)] px-1 text-[10px] font-black text-white ring-2 ring-white transition-transform duration-300 ${
              cartBumping ? "scale-125" : ""
            }`}>
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Link>
        <button type="button" onClick={onPriceDetails} className="min-w-0 flex-1 text-left" aria-label="Xem chi tiết tạm tính và chọn số lượng">
          <p className="text-[10px] text-slate-500">Tạm tính · chưa gồm ship</p>
          <div className="flex items-baseline gap-1.5 truncate">
            <p className="truncate text-[15px] font-black leading-tight text-[#e65343]">
              {pricePending || totalPending ? "Đang cập nhật…" : totalPrice != null ? formatVnd(totalPrice) : price > 0 ? formatVnd(price * tierQty) : "Liên hệ báo giá"}
            </p>
          </div>
        </button>
        {/* gap rõ + không dính cạnh — tránh bị gộp thành 1 khối trên mobile */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={purchaseDisabled}
            onClick={onAddCart}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--aloha-green-light)] px-3 text-xs font-bold text-[var(--aloha-green-mid)] disabled:opacity-40 active:scale-95"
          >
            Thêm giỏ
          </button>
          <button
            type="button"
            disabled={buyDisabled}
            onClick={onBuyNow}
            className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-3.5 text-xs font-bold text-white shadow-sm disabled:opacity-40 active:scale-95 transition ${
              "bg-[var(--aloha-green)] hover:bg-[var(--aloha-green-hover)]"
            }`}
          >
            {isCampaignSale ? (
              <>
                <Zap size={13} className="fill-white" />
                <span>{campaignBuyLabel}</span>
              </>
            ) : tierDiscountPercent >= 10 ? (
              <>
                <Zap size={13} className="fill-white" />
                <span>Mua sỉ ngay</span>
              </>
            ) : preOrder ? (
              "Đặt ngay"
            ) : (
              "Mua ngay"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
