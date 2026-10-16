import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { checkWholesalePurchase } from "./purchaseCheck.js";
export async function checkStoredWholesaleOrder(shop: Db, ops: Db, order: any) {
  if (order.priceMode !== "si") return null;
  const account = await shop.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(String(order.shopAccountId)));
  if (!account) throw new Error("Không tìm thấy tài khoản sỉ của đơn hàng");
  return checkWholesalePurchase(shop, ops, account, order.orderDetails || [],
    { deliveryMethod: order.deliveryMethod, province: order.province, district: order.district, ward: order.ward }, String(order.code));
}
