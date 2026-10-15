import type { Db } from "mongodb";
import { hasSuccessfulWebPurchase } from "./returningBuyer.js";
import { checkIsNewWebBuyer } from "./customerEligibility.js";
import { PROMOTION_CLAIMS_COL, POLICY_GROUP_FIRST_PURCHASE } from "./claimService.js";

/** Purchase history defines the audience; a held first-order claim only blocks use. */
export async function resolveVoucherBuyer(db: Db, buyer: { userId?: string; phone?: string; email?: string }) {
  const returning = await hasSuccessfulWebPurchase(db, buyer);
  const isNewWebBuyer = !returning && await checkIsNewWebBuyer(db, buyer);
  let newVoucherBlockReason: string | undefined;
  if (!returning && !isNewWebBuyer) {
    // Only disclose an order number for this account, never another account
    // sharing its phone number.
    const held = buyer.userId ? await db.collection(PROMOTION_CLAIMS_COL).findOne({
      policyGroup: POLICY_GROUP_FIRST_PURCHASE, identityType: "account", identityKey: buyer.userId,
      state: "held", $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: null }, { leaseUntil: { $gt: new Date().toISOString() } }],
    }, { projection: { orderId: 1 } }) : null;
    newVoucherBlockReason = held?.orderId
      ? `Ưu đãi khách mới đang được sử dụng ở đơn ${held.orderId}.`
      : "Ưu đãi khách mới đã được sử dụng hoặc đang được giữ ở một đơn khác.";
  }
  return { newBuyer: !returning, hasSuccessfulWebPurchase: returning,
    isNewWebBuyer, ...(newVoucherBlockReason ? { newVoucherBlockReason } : {}) };
}
