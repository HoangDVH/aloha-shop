import crypto from "crypto";
import jwt from "jsonwebtoken";
import { shopQuoteSecret } from "../shopAuth/tokens.js";
import type { ShippingCarrier } from "./carrierTypes.js";

const QUOTE_TTL_SEC = Number(process.env.SHOP_SHIPPING_QUOTE_TTL_SEC || 15 * 60);

export type { ShippingCarrier };

export type QuoteLineItem = {
  productCode: string;
  quantity: number;
  price: number;
  productName?: string;
  trongLuong?: number;
};

export type QuoteTokenPayload = {
  typ: "shop_shipping_quote";
  carrier: ShippingCarrier;
  fee: number;
  subtotal: number;
  totalWeightGram: number;
  province: string;
  district: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  itemsKey: string;
  freeShipApplied?: boolean;
};

export function hashQuoteItems(items: QuoteLineItem[]): string {
  // Chỉ khóa theo mã + SL — giá lấy lại từ catalog lúc đặt hàng (tránh lệch khi cập nhật giá web).
  const norm = items
    .map((i) => `${String(i.productCode || "").toUpperCase()}:${Math.max(1, Math.floor(Number(i.quantity) || 1))}`)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 20);
}

export function signQuoteToken(payload: Omit<QuoteTokenPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "shop_shipping_quote" }, shopQuoteSecret(), {
    expiresIn: QUOTE_TTL_SEC,
  });
}

export function verifyQuoteToken(token: string): QuoteTokenPayload {
  const p = jwt.verify(token, shopQuoteSecret()) as QuoteTokenPayload;
  if (p?.typ !== "shop_shipping_quote") {
    throw new Error("Mã phí ship không hợp lệ");
  }
  return p;
}

export { QUOTE_TTL_SEC };
