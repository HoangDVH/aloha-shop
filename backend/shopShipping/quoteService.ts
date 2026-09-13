import type { Db } from "mongodb";
import type { DeliveryEta } from "./etaService.js";
import { quoteGhtk } from "./ghtkClient.js";
import { quoteGhn } from "./ghnClient.js";
import { quoteSpx } from "./spxClient.js";
import { buildCarrierQuoteInput } from "./quoteInput.js";
import { qualifiesFreeShip, freeShipMinVnd, freeShipMaxUnitVnd } from "./freeShip.js";
import type { ShippingCarrier } from "./carrierTypes.js";
import {
  hashQuoteItems,
  signQuoteToken,
  type QuoteLineItem,
} from "./quoteToken.js";

export type ShippingQuoteOption = DeliveryEta & {
  carrier: ShippingCarrier;
  name: string;
  fee: number;
  eta?: string;
  source: "api" | "estimate";
  freeShip?: boolean;
};

export type ShippingQuoteResponse = {
  ok: true;
  subtotal: number;
  totalWeightGram: number;
  freeShipApplied: boolean;
  freeShipMinVnd: number;
  freeShipMaxUnitVnd: number;
  quotes: ShippingQuoteOption[];
  cheapest: ShippingCarrier;
  selected: ShippingQuoteOption;
  quoteToken: string;
};

function toOption(q: NonNullable<Awaited<ReturnType<typeof quoteGhtk>>>, freeShip: boolean): ShippingQuoteOption {
  return {
    carrier: q.carrier,
    name: q.name,
    fee: freeShip ? 0 : q.fee,
    eta: q.eta,
    etaLabel: q.etaLabel,
    etaFrom: q.etaFrom,
    etaTo: q.etaTo,
    leadDaysMin: q.leadDaysMin,
    leadDaysMax: q.leadDaysMax,
    source: q.source,
    freeShip,
  };
}

export async function getShippingQuote(
  db: Db,
  input: {
    items: QuoteLineItem[];
    province: string;
    district?: string;
    ward: string;
    ghnDistrictId?: number;
    ghnWardCode?: string;
    preferredCarrier?: ShippingCarrier;
  }
): Promise<ShippingQuoteResponse> {
  const built = await buildCarrierQuoteInput(db, input.items, {
    province: input.province,
    district: input.district,
    ward: input.ward,
    ghnDistrictId: input.ghnDistrictId,
    ghnWardCode: input.ghnWardCode,
  });

  const freeShip = qualifiesFreeShip(built.subtotal, built.items);

  const [ghtk, ghn, spx] = await Promise.all([
    quoteGhtk(built.package),
    quoteGhn(built.package),
    quoteSpx(built.package),
  ]);

  const quotes: ShippingQuoteOption[] = [ghtk, ghn, spx]
    .filter(Boolean)
    .map((q) => toOption(q!, freeShip))
    .sort((a, b) => a.fee - b.fee);

  if (!quotes.length) throw new Error("Không báo giá được phí ship");

  const preferred = input.preferredCarrier
    ? quotes.find((q) => q.carrier === input.preferredCarrier)
    : null;
  const selected = preferred || quotes[0];
  const itemsKey = hashQuoteItems(built.items);

  const quoteToken = signQuoteToken({
    carrier: selected.carrier,
    fee: selected.fee,
    subtotal: built.subtotal,
    totalWeightGram: built.totalWeightGram,
    province: input.province,
    district: input.district || "",
    ward: input.ward,
    ghnDistrictId: input.ghnDistrictId,
    ghnWardCode: input.ghnWardCode,
    itemsKey,
    freeShipApplied: freeShip,
  });

  return {
    ok: true,
    subtotal: built.subtotal,
    totalWeightGram: built.totalWeightGram,
    freeShipApplied: freeShip,
    freeShipMinVnd: freeShipMinVnd(),
    freeShipMaxUnitVnd: freeShipMaxUnitVnd(),
    quotes,
    cheapest: quotes[0].carrier,
    selected,
    quoteToken,
  };
}
