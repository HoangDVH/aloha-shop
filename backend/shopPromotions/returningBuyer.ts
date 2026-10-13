import type { Db } from "mongodb";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { normalizeVietnamesePhone } from "./phoneNormalization.js";
export async function hasSuccessfulWebPurchase(db: Db, buyer: { phone?: string; email?: string; userId?: string }): Promise<boolean> {
  const identities: Record<string, unknown>[] = [];
  const phone = normalizeVietnamesePhone(buyer.phone || "");
  if (phone.valid) {
    if (phone.normalized) identities.push({ customerPhone: phone.normalized });
    if (phone.localPhone) identities.push({ customerPhone: phone.localPhone });
  }
  const email = String(buyer.email || "").trim().toLowerCase();
  if (email) identities.push({ customerEmail: email }, { "account.email": email });
  if (buyer.userId) identities.push({ shopAccountId: buyer.userId });
  if (!identities.length) return false;
  return Boolean(await db.collection(SHOP_ORDERS).findOne({ $or: identities,
    $and: [{ orderStatus: { $nin: ["da_huy", "huy", "that_bai", "cancelled"] } },
      { $or: [{ paymentStatus: "paid" }, { orderStatus: { $in: ["hoan_thanh", "da_giao"] } }, { done: true }] }],
  }, { projection: { _id: 1 } }));
}
