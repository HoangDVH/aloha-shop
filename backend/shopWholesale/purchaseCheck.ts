import type { Db } from "mongodb";
import type { ShopOrderDetail } from "../shopOrders/models.js";
import { loadPurchasePolicy, evaluatePurchasePolicy, type WholesaleDelivery } from "./purchasePolicy.js";
import { purchaseHistory } from "./purchaseHistory.js";

export async function checkWholesalePurchase(shopDb: Db, opsDb: Db, account: any, lines: ShopOrderDetail[],
  delivery?: WholesaleDelivery, excludeCode?: string, preparedHistory?: "returning" | "new" | "unknown") {
  const [policy, products] = await Promise.all([loadPurchasePolicy(shopDb), shopDb.collection("aloha_products")
    .find({ ma: { $in: lines.map(l => l.productCode).flatMap(code => [code, code.toLowerCase()]) }, deletedAt: null })
    .project({ ma: 1, categoryName: 1, ancestor: 1, siPurchaseGroup: 1, mergedInto: 1 }).toArray()]);
  const byCode = new Map<string, any>();
  for (const p of products) {
    const code = String(p.ma).trim().toUpperCase();
    if (!p.mergedInto || !byCode.has(code)) byCode.set(code, p);
  }
  const history = account.siRegion === "HCM" ? (preparedHistory ?? await purchaseHistory(shopDb, opsDb, account, excludeCode)) : "new";
  return evaluatePurchasePolicy({ account, lines, products: byCode, policy, history, delivery });
}
