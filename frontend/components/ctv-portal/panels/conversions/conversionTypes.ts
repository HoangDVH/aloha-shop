import { monthRange, ymd } from "../../shared/format";

export const PAGE_SIZE = 10;

export interface ConversionFilters {
  from: string;
  to: string;
  orderCode: string;
  orderStatus: string;
  paymentStatus: string;
}

export const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "cho_xu_ly", label: "Chờ xử lý" },
  { value: "cho_thanh_toan", label: "Chờ thanh toán" },
  { value: "dang_giao", label: "Đang giao" },
  { value: "hoan_thanh", label: "Hoàn thành" },
  { value: "thieu_hang", label: "Thiếu hàng" },
  { value: "huy", label: "Đã hủy" },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "cod", label: "COD" },
];

export type QuickRangeType = "today" | "yesterday" | "7days" | "this_month" | "last_month";

export function getQuickRange(type: QuickRangeType) {
  const now = new Date();
  if (type === "today") {
    const d = ymd(now);
    return { from: d, to: d, label: "Hôm nay" };
  }
  if (type === "yesterday") {
    const y = new Date(now.getTime() - 86400000);
    const d = ymd(y);
    return { from: d, to: d, label: "Hôm qua" };
  }
  if (type === "7days") {
    const past = new Date(now.getTime() - 7 * 86400000);
    return { from: ymd(past), to: ymd(now), label: "7 ngày qua" };
  }
  if (type === "last_month") {
    const r = monthRange(-1);
    return { from: r.from, to: r.to, label: "Tháng trước" };
  }
  const r = monthRange(0);
  return { from: r.from, to: r.to, label: "Tháng này" };
}
