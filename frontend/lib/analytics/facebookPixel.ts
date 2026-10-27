"use client";

export const DEFAULT_PIXEL_ID =
  process.env.NEXT_PUBLIC_FB_PIXEL_ID || "558672458588374";

export function getPixelIds(): string[] {
  const customIds = process.env.NEXT_PUBLIC_FB_PIXEL_IDS
    ? process.env.NEXT_PUBLIC_FB_PIXEL_IDS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const primary = (process.env.NEXT_PUBLIC_FB_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
  const all = primary ? [primary, ...customIds] : customIds;
  return Array.from(new Set(all));
}

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

/**
 * An toàn gọi fbq, không bao giờ phát sinh lỗi làm gián đoạn UI mua sắm.
 */
function callFbq(...args: any[]) {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.fbq === "function") {
      window.fbq(...args);
    }
  } catch {
    /* Analytics must never interrupt user experience */
  }
}

/**
 * Đo lường lượt xem trang (PageView)
 */
export function trackPixelPageView() {
  callFbq("track", "PageView");
}

/**
 * Đo lường khi khách xem chi tiết sản phẩm (ViewContent)
 * content_ids trùng khớp với mã SKU trên KiotViet
 */
export function trackPixelViewContent(params: {
  ma: string;
  ten: string;
  gia: number;
  nhom?: string;
  currency?: string;
}) {
  if (!params.ma) return;
  callFbq("track", "ViewContent", {
    content_name: params.ten,
    content_ids: [params.ma],
    content_type: "product",
    content_category: params.nhom || "Chậu cây & Cây cảnh",
    value: Math.max(0, Number(params.gia) || 0),
    currency: params.currency || "VND",
  });
}

/**
 * Đo lường khi khách bấm thêm vào giỏ hàng (AddToCart)
 */
export function trackPixelAddToCart(params: {
  ma: string;
  ten: string;
  gia: number;
  qty?: number;
  currency?: string;
}) {
  if (!params.ma) return;
  const quantity = Math.max(1, Number(params.qty) || 1);
  const unitPrice = Math.max(0, Number(params.gia) || 0);
  callFbq("track", "AddToCart", {
    content_name: params.ten,
    content_ids: [params.ma],
    content_type: "product",
    value: unitPrice * quantity,
    currency: params.currency || "VND",
  });
}

/**
 * Đo lường khi khách bắt đầu điền thông tin thanh toán (InitiateCheckout)
 */
export function trackPixelInitiateCheckout(params: {
  items: Array<{ ma: string; gia: number; qty?: number }>;
  totalValue: number;
  currency?: string;
}) {
  const contentIds = params.items.map((i) => i.ma).filter(Boolean);
  const numItems = params.items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
  callFbq("track", "InitiateCheckout", {
    content_ids: contentIds,
    content_type: "product",
    num_items: numItems,
    value: Math.max(0, Number(params.totalValue) || 0),
    currency: params.currency || "VND",
  });
}

/**
 * Đo lường khi khách đặt hàng thành công (Purchase)
 * Sử dụng eventID = orderCode để chống trùng lặp dữ liệu (Deduplication) chuẩn Meta
 */
export function trackPixelPurchase(params: {
  orderCode: string;
  totalValue: number;
  items?: Array<{ ma: string; gia?: number; qty?: number }>;
  currency?: string;
}) {
  if (!params.orderCode) return;
  const contentIds = (params.items || []).map((i) => i.ma).filter(Boolean);
  callFbq(
    "track",
    "Purchase",
    {
      content_ids: contentIds,
      content_type: "product",
      value: Math.max(0, Number(params.totalValue) || 0),
      currency: params.currency || "VND",
    },
    {
      eventID: params.orderCode,
    }
  );
}
