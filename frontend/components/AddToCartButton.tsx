"use client";

import { useCart } from "@/lib/cart";
import { useToast } from "@/components/Toast";
import type { ShopProduct } from "@/lib/api";

export function AddToCartButton({
  product,
  disabled,
  qty = 1,
  label = "Thêm giỏ hàng",
  className,
}: {
  product: ShopProduct;
  disabled?: boolean;
  qty?: number;
  label?: string;
  className?: string;
}) {
  const add = useCart((s) => s.add);
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const r = add(product, qty);
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
            ? "Đã thêm đặt trước — giao khi shop có hàng"
            : r.capped
              ? `Đã thêm tối đa ${r.qty} ${product.dvt || ""} (hết tồn kho)`
              : `Đã thêm “${product.ten}” vào giỏ`,
          {
            href: "/gio-hang",
            hrefLabel: "Xem giỏ hàng",
          }
        );
      }}
      className={
        className ||
        "w-full rounded-lg bg-[var(--aloha-green-light)] px-5 py-3 text-sm font-bold text-[var(--aloha-green)] hover:bg-[#DCE8D6] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      }
    >
      {label}
    </button>
  );
}
