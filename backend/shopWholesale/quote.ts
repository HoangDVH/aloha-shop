import type { Express } from "express";
import type { Db } from "mongodb";
import { z } from "zod";
import { requireShopAuth, type ShopAuthRequest } from "../shopAuth/routes.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { applyCatalogPrices, parseOrderDetails } from "../shopOrders/orderRouteShared.js";
import { isActiveWholesale, wholesaleMinimum } from "./policy.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";

export function registerShopCartQuote(app: Express, getDb: () => Promise<Db>, getCatalogDb: () => Promise<Db>) {
  app.post("/api/shop/cart/quote", requireShopAuth(getDb), async (req: ShopAuthRequest, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!(await shopRateLimitOrReject(req, res, "cart_quote", 60, 60000))) return;
    try {
      const input = z.object({ items: z.array(z.object({ productCode: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(10000) })).min(1).max(100) }).parse(req.body);
      const db = await getDb();
      const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.shopAuth!.userId));
      const priced = await applyCatalogPrices(await getCatalogDb(), parseOrderDetails(input.items), { account, quoteOnly: true });
      if (!priced.ok) return res.status(400).json({ error: priced.error });
      const priceMode = isActiveWholesale(account) ? "si" : "web";
      const subtotal = priced.details.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const minimum = priceMode === "si" ? wholesaleMinimum(account?.siRegion) : 0;
      const missing = priced.details.filter(line => line.priceKind === "si_missing" || !(line.price > 0)).map(line => line.productCode);
      res.json({ priceMode, region: account?.siRegion || null, subtotal, minimum, remaining: Math.max(0, minimum - subtotal),
        missing, canCheckout: missing.length === 0 && subtotal >= minimum, items: priced.details });
    } catch (error: any) {
      res.status(error.issues ? 400 : 503).json({ error: error.issues?.[0]?.message || "Chưa kiểm tra được giá giỏ hàng. Vui lòng thử lại." });
    }
  });
}
