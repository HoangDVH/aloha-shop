import type { Db } from "mongodb";
import { hasSuccessfulWebPurchase } from "./returningBuyer.js";
import { checkIsNewWebBuyer } from "./customerEligibility.js";

/** Purchase history defines the audience; a held first-order claim only blocks use. */
export async function resolveVoucherBuyer(db: Db, buyer: { userId?: string; phone?: string; email?: string }) {
  const returning = await hasSuccessfulWebPurchase(db, buyer);
  return { newBuyer: !returning, hasSuccessfulWebPurchase: returning,
    isNewWebBuyer: !returning && await checkIsNewWebBuyer(db, buyer) };
}
