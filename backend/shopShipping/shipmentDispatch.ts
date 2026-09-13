import { createGhtkOrder } from "./ghtkClient.js";
import { createGhnOrder } from "./ghnClient.js";
import { createSpxOrder } from "./spxClient.js";
import type { ShippingCarrier } from "./carrierTypes.js";
import type { ShipmentOrderResult } from "./carrierTypes.js";

export type ShopOrderShipmentDoc = {
  status: "pending" | "created" | "failed";
  carrier?: string;
  trackingCode?: string;
  carrierOrderId?: string;
  labelUrl?: string;
  createdAt?: string;
  confirmedBy?: string;
  error?: string;
};

export type DispatchShipmentInput = {
  carrier: ShippingCarrier;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  province: string;
  district?: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  shippingAddress: string;
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  valueVnd: number;
  codAmount?: number;
  note?: string;
};

export async function dispatchShipment(
  input: DispatchShipmentInput
): Promise<ShipmentOrderResult> {
  const pkg = {
    ...input,
    address: input.shippingAddress,
    orderCode: input.orderCode,
  };

  if (input.carrier === "ghtk") return createGhtkOrder(pkg);
  if (input.carrier === "ghn") return createGhnOrder(pkg);
  if (input.carrier === "spx") return createSpxOrder(pkg);
  return { ok: false, error: `Hãng vận chuyển không hỗ trợ: ${input.carrier}` };
}
