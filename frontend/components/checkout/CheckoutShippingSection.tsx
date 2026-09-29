"use client";

import type { ShippingCarrier, ShippingQuote } from "@/lib/shipping";
import type { Delivery } from "./checkoutTypes";

type QuoteAddress = {
  province: string;
  ward: string;
};

type Props = {
  delivery: Delivery;
  quoteAddress: QuoteAddress;
  shippingLoading: boolean;
  shippingError: string;
  shippingQuote: ShippingQuote | null;
  activeCarrier: ShippingCarrier | null | undefined;
  onPickCarrier: (carrier: ShippingCarrier) => void;
};

/** Khối đối tác vận chuyển — đã ẩn theo yêu cầu UI. */
export function CheckoutShippingSection(_props: Props) {
  return null;
}
