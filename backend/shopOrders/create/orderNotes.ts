import { isShopTestBuyerEmail } from "../checkoutFlags.js";
import type { ShopOrderDetail } from "../models.js";
import { reviewOrderKvDescription } from "./kvDescription.js";

export type OrderNotes = {
  isTest: boolean;
  ctvNote: string;
  customerNoteStored: string;
  kvPreOrderHint: string;
  reviewKvDescription: string;
};

/** Gắn nhãn [TEST-WEB] / [DAT-TRUOC] / CTV vào ghi chú đơn và mô tả KV. */
export function buildOrderNotes(input: {
  body: any;
  customerNote: string;
  buyerEmail: string;
  orderDetails: ShopOrderDetail[];
  ctvCodes: string[];
  hasPreOrder: boolean;
}): OrderNotes {
  const { body, customerNote, buyerEmail, orderDetails, ctvCodes, hasPreOrder } = input;
  const hasZeroPriceTestItem = orderDetails.some((d) => !(Number(d.price) > 0));
  const isTest =
    Boolean(body.isTest) ||
    String(customerNote || "").toUpperCase().includes("[TEST-WEB]") ||
    (hasZeroPriceTestItem && isShopTestBuyerEmail(buyerEmail));
  const ctvNote = ctvCodes.length > 0 ? `CTV:${ctvCodes.join(",")}` : "";
  let n = customerNote;
  if (hasPreOrder && !n.toUpperCase().includes("[DAT-TRUOC]")) n = `[DAT-TRUOC] ${n}`.trim();
  if (isTest && !String(n).includes("[TEST-WEB]")) n = `[TEST-WEB] ${n}`.trim();
  const reviewKvDescription = reviewOrderKvDescription(
    orderDetails,
    [ctvNote, isTest ? "[TEST-WEB]" : "", customerNote].filter(Boolean).join(" | ")
  );
  return {
    isTest,
    ctvNote,
    customerNoteStored: n.slice(0, 255),
    kvPreOrderHint: hasPreOrder ? "ĐẶT TRƯỚC — SP hết hàng, cần nhập hàng ngay" : "",
    reviewKvDescription,
  };
}
