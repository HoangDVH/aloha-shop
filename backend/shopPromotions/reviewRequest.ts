import type { Response } from "express";
import { z } from "zod";
import type { GetShopDb, ShopAuthRequest } from "../shopAuth/routes.js";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { requestPromotionReview } from "./reviewService.js";

const bodySchema = z.object({
  orderId: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(1000).default(""),
  // Retained for older clients; never used as an authorization identity.
  accountId: z.string().max(100).optional(),
  buyerPhone: z.string().max(30).optional(),
}).strict();

export function promotionReviewRequest(getShopDb: GetShopDb) {
  return async (req: ShopAuthRequest, res: Response) => {
    if (!req.shopAuth?.userId) return res.status(401).json({ ok: false, code: "unauthorized" });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, code: "invalid_request" });
    try {
      const db = await getShopDb();
      const accountId = req.shopAuth.userId;
      const order = await db.collection(SHOP_ORDERS).findOne({
        shopAccountId: accountId,
        $or: [{ code: parsed.data.orderId }, { id: parsed.data.orderId }],
      }, { projection: { code: 1, id: 1, customerPhone: 1 } });
      if (!order) return res.status(404).json({ ok: false, code: "order_not_found" });
      if (!(await shopRateLimitOrReject(req, res, "promotion_review_request", 3, 86_400_000))) return;
      const result = await requestPromotionReview(db, {
        orderId: String(order.code || order.id), accountId,
        buyerPhone: String(order.customerPhone || ""), reason: parsed.data.reason,
      });
      return res.status(result.ok ? 200 : ("code" in result && result.code === "rate_limited") ? 429 : 400).json(result);
    } catch {
      return res.status(500).json({ ok: false, code: "review_request_failed" });
    }
  };
}
