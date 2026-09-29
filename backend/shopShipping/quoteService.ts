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
import type { PackageDataSource } from "./resolveWeight.js";

export type ShippingQuoteOption = DeliveryEta & {
  carrier: ShippingCarrier;
  name: string;
  fee: number;
  eta?: string;
  source: "api" | "estimate";
  freeShip?: boolean;
};

export type ShippingEstimateStatus =
  | "estimated"
  | "needs_confirmation"
  | "unavailable"
  | "missing_address";

export type ShippingQuoteResponse = {
  ok: true;
  subtotal: number;
  totalWeightGram: number;
  freeShipApplied: boolean;
  freeShipMinVnd: number;
  freeShipMaxUnitVnd: number;
  quotes: ShippingQuoteOption[];
  cheapest: ShippingCarrier | null;
  selected: ShippingQuoteOption | null;
  quoteToken: string;
  shippingEstimateStatus: ShippingEstimateStatus;
  estimatedShippingFee: number | null;
  pricingSource: "carrier_api" | "internal_estimate" | "shop_policy";
  packageDataSource: PackageDataSource;
  estimateReason?: string;
  estimatedAt: string;
  expiresAt: string;
};

function toOption(
  q: NonNullable<Awaited<ReturnType<typeof quoteGhtk>>>,
  freeShip: boolean
): ShippingQuoteOption {
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
    discountTotal?: number;
  }
): Promise<ShippingQuoteResponse> {
  const built = await buildCarrierQuoteInput(db, input.items, {
    province: input.province,
    district: input.district,
    ward: input.ward,
    ghnDistrictId: input.ghnDistrictId,
    ghnWardCode: input.ghnWardCode,
  });

  const now = new Date();
  const estimatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const itemsKey = hashQuoteItems(built.items);

  // SH03 / SH07: Nếu kiện hàng cần shop xác nhận (thiếu cân/preset hoặc quá khổ/dễ vỡ)
  // Không được tự gán phí 0đ hoặc đoán 500g tùy tiện.
  if (built.needsConfirmation) {
    const quoteToken = signQuoteToken({
      carrier: null,
      fee: null,
      subtotal: built.subtotal,
      totalWeightGram: built.totalWeightGram,
      province: input.province,
      district: input.district || "",
      ward: input.ward,
      ghnDistrictId: input.ghnDistrictId,
      ghnWardCode: input.ghnWardCode,
      itemsKey,
      freeShipApplied: false,
      shippingEstimateStatus: "needs_confirmation",
      pricingSource: "shop_policy",
      packageDataSource: built.packageDataSource,
      estimatedShippingFee: null,
    });

    return {
      ok: true,
      subtotal: built.subtotal,
      totalWeightGram: built.totalWeightGram,
      freeShipApplied: false,
      freeShipMinVnd: freeShipMinVnd(),
      freeShipMaxUnitVnd: freeShipMaxUnitVnd(),
      quotes: [],
      cheapest: null,
      selected: null,
      quoteToken,
      shippingEstimateStatus: "needs_confirmation",
      estimatedShippingFee: null,
      pricingSource: "shop_policy",
      packageDataSource: built.packageDataSource,
      estimateReason: built.confirmationReason || "Chờ shop báo phí",
      estimatedAt,
      expiresAt,
    };
  }

  // Xét điều kiện miễn ship theo tiền hàng sau ưu đãi N = G - D (Section 15.2 & LK06)
  const subtotalAfterDiscount = Math.max(0, built.subtotal - (Number(input.discountTotal) || 0));
  const freeShip = qualifiesFreeShip(subtotalAfterDiscount, built.items);

  const [ghtk, ghn, spx] = await Promise.all([
    quoteGhtk(built.package).catch(() => null),
    quoteGhn(built.package).catch(() => null),
    quoteSpx(built.package).catch(() => null),
  ]);

  const quotes: ShippingQuoteOption[] = [ghtk, ghn, spx]
    .filter(Boolean)
    .map((q) => toOption(q!, freeShip))
    .sort((a, b) => a.fee - b.fee);

  // SH09: Nếu các hãng đều lỗi và không có fallback phù hợp -> trả unavailable (null fee, KHÔNG ĐƯỢC 0đ)
  if (!quotes.length) {
    const quoteToken = signQuoteToken({
      carrier: null,
      fee: null,
      subtotal: built.subtotal,
      totalWeightGram: built.totalWeightGram,
      province: input.province,
      district: input.district || "",
      ward: input.ward,
      ghnDistrictId: input.ghnDistrictId,
      ghnWardCode: input.ghnWardCode,
      itemsKey,
      freeShipApplied: false,
      shippingEstimateStatus: "unavailable",
      pricingSource: "shop_policy",
      packageDataSource: built.packageDataSource,
      estimatedShippingFee: null,
    });

    return {
      ok: true,
      subtotal: built.subtotal,
      totalWeightGram: built.totalWeightGram,
      freeShipApplied: false,
      freeShipMinVnd: freeShipMinVnd(),
      freeShipMaxUnitVnd: freeShipMaxUnitVnd(),
      quotes: [],
      cheapest: null,
      selected: null,
      quoteToken,
      shippingEstimateStatus: "unavailable",
      estimatedShippingFee: null,
      pricingSource: "shop_policy",
      packageDataSource: built.packageDataSource,
      estimateReason: "Chưa lấy được phí vận chuyển. Thử lại hoặc chờ Aloha báo phí",
      estimatedAt,
      expiresAt,
    };
  }

  const preferred = input.preferredCarrier
    ? quotes.find((q) => q.carrier === input.preferredCarrier)
    : null;
  const selected = preferred || quotes[0];

  const pricingSource = freeShip
    ? "shop_policy"
    : selected.source === "api"
      ? "carrier_api"
      : "internal_estimate";

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
    shippingEstimateStatus: "estimated",
    pricingSource,
    packageDataSource: built.packageDataSource,
    estimatedShippingFee: selected.fee,
  });

  return {
    ok: true,
    subtotal: built.subtotal,
    totalWeightGram: built.totalWeightGram,
    freeShipApplied: freeShip,
    freeShipMinVnd: freeShipMinVnd(),
    freeShipMaxUnitVnd: freeShipMaxUnitVnd(),
    quotes,
    cheapest: quotes[0]?.carrier || null,
    selected,
    quoteToken,
    shippingEstimateStatus: "estimated",
    estimatedShippingFee: selected.fee,
    pricingSource,
    packageDataSource: built.packageDataSource,
    estimatedAt,
    expiresAt,
  };
}
