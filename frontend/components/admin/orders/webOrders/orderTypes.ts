import type { PrintableOrder } from "../print/printTypes";

export type OrderRow = PrintableOrder & {
  kvPaymentVerification?: { state: string; reason: string; attempts: number };
  statusValue?: string;
  isTest?: boolean;
  voidTestBlock: string | null;
  paidAmount?: number;
  totalPayment?: number;
  notes?: string;
  customerNote?: string;
  priceMode?: string;
  province?: string;
  district?: string;
  ward?: string;
  shippingFee?: number;
  shippingCarrier?: string;
  usingCod?: boolean;
  totalWeightGram?: number;
  orderDetails?: Array<{
    productCode?: string;
    productName?: string;
    quantity?: number;
    price?: number;
    discount?: number;
    variantLabel?: string;
    imageUrl?: string;
    note?: string;
    priceKind?: "web" | "si" | string;
    giaSi?: number;
    giaWeb?: number;
    isGift?: boolean;
  }>;
};

export type ListRes = {
  total: number;
  page: number;
  limit: number;
  summary?: {
    count: number;
    totalRevenue: number;
    totalPaid: number;
  };
  data: OrderRow[];
};

export type VoidRes = { ok: true; code: string; kvCancelled: string[] };

export const PAYMENT_BADGES: Record<
  string,
  { label: string; color: string; badgeCls: string }
> = {
  unpaid: {
    label: "Phiếu tạm",
    color: "orange",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  processing: {
    label: "Đang xử lý",
    color: "blue",
    badgeCls: "bg-blue-50 text-blue-800 border-blue-200",
  },
  paid: {
    label: "Hoàn thành",
    color: "green",
    badgeCls: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  underpaid: {
    label: "Thiếu tiền",
    color: "red",
    badgeCls: "bg-red-50 text-red-800 border-red-200",
  },
  expired: {
    label: "Hết hạn",
    color: "default",
    badgeCls: "bg-slate-100 text-slate-600 border-slate-200",
  },
  cancelled: {
    label: "Đã huỷ",
    color: "default",
    badgeCls: "bg-slate-100 text-slate-500 border-slate-200",
  },
  failed: {
    label: "Lỗi thanh toán",
    color: "red",
    badgeCls: "bg-red-50 text-red-800 border-red-200",
  },
  cod: {
    label: "Thu hộ COD",
    color: "cyan",
    badgeCls: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
};

export const DATE_OPTIONS = [
  { key: "all", label: "Toàn thời gian" },
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7days", label: "7 ngày qua" },
  { key: "thisMonth", label: "Tháng này" },
  { key: "lastMonth", label: "Tháng trước" },
  { key: "custom", label: "Tùy chỉnh" },
] as const;

export type DateFilterKey = (typeof DATE_OPTIONS)[number]["key"];

export const SEARCH_TABS = [
  { key: "code", label: "Mã phiếu đặt", placeholder: "Mã phiếu đặt hàng" },
  { key: "product", label: "Hàng hoá", placeholder: "Tên hàng, mã sản phẩm..." },
  { key: "customer", label: "Khách hàng", placeholder: "Tên khách hàng, số điện thoại..." },
  { key: "note", label: "Ghi chú", placeholder: "Tìm kiếm trong ghi chú..." },
] as const;

export type SearchTabKey = (typeof SEARCH_TABS)[number]["key"];

export const PAGE_SIZE = 20;

export function getDateRange(key: DateFilterKey, customFrom?: string, customTo?: string) {
  const now = new Date();
  if (key === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (key === "yesterday") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (key === "7days") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (key === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (key === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (key === "custom" && customFrom && customTo) {
    const from = new Date(`${customFrom}T00:00:00.000Z`);
    const to = new Date(`${customTo}T23:59:59.999Z`);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return { from: "", to: "" };
}

export function formatVietnameseDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const dateFormatted = `${dd}/${mm}/${yyyy}`;

  if (isSameDay(d, now)) {
    return `HÔM NAY ${dateFormatted}`;
  }
  if (isSameDay(d, yesterday)) {
    return `HÔM QUA ${dateFormatted}`;
  }

  const days = [
    "CHỦ NHẬT",
    "THỨ HAI",
    "THỨ BA",
    "THỨ TƯ",
    "THỨ NĂM",
    "THỨ SÁU",
    "THỨ BẢY",
  ];
  const dayName = days[d.getDay()];
  return `${dayName}, ${dateFormatted}`;
}

export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};
