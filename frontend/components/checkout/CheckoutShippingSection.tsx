"use client";

import { Truck } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { ShippingCarrierOption } from "@/components/ShippingCarrierOption";
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

/** Khối vận chuyển — chỉ hiện khi giao tận nơi. */
export function CheckoutShippingSection({
  delivery,
  quoteAddress,
  shippingLoading,
  shippingError,
  shippingQuote,
  activeCarrier,
  onPickCarrier,
}: Props) {
  if (delivery !== "giao_tan_noi") return null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E8E2D6]">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-[var(--aloha-ink)]">
        <Truck size={18} className="text-[var(--aloha-green)]" />
        Vận chuyển
      </h2>
      {!quoteAddress.province || !quoteAddress.ward ? (
        <p className="text-sm text-slate-500">Chọn đủ tỉnh và phường/xã để xem phí ship.</p>
      ) : shippingLoading ? (
        <p className="text-sm text-slate-500">Đang báo giá phí ship...</p>
      ) : shippingError ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{shippingError}</p>
      ) : shippingQuote?.quotes?.length ? (
        <div className="space-y-2">
          {shippingQuote.freeShipApplied ? (
            <p className="rounded-lg bg-[#E8F8EE] px-3 py-2 text-xs font-semibold text-[#009F3A]">
              Đơn đủ điều kiện — miễn phí vận chuyển
              {shippingQuote.freeShipMinVnd
                ? ` (đơn từ ${formatVnd(shippingQuote.freeShipMinVnd)})`
                : shippingQuote.freeShipMaxUnitVnd
                  ? ` (mọi SP giá dưới ${formatVnd(shippingQuote.freeShipMaxUnitVnd)})`
                  : ""}
            </p>
          ) : null}
          {shippingQuote.quotes.map((q) => (
            <ShippingCarrierOption
              key={q.carrier}
              quote={q}
              selected={activeCarrier === q.carrier}
              isCheapest={shippingQuote.cheapest === q.carrier}
              onSelect={() => onPickCarrier(q.carrier)}
            />
          ))}
          {shippingQuote.totalWeightGram > 0 ? (
            <p className="text-xs text-slate-400">
              Tổng cân ước tính: {(shippingQuote.totalWeightGram / 1000).toFixed(2)} kg
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chưa có báo giá ship.</p>
      )}
    </section>
  );
}
