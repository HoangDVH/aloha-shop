import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import type { GetShopDb } from "../shopAuth/routes.js";
import { applyShopCors } from "../shopCors.js";
import {
  PROMOTIONS_COL,
  PROMOTION_AUDIT_COL,
  type PromotionDoc,
  type PromotionAuditDoc,
} from "./types.js";
import {
  buildNewPromotion,
  buildPromotionUpdate,
  isPayloadFail,
  newId,
} from "./admin/promotionPayload.js";
import { registerPromotionPreviewRoute, type AdminGate } from "./admin/previewRoute.js";
import { registerPromotionCodeReportRoutes } from "./admin/codeReportRoutes.js";
import { registerPromotionReviewRoutes } from "./admin/reviewRoutes.js";

const actorOf = (req: AuthRequest) => String(req.auth?.username || req.auth?.userId || "admin");

function registerListAndCreate(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  // GET /api/shop/admin/promotions — Danh sách chương trình
  app.get("/api/shop/admin/promotions", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const status = String(req.query.status || "all").trim();
      const type = String(req.query.type || "all").trim();
      const q = String(req.query.q || "").trim().toLowerCase();

      const query: Record<string, unknown> = {};
      // Mặc định không hiện archived trừ khi chọn filter riêng
      query.status = status !== "all" ? status : { $ne: "archived" };
      if (type !== "all") query.type = type;

      let items = await shopDb
        .collection<PromotionDoc>(PROMOTIONS_COL)
        .find(query)
        .sort({ priority: -1, createdAt: -1 })
        .toArray();
      if (q) {
        items = items.filter(
          (p) =>
            (p.name || "").toLowerCase().includes(q) ||
            (p.title || "").toLowerCase().includes(q) ||
            (p.id || "").toLowerCase().includes(q)
        );
      }
      const total = items.length;
      res.json({
        ok: true,
        items: items.slice((page - 1) * limit, page * limit),
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải danh sách ưu đãi" });
    }
  });

  // POST /api/shop/admin/promotions — Tạo chương trình mới
  app.post("/api/shop/admin/promotions", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const nowIso = new Date().toISOString();
      const actor = actorOf(req);
      const built = buildNewPromotion(req.body || {}, actor, nowIso);
      if (isPayloadFail(built)) return res.status(built.status).json({ ok: false, error: built.error });
      const doc = built.value;

      await shopDb.collection<PromotionDoc>(PROMOTIONS_COL).insertOne(doc as any);
      await shopDb.collection<PromotionAuditDoc>(PROMOTION_AUDIT_COL).insertOne({
        id: newId("aud"),
        promotionId: doc.id,
        action: "create",
        actor,
        after: doc as any,
        createdAt: nowIso,
      });
      res.json({ ok: true, item: doc });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tạo ưu đãi" });
    }
  });
}

function registerDetailAndUpdate(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  // GET /api/shop/admin/promotions/:id — Lấy chi tiết
  app.get("/api/shop/admin/promotions/:id", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const id = String(req.params.id || "").trim();
      const item = await shopDb.collection<PromotionDoc>(PROMOTIONS_COL).findOne({ id });
      if (!item) return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });
      res.json({ ok: true, item });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải chi tiết ưu đãi" });
    }
  });

  // PATCH /api/shop/admin/promotions/:id — Sửa chương trình
  app.patch("/api/shop/admin/promotions/:id", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const id = String(req.params.id || "").trim();
      const col = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);
      const existing = await col.findOne({ id });
      if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });

      const b = req.body || {};
      const expectedRevision = Number(b.revision);
      if (expectedRevision && existing.revision !== expectedRevision) {
        return res.status(409).json({
          ok: false,
          error: "Dữ liệu đã được người khác cập nhật trước đó. Vui lòng tải lại trang.",
        });
      }
      const nowIso = new Date().toISOString();
      const actor = actorOf(req);
      const built = buildPromotionUpdate(b, existing, actor, nowIso);
      if (isPayloadFail(built)) return res.status(built.status).json({ ok: false, error: built.error });

      await col.updateOne({ id }, { $set: built.value });
      const updated = await col.findOne({ id });
      await shopDb.collection<PromotionAuditDoc>(PROMOTION_AUDIT_COL).insertOne({
        id: newId("aud"),
        promotionId: id,
        action: "update",
        actor,
        before: existing as any,
        after: updated as any,
        createdAt: nowIso,
      });
      res.json({ ok: true, item: updated });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi cập nhật ưu đãi" });
    }
  });
}

function registerStatusAndDuplicate(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  // POST /api/shop/admin/promotions/:id/status — Đổi trạng thái nhanh
  app.post("/api/shop/admin/promotions/:id/status", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const id = String(req.params.id || "").trim();
      const newStatus = String(req.body?.status || "").trim();
      if (!["active", "paused", "archived"].includes(newStatus)) {
        return res.status(400).json({ ok: false, error: "Trạng thái không hợp lệ" });
      }
      const col = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);
      const existing = await col.findOne({ id });
      if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });
      await col.updateOne(
        { id },
        {
          $set: {
            status: newStatus as any,
            updatedAt: new Date().toISOString(),
            updatedBy: actorOf(req),
            revision: (existing.revision || 1) + 1,
          },
        }
      );
      res.json({ ok: true, status: newStatus });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi cập nhật trạng thái" });
    }
  });

  // POST /api/shop/admin/promotions/:id/duplicate — Nhân bản thành bản nháp
  app.post("/api/shop/admin/promotions/:id/duplicate", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const id = String(req.params.id || "").trim();
      const col = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);
      const existing = await col.findOne({ id });
      if (!existing) return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });

      const nowIso = new Date().toISOString();
      const { _id, ...rest } = existing as any;
      const clonedDoc: PromotionDoc = {
        ...rest,
        id: newId("pro"),
        name: `${existing.name} (Bản sao)`,
        title: existing.title,
        status: "draft",
        budgetUsed: 0,
        budgetHeld: 0,
        usedCount: 0,
        heldCount: 0,
        claimedCount: 0,
        revision: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        updatedBy: actorOf(req),
      };
      await col.insertOne(clonedDoc as any);
      res.json({ ok: true, item: clonedDoc });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi nhân bản ưu đãi" });
    }
  });
}

export function registerShopPromotionsAdminRoutes(
  app: Express,
  getOpsDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate: AdminGate = [requireAuth(getOpsDb), requireActive, requireManager];

  app.options("/api/shop/admin/promotions*", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });

  registerListAndCreate(app, gate, getShopDb);
  registerPromotionReviewRoutes(app, gate, getShopDb);
  registerDetailAndUpdate(app, gate, getShopDb);
  registerStatusAndDuplicate(app, gate, getShopDb);
  registerPromotionPreviewRoute(app, gate, getShopDb);
  registerPromotionCodeReportRoutes(app, gate, getShopDb);
}
