import type { Db } from "mongodb";
import type { ShopOrderDetail } from "../shopOrders/models.js";
import type { CartItemToEvaluate } from "../shopPromotions/types.js";
import { priceWithCampaign, type CampaignBuyer } from "./orderCampaign.js";

/** Dòng giỏ sau giá chiến dịch, trả về cho client hiển thị (không giữ suất). */
export type QuoteLine = {
  ma: string;
  ten: string;
  quantity: number;
  price: number;
  volumePricing?: ShopOrderDetail["volumePricing"];
  listPrice?: number;
  compareAtPrice?: number;
  flash?: boolean;
  isGift?: boolean;
  giftFor?: string;
  note?: string;
};

export type CampaignQuote = {
  /** Đầu vào cho bộ tính voucher: giá flash đã áp, không có dòng quà. */
  items: CartItemToEvaluate[];
  lines: QuoteLine[];
  flashSavings: number;
  volumeSavings: number;
  anchorSavings: number;
  notices: string[];
};

function toLine(d: ShopOrderDetail): QuoteLine {
  return {
    ma: d.productCode,
    ten: d.productName,
    quantity: d.quantity,
    price: d.price,
    volumePricing: d.volumePricing,
    ...(d.flash ? { flash: true, listPrice: d.flash.listPrice } : {}),
    ...(d.isGift ? { isGift: true, giftFor: d.gift?.giftFor, note: d.note } : {}),
  };
}

/** Báo giá giỏ: cùng hàm tính với lúc tạo đơn nên số khách thấy khớp số server thu. */
export async function quoteWithCampaign(
  db: Db,
  items: CartItemToEvaluate[],
  buyer: CampaignBuyer
): Promise<CampaignQuote> {
  const details: ShopOrderDetail[] = items.map((it) => ({
    productCode: it.ma,
    productName: it.ten,
    quantity: it.quantity,
    price: it.price,
    volumePricing: it.volumePricing,
  }));
  const r = await priceWithCampaign(db, details, buyer);
  const byMa = new Map(items.map((it) => [it.ma, it]));
  const evalItems = r.details
    .filter((d) => !d.isGift)
    .map((d) => ({ ...byMa.get(d.productCode)!, price: d.price, quantity: d.quantity, flash: Boolean(d.flash) }));
  return {
    items: evalItems,
    lines: r.details.map(d => ({ ...toLine(d), compareAtPrice: r.referencePrices?.[d.productCode] })),
    flashSavings: r.flashSavings,
    volumeSavings: r.details.reduce((n, d) => n + (d.volumePricing ? Math.max(0, d.volumePricing.basePrice - (d.flash?.listPrice ?? d.price)) * d.quantity : 0), 0),
    anchorSavings: r.anchorSavings,
    notices: r.notices,
  };
}
