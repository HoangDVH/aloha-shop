import type { StepFail } from "./stepResult.js";
import { hashQuoteItems, verifyQuoteToken } from "../../shopShipping/quoteToken.js";
import { shopRequireShippingQuote } from "../checkoutFlags.js";
import type { ShopOrderDetail } from "../models.js";

export type VerifiedQuote = ReturnType<typeof verifyQuoteToken>;

export type ShippingQuoteResult =
  | {
      ok: true;
      quoteToken: string;
      quoteVerified: VerifiedQuote | null;
      shippingFee: number;
      shippingCarrier?: string;
      totalWeightGram: number;
      freeShipApplied: boolean;
    }
  | StepFail;

type QuoteInput = {
  body: any;
  deliveryMethod: string;
  orderDetails: ShopOrderDetail[];
  subtotal: number;
  province: string;
  district: string;
  ward: string;
  ghnWardCode?: string;
};

function fail(status: number, body: Record<string, unknown>): ShippingQuoteResult {
  return { ok: false, status, body };
}

/** Kiểm tra mã báo giá ship khách gửi lên khớp giỏ, địa chỉ và phí. */
export function checkShippingQuote(input: QuoteInput): ShippingQuoteResult {
  const { body, deliveryMethod, orderDetails, province, district, ward, ghnWardCode } = input;
  const quoteToken = String(body.quoteToken || "").trim();
  const empty = {
    ok: true as const,
    quoteToken,
    quoteVerified: null,
    shippingFee: 0,
    shippingCarrier: undefined,
    totalWeightGram: 0,
    freeShipApplied: false,
  };
  // Phase COD: không bắt quote — phí ship = 0 (code quote vẫn giữ để bật lại)
  if (deliveryMethod !== "giao_tan_noi" || !shopRequireShippingQuote()) return empty;
  if (!quoteToken) {
    return fail(400, { error: "Thiếu báo giá phí ship — tải lại trang checkout" });
  }
  try {
    const quote = verifyQuoteToken(quoteToken);
    // Báo giá ship tính theo giá thường, không có dòng quà; giảm flash đi vào discountTotal.
    const goods = orderDetails.filter((d) => !d.isGift);
    const itemsKey = hashQuoteItems(
      goods.map((d) => ({
        productCode: d.productCode,
        quantity: d.quantity,
        price: d.price,
      }))
    );
    if (quote.itemsKey !== itemsKey) {
      return fail(400, { error: "Giỏ hàng đã đổi — báo giá ship lại" });
    }
    // Subtotal đổi mạnh so với lúc quote → đòi báo giá lại (tránh phí/freeship lệch).
    const listSubtotal = goods.reduce((n, d) => n + (d.flash?.listPrice ?? d.price) * d.quantity, 0);
    const quoteSub = Math.max(0, Number(quote.subtotal) || 0);
    if (quoteSub > 0 && Math.abs(listSubtotal - quoteSub) / quoteSub > 0.01) {
      return fail(409, { error: "Giá hàng đã đổi — báo giá ship lại", code: "quote_stale" });
    }
    if (quote.province !== province || quote.ward !== ward) {
      return fail(400, { error: "Địa chỉ lệch báo giá ship" });
    }
    if (quote.district && district && quote.district !== district) {
      return fail(400, { error: "Quận/huyện lệch báo giá ship" });
    }
    if (quote.ghnWardCode && ghnWardCode && quote.ghnWardCode !== ghnWardCode) {
      return fail(400, { error: "Phường/xã lệch báo giá ship" });
    }
    let shippingFee = 0;
    if (quote.fee != null) {
      const clientFee =
        body.shippingFee == null ? null : Math.max(0, Number(body.shippingFee) || 0);
      if (clientFee !== quote.fee) {
        return fail(400, { error: "Phí ship đã thay đổi — báo giá lại" });
      }
      shippingFee = quote.fee;
    }
    return {
      ok: true,
      quoteToken,
      quoteVerified: quote,
      shippingFee,
      shippingCarrier: quote.carrier || undefined,
      totalWeightGram: quote.totalWeightGram,
      freeShipApplied: Boolean(quote.freeShipApplied),
    };
  } catch (e: any) {
    return fail(400, { error: e?.message || "Mã phí ship hết hạn — báo giá lại" });
  }
}
