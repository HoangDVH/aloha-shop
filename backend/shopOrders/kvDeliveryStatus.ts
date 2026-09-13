/**
 * Map trạng thái giao / HĐ / Đặt hàng KiotViet → hành động shop.
 * Delivery: PublicAPI 1–12; Invoice/Order status: 1–4.
 */

export type KvDeliveryAction = "success" | "fail" | "wait" | "shipping";

/** Trạng thái vận đơn invoiceDelivery.status */
export function classifyKvDeliveryStatus(status: unknown): KvDeliveryAction {
  const n = Number(status);
  if (!Number.isFinite(n)) return "wait";
  if (n === 3) return "success";
  if (n === 5 || n === 6) return "fail";
  if (n === 2) return "shipping";
  // 1,4,7–12 và khác → chờ (4/12 đang chuyển hoàn: chưa fail)
  return "wait";
}

export function kvDeliveryStatusLabel(status: unknown): string {
  const n = Number(status);
  const map: Record<number, string> = {
    1: "Chờ xử lý",
    2: "Đang giao hàng",
    3: "Giao thành công",
    4: "Đang chuyển hoàn",
    5: "Đã chuyển hoàn",
    6: "Đã hủy vận đơn",
    7: "Đang lấy hàng",
    8: "Chờ lấy lại",
    9: "Đã lấy hàng",
    10: "Chờ giao lại",
    11: "Chờ chuyển hàng",
    12: "Chờ chuyển hoàn lại",
  };
  return map[n] || `Trạng thái ${status ?? "?"}`;
}

/** Invoice / Order.status: 4 = Cancelled */
export function isKvDocumentCancelled(status: unknown): boolean {
  return Number(status) === 4;
}

/** Invoice.status: 3 = Completed */
export function isKvInvoiceCompleted(status: unknown): boolean {
  return Number(status) === 3;
}

export function extractInvoiceDelivery(inv: any): {
  status: number | null;
  statusValue: string;
  raw: any;
} {
  const d =
    inv?.invoiceDelivery ??
    inv?.InvoiceDelivery ??
    inv?.deliveryDetail ??
    inv?.DeliveryDetail ??
    null;
  if (!d) return { status: null, statusValue: "", raw: null };
  const status = d.status ?? d.Status;
  const n = status == null || status === "" ? null : Number(status);
  return {
    status: Number.isFinite(n as number) ? (n as number) : null,
    statusValue: String(d.statusValue ?? d.StatusValue ?? ""),
    raw: d,
  };
}

/**
 * Quyết định từ HĐ KV đã GET đủ.
 * FAIL thắng SUCCESS. Không phiếu giao + HĐ hoàn thành = nhận tại shop → success.
 */
export type KvInvoiceShopDecision =
  | { action: "complete"; reason: string }
  | { action: "return"; reason: string }
  | { action: "shipping"; reason: string }
  | { action: "wait"; reason: string };

export function decideFromKvInvoice(inv: any): KvInvoiceShopDecision {
  const invStatus = inv?.status ?? inv?.Status;
  if (isKvDocumentCancelled(invStatus)) {
    return { action: "return", reason: "invoice_cancelled" };
  }

  const del = extractInvoiceDelivery(inv);
  if (del.status != null) {
    const cls = classifyKvDeliveryStatus(del.status);
    if (cls === "fail") {
      return {
        action: "return",
        reason: `delivery_${del.status}_${kvDeliveryStatusLabel(del.status)}`,
      };
    }
    if (cls === "success") {
      return { action: "complete", reason: "delivery_success" };
    }
    if (cls === "shipping") {
      return { action: "shipping", reason: "delivery_shipping" };
    }
    return {
      action: "wait",
      reason: `delivery_wait_${del.status}`,
    };
  }

  // Không có phiếu giao: HĐ hoàn thành = nhận tại shop
  if (isKvInvoiceCompleted(invStatus)) {
    return { action: "complete", reason: "invoice_completed_no_delivery" };
  }

  return { action: "wait", reason: "invoice_pending" };
}

/** Mã SP phí ship — không tính HH. */
export function isKvShipProductCode(productCode: string): boolean {
  const env = String(process.env.SHOP_KV_SHIP_PRODUCT_CODE || "")
    .trim()
    .toUpperCase();
  const ma = String(productCode || "").trim().toUpperCase();
  if (!ma) return false;
  if (env && ma === env) return true;
  return /^(SHIP|PHISHIP|PHI_SHIP|PVC)$/i.test(ma) || /PHI.?SHIP|VAN.?CHUYEN/i.test(ma);
}
