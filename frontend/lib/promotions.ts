import type { PromotionQuoteUI } from "@/components/checkout/PromotionModal";

export async function quotePromotions(params: {
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
}): Promise<PromotionQuoteUI | null> {
  try {
    const res = await fetch("/api/shop/promotions/quote", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data?.ok && data.quote) {
      return data.quote;
    }
    return null;
  } catch (e) {
    console.warn("[promotions] quote failed", e);
    return null;
  }
}
