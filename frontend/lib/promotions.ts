import type { PromotionQuoteUI } from "@/components/checkout/PromotionModal";

export type PromotionQuoteRequest = {
  items: Array<{
    ma: string;
    ten?: string;
    price: number;
    quantity: number;
    categoryId?: string;
  }>;
  selectedCode?: string;
  autoMode?: boolean;
  phone?: string;
  email?: string;
};

/** status 0 = mất mạng / bị huỷ; 429 và 5xx là lỗi tạm thời, gọi lại được. */
export type PromotionQuoteResult = { ok: true; quote: PromotionQuoteUI } | { ok: false; status: number };

export async function requestPromotionQuote(
  params: PromotionQuoteRequest,
  signal?: AbortSignal
): Promise<PromotionQuoteResult> {
  try {
    const res = await fetch("/api/shop/promotions/quote", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(params),
      signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    if (data?.ok && data.quote) {
      return {
        ok: true,
        quote: {
          ...data.quote,
          campaign: {
            lines: Array.isArray(data.lines) ? data.lines : [],
            flashSavings: Number(data.flashSavings) || 0,
            anchorSavings: Number(data.anchorSavings) || 0,
            notices: Array.isArray(data.campaignNotices) ? data.campaignNotices : [],
          },
        },
      };
    }
    return { ok: false, status: 500 };
  } catch (e) {
    if (!signal?.aborted) console.warn("[promotions] quote failed", e);
    return { ok: false, status: 0 };
  }
}

export interface AvailablePromotionUI {
  id: string;
  title: string;
  description?: string;
  type: "auto" | "code";
  benefitType: "goods" | "shipping";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  thresholdOperator?: ">" | ">=";
  targetCustomer?: "all" | "retail" | "wholesale" | "new_web";
  scope?: "all" | "category" | "product";
  categoryIds?: string[];
  productMas?: string[];
  startDate?: string;
  endDate?: string;
}

export async function getAvailablePromotions(): Promise<AvailablePromotionUI[]> {
  try {
    const res = await fetch("/api/shop/promotions/available", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch (e) {
    console.warn("[promotions] getAvailablePromotions failed", e);
    return [];
  }
}

