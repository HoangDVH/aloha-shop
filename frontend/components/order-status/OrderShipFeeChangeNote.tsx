"use client";

import { formatVnd } from "@/lib/api";
import type { ShopOrder } from "@/lib/orders";

/** Nhân viên đã sửa phí ship trên KiotViet — báo khách số cũ → số mới (lần sửa gần nhất). */
export function OrderShipFeeChangeNote({ order }: { order: ShopOrder }) {
  const last = [...(order.moneyChanges || [])]
    .reverse()
    .find((c) => c.shippingFee && c.shippingFee.from !== c.shippingFee.to);
  if (!last?.shippingFee) return null;
  const fmt = (n: number) => (n > 0 ? formatVnd(n) : "0đ");
  return (
    <p className="text-[11px] leading-snug text-amber-700">
      Shop đã cập nhật phí ship: <span className="line-through">{fmt(last.shippingFee.from)}</span> →{" "}
      <span className="font-semibold">{fmt(last.shippingFee.to)}</span>
    </p>
  );
}
