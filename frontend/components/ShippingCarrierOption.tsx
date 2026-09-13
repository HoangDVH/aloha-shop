"use client";

import Image from "next/image";
import { formatVnd } from "@/lib/api";
import { carrierBrand, type ShippingCarrier } from "@/lib/carrierBranding";
import type { ShippingQuoteOption } from "@/lib/shipping";

type Props = {
  quote: ShippingQuoteOption;
  selected: boolean;
  isCheapest: boolean;
  onSelect: () => void;
};

export function ShippingCarrierOption({ quote, selected, isCheapest, onSelect }: Props) {
  const brand = carrierBrand(quote.carrier as ShippingCarrier);
  const free = quote.fee <= 0 || quote.freeShip;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition"
      style={{
        borderColor: selected ? brand.accent : "#E5DFD2",
        backgroundColor: selected ? brand.bg : "white",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: brand.accent }}
        >
          <Image src={brand.logo} alt={brand.label} width={40} height={40} className="h-10 w-10" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1a2e1a]">
            {quote.name}
            {isCheapest && !free ? (
              <span className="ml-2 rounded bg-[#EE6055] px-1.5 py-0.5 text-[10px] font-bold text-white">
                Rẻ nhất
              </span>
            ) : null}
            {free ? (
              <span
                className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: brand.accent }}
              >
                Miễn phí
              </span>
            ) : null}
          </p>
          <p className="text-xs text-slate-500">
            {quote.etaLabel || quote.eta || "2–4 ngày"}
            {quote.source === "estimate" ? " · ước tính" : ""}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-extrabold" style={{ color: free ? brand.accent : "#3D6B3A" }}>
        {free ? "Miễn phí" : formatVnd(quote.fee)}
      </span>
    </button>
  );
}
