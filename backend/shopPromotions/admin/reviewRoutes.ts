import type { Express, Response } from "express";
import type { AuthRequest } from "../../auth/middleware.js";
import type { GetShopDb } from "../../shopAuth/routes.js";
import { applyShopCors } from "../../shopCors.js";
import { PROMOTION_REVIEWS_COL, decidePromotionReview } from "../reviewService.js";
import type { AdminGate } from "./previewRoute.js";

const reviewView = (r: any) => ({
  id: r.id,
  orderId: r.orderId,
  accountId: r.accountId,
  buyerPhoneMasked: r.buyerPhoneMasked,
  reasons: r.reasons,
  state: r.state,
  decisionVersion: r.decisionVersion,
  actor: r.actor,
  decisionNote: r.decisionNote,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** Phải đăng ký trước `GET /api/shop/admin/promotions/:id`, nếu không `/reviews` bị bắt nhầm thành id. */
export function registerPromotionReviewRoutes(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  // GET /api/shop/admin/promotions/reviews — Danh sách yêu cầu xem xét (mục 9, 10, AB33)
  app.get("/api/shop/admin/promotions/reviews", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const reviews = await shopDb
        .collection(PROMOTION_REVIEWS_COL)
        .find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      res.json({ ok: true, items: reviews.map(reviewView) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải danh sách yêu cầu xem xét" });
    }
  });

  // POST /api/shop/admin/promotions/reviews/:id/decide — Duyệt / từ chối có version control (mục 9, AB06, AB32)
  app.post(
    "/api/shop/admin/promotions/reviews/:id/decide",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const body = req.body || {};
        const decision = body.decision;
        const decisionVersion = Number(body.decisionVersion);
        if (decision !== "approved" && decision !== "rejected") {
          return res.status(400).json({ ok: false, error: "Quyết định phải là 'approved' hoặc 'rejected'" });
        }
        if (!Number.isSafeInteger(decisionVersion)) {
          return res.status(400).json({ ok: false, error: "Thiếu decisionVersion để chống xung đột ghi đè" });
        }
        const result = await decidePromotionReview(shopDb, {
          reviewId: String(req.params.id || "").trim(),
          decision,
          decisionVersion,
          actor: String((req as any).user?.username || (req as any).user?.email || "admin"),
          decisionNote: String(body.decisionNote || "").trim(),
        });
        if (!result.ok) {
          return res.status((result as any).code === "version_conflict" ? 409 : 400).json(result);
        }
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi cập nhật quyết định xem xét" });
      }
    }
  );
}
