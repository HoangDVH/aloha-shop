import type { ShopOrder } from "./orders";

/** A charged fee is already part of the stored total; support older estimate metadata. */
export function isOrderShippingPending(order: Pick<ShopOrder,
  "deliveryMethod" | "shippingFeePending" | "shippingFee" | "shippingEstimate" | "freeShipApplied">): boolean {
  if (order.deliveryMethod === "nhan_cua_hang") return false;
  // Older KiotViet-synced orders can retain the original, unresolved estimate metadata.
  if (typeof order.shippingFee === "number" && Number.isFinite(order.shippingFee) && order.shippingFee > 0) return false;
  if (typeof order.shippingFeePending === "boolean") return order.shippingFeePending;
  if (order.freeShipApplied) return false;
  if (order.shippingEstimate?.status === "needs_confirmation" || order.shippingEstimate?.status === "unavailable") return true;
  return order.shippingFee == null;
}
