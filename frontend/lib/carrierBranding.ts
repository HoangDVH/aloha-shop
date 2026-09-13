"use client";

export type ShippingCarrier = "ghtk" | "ghn" | "spx";

export type CarrierBrand = {
  id: ShippingCarrier;
  label: string;
  accent: string;
  bg: string;
  logo: string;
};

export const CARRIER_BRANDS: Record<ShippingCarrier, CarrierBrand> = {
  ghtk: {
    id: "ghtk",
    label: "GHTK",
    accent: "#009F3A",
    bg: "#E8F8EE",
    logo: "/carriers/ghtk.svg",
  },
  ghn: {
    id: "ghn",
    label: "GHN",
    accent: "#F58220",
    bg: "#FFF4E8",
    logo: "/carriers/ghn.svg",
  },
  spx: {
    id: "spx",
    label: "SPX",
    accent: "#EE4D2D",
    bg: "#FFEDE8",
    logo: "/carriers/spx.svg",
  },
};

export function carrierBrand(id: ShippingCarrier): CarrierBrand {
  return CARRIER_BRANDS[id];
}
