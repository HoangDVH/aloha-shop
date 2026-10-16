import type { Response, NextFunction } from "express";
import { z } from "zod";
import type { GetShopDb, ShopAuthRequest } from "../shopAuth/routes.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { isActiveWholesale } from "../shopWholesale/policy.js";
import { purchaseHistory } from "../shopWholesale/purchaseHistory.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";

type History = "returning" | "new" | "unknown";
const cartSchema = z.array(z.object({
  quantity: z.coerce.number().optional(), qty: z.coerce.number().optional(),
}).passthrough().refine(line => {
  const quantity = line.quantity ?? line.qty;
  return Number.isSafeInteger(quantity) && quantity! >= 1 && quantity! <= 10_000;
})).min(1).max(100);
export function wholesaleIdentity(account: any): string {
  return JSON.stringify([String(account?._id), account?.kvCustomerId, account?.kvRetailer, account?.siRegion]);
}

/** Bound the entire lookup, including credential reads and token acquisition. */
export async function boundedHistory(lookup: (signal: AbortSignal) => Promise<History>, timeoutMs = 5_000): Promise<History> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<History>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve("unknown"); }, timeoutMs);
  });
  try { return await Promise.race([lookup(controller.signal).catch(() => "unknown" as const), deadline]); }
  finally { clearTimeout(timer!); }
}

/** Runs before the global stock/promotion lock. No request-body history is trusted. */
export function prepareWholesaleHistory(getShopDb: GetShopDb, getMainDb: GetShopDb) {
  return async (req: ShopAuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!(await shopRateLimitOrReject(req, res, "shop_order_create", 20, 60_000))) return;
      const raw = req.body?.orderDetails || req.body?.items;
      if (!cartSchema.safeParse(raw).success) {
        res.status(400).json({ code: "invalid_cart", error: "Giỏ hàng hoặc số lượng không hợp lệ" }); return;
      }
      const db = await getShopDb();
      const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.shopAuth!.userId));
      const identity = wholesaleIdentity(account);
      const history = isActiveWholesale(account) && account?.siRegion === "HCM"
        ? await boundedHistory(async signal => purchaseHistory(db, await getMainDb(), account, undefined, signal))
        : "new";
      res.locals.wholesaleHistory = { identity, history };
      next();
    } catch (e) { next(e); }
  };
}

export function preparedWholesaleHistory(res: Response, account: any): History | null {
  const snapshot = res.locals.wholesaleHistory;
  return snapshot?.identity === wholesaleIdentity(account) ? snapshot.history : null;
}
