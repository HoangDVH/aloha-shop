"use client";

import { ShoppingCart } from "lucide-react";
import type { RefObject } from "react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import { getGuestCtvCode } from "@/lib/ctv";
import type { ShopProduct } from "@/lib/api";
import { flyToCart } from "@/lib/campaign/flyToCart";

/** Nút giỏ tròn góc ảnh thẻ ưu đãi: thêm đúng mã đang bán (giá chiến dịch server tính lại ở giỏ / checkout). */
export function DealQuickAdd({
  product,
  imageRef,
  preOrder,
}: {
  product: ShopProduct;
  imageRef: RefObject<HTMLElement | null>;
  preOrder: boolean;
}) {
  const add = useCart((s) => s.add);
  const toast = useToast();

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = add(product, 1, getGuestCtvCode());
    if (!r.ok) {
      toast.push(
        r.max === 0 && !r.preOrder
          ? `“${product.ten}” đã hết hàng`
          : `Chỉ còn ${r.max} ${product.dvt || "sản phẩm"} — giỏ đã đủ số này`
      );
      return;
    }
    flyToCart(imageRef.current, product.anh);
    toast.push(
      r.preOrder
        ? "Đã thêm đặt trước — Aloha sẽ xác nhận ngày giao"
        : r.capped
          ? `Đã thêm tối đa ${r.qty} ${product.dvt || ""} (hết tồn kho)`
          : `Đã thêm “${product.ten}” vào giỏ`,
      { href: "/gio-hang", hrefLabel: "Xem giỏ hàng" }
    );
  };

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={preOrder ? `Đặt trước ${product.ten}` : `Thêm ${product.ten} vào giỏ`}
      className="absolute bottom-2 left-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--campaign-primary,#C2185B)] text-white shadow-[0_4px_14px_rgba(194,24,91,0.4)] ring-2 ring-white opacity-0 pointer-events-none translate-y-1.5 scale-90 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:scale-100 hover:scale-110 active:scale-90"
    >
      <ShoppingCart size={18} strokeWidth={2.4} aria-hidden />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[12px] font-black leading-none text-[var(--campaign-primary,#C2185B)] shadow-sm" aria-hidden>
        +
      </span>
    </button>
  );
}
