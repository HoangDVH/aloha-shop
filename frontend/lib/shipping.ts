"use client";

export type ShippingCarrier = "ghtk" | "ghn" | "spx";

export type ShippingQuoteOption = {
  carrier: ShippingCarrier;
  name: string;
  fee: number;
  eta?: string;
  etaLabel?: string;
  etaFrom?: string;
  etaTo?: string;
  leadDaysMin?: number;
  leadDaysMax?: number;
  source?: "api" | "estimate";
  freeShip?: boolean;
};

export type ShippingQuote = {
  ok: boolean;
  subtotal: number;
  totalWeightGram: number;
  freeShipApplied?: boolean;
  freeShipMinVnd?: number;
  freeShipMaxUnitVnd?: number;
  quotes: ShippingQuoteOption[];
  cheapest: ShippingCarrier | null;
  selected: ShippingQuoteOption | null;
  quoteToken: string;
};

export type QuoteShippingInput = {
  items: {
    productCode: string;
    productName?: string;
    trongLuong?: number;
    quantity: number;
    price: number;
  }[];
  province: string;
  district?: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  deliveryMethod: "giao_tan_noi" | "nhan_cua_hang";
  carrier?: ShippingCarrier;
};

export async function fetchShippingQuote(
  body: QuoteShippingInput,
  signal?: AbortSignal
): Promise<ShippingQuote> {
  const res = await fetch("/api/shop/shipping/quote", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as ShippingQuote;
}
