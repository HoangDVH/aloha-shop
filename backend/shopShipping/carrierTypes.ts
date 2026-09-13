import type { DeliveryEta } from "./etaService.js";

export type ShippingCarrierId = "ghtk" | "ghn" | "spx";

export type CarrierQuoteInput = {
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  province: string;
  district?: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  valueVnd: number;
};

export type CarrierQuoteResult = DeliveryEta & {
  carrier: ShippingCarrierId;
  name: string;
  fee: number;
  eta?: string;
  source: "api" | "estimate";
  raw?: unknown;
};

export type ShipmentOrderInput = CarrierQuoteInput & {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string;
  codAmount?: number;
  note?: string;
};

export type ShipmentOrderResult = {
  ok: boolean;
  trackingCode?: string;
  carrierOrderId?: string;
  labelUrl?: string;
  error?: string;
  raw?: unknown;
};
