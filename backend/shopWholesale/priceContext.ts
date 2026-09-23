import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestHandler } from "express";
import type { Db } from "mongodb";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { isActiveWholesale, type PriceMode } from "./policy.js";

export const priceContext = new AsyncLocalStorage<{ mode: PriceMode }>();
export const currentPriceMode = (): PriceMode => priceContext.getStore()?.mode || "web";

/** Context stays request-local through async catalog helpers and cache loaders. */
export function catalogPriceContext(getDb: () => Promise<Db>): RequestHandler {
  return async (req, res, next) => {
    let mode: PriceMode = "web";
    const token = req.cookies?.[ACCESS_COOKIE];
    if (token) {
      let auth: ReturnType<typeof verifyShopAccessToken> | null = null;
      try { auth = verifyShopAccessToken(token); } catch { /* Invalid tokens authorize public prices only. */ }
      try {
        if (auth) {
          const db = await getDb();
          const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(auth.sub));
          if (isActiveWholesale(account) && Number(auth.iat || 0) >= Number(account?.authInvalidBefore || 0)) mode = "si";
        }
      } catch {
        res.setHeader("Cache-Control", "private, no-store");
        res.status(503).json({ error: "Chưa xác minh được chính sách giá. Vui lòng thử lại." });
        return;
      }
      const original = res.setHeader.bind(res);
      res.setHeader = ((name: string, value: any) => original(name,
        name.toLowerCase() === "cache-control" ? "private, no-store" : value)) as typeof res.setHeader;
      res.setHeader("Cache-Control", "private, no-store");
      res.vary("Cookie");
    }
    priceContext.run({ mode }, next);
  };
}
