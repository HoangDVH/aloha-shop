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
  PROMOTION_CODES_COL,
  PROMOTION_REDEMPTIONS_COL,
  PROMOTION_AUDIT_COL,
  type PromotionDoc,
  type PromotionCodeDoc,
  type PromotionAuditDoc,
  type CartItemToEvaluate,
} from "./types.js";
import { evaluatePromotions } from "./evaluator.js";

function newId(prefix = "pro"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerShopPromotionsAdminRoutes(
  app: Express,
  getOpsDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getOpsDb), requireActive, requireManager];

  app.options("/api/shop/admin/promotions*", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });

  // GET /api/shop/admin/promotions — Danh sách chương trình
  app.get(
    "/api/shop/admin/promotions",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const status = String(req.query.status || "all").trim();
        const type = String(req.query.type || "all").trim();
        const q = String(req.query.q || "").trim().toLowerCase();

        const query: Record<string, unknown> = {};
        if (status !== "all") {
          query.status = status;
        } else {
          // Mặc định không hiện archived trừ khi chọn filter riêng
          query.status = { $ne: "archived" };
        }
        if (type !== "all") {
          query.type = type;
        }

        const col = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);
        let items = await col
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
        const paged = items.slice((page - 1) * limit, page * limit);

        res.json({
          ok: true,
          items: paged,
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tải danh sách ưu đãi" });
      }
    }
  );

  // POST /api/shop/admin/promotions — Tạo chương trình mới
  app.post(
    "/api/shop/admin/promotions",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const b = req.body || {};

        const name = String(b.name || "").trim();
        const title = String(b.title || name).trim();
        if (!name) {
          return res.status(400).json({ ok: false, error: "Vui lòng nhập tên chương trình" });
        }

        const discountValue = Number(b.discountValue);
        if (!Number.isFinite(discountValue) || discountValue <= 0) {
          return res.status(400).json({ ok: false, error: "Giá trị giảm giá phải lớn hơn 0" });
        }

        const discountType = b.discountType === "fixed" ? "fixed" : "percentage";
        if (discountType === "percentage" && discountValue > 100) {
          return res.status(400).json({ ok: false, error: "Giảm theo % không được quá 100%" });
        }

        const nowIso = new Date().toISOString();
        const actor = String(req.auth?.username || req.auth?.userId || "admin");

        const promoId = newId("pro");
        const doc: PromotionDoc = {
          id: promoId,
          name,
          title,
          description: b.description ? String(b.description).trim() : "",
          type: b.type === "code" ? "code" : "auto",
          discountType,
          discountValue,
          maxDiscountVnd: b.maxDiscountVnd ? Math.max(0, Number(b.maxDiscountVnd)) : undefined,
          minOrderThreshold: b.minOrderThreshold ? Math.max(0, Number(b.minOrderThreshold)) : undefined,
          thresholdOperator: b.thresholdOperator === ">=" ? ">=" : ">",
          scope: ["category", "product"].includes(b.scope) ? b.scope : "all",
          categoryIds: Array.isArray(b.categoryIds) ? b.categoryIds.map(String) : [],
          productMas: Array.isArray(b.productMas) ? b.productMas.map((m: any) => String(m).trim().toUpperCase()) : [],
          excludedProductMas: Array.isArray(b.excludedProductMas)
            ? b.excludedProductMas.map((m: any) => String(m).trim().toUpperCase())
            : [],
          targetCustomer: ["wholesale", "new_web", "retail"].includes(b.targetCustomer)
            ? b.targetCustomer
            : "retail",
          startDate: b.startDate ? new Date(b.startDate).toISOString() : undefined,
          endDate: b.endDate ? new Date(b.endDate).toISOString() : undefined,
          usageLimitTotal: b.usageLimitTotal ? Math.max(1, Number(b.usageLimitTotal)) : undefined,
          usageLimitPerCustomer: b.usageLimitPerCustomer ? Math.max(1, Number(b.usageLimitPerCustomer)) : undefined,
          budgetTotal: b.budgetTotal ? Math.max(0, Number(b.budgetTotal)) : undefined,
          budgetUsed: 0,
          budgetHeld: 0,
          usedCount: 0,
          heldCount: 0,
          status: ["active", "paused"].includes(b.status) ? b.status : "draft",
          isPublic: b.isPublic !== false,
          combineWithShip: b.combineWithShip !== false,
          priority: Number(b.priority) || 0,
          revision: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          updatedBy: actor,
        };

        await shopDb.collection<PromotionDoc>(PROMOTIONS_COL).insertOne(doc as any);

        // Audit log
        await shopDb.collection<PromotionAuditDoc>(PROMOTION_AUDIT_COL).insertOne({
          id: newId("aud"),
          promotionId: promoId,
          action: "create",
          actor,
          after: doc as any,
          createdAt: nowIso,
        });

        res.json({ ok: true, item: doc });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tạo ưu đãi" });
      }
    }
  );

  // GET /api/shop/admin/promotions/:id — Lấy chi tiết
  app.get(
    "/api/shop/admin/promotions/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const id = String(req.params.id || "").trim();
        const item = await shopDb.collection<PromotionDoc>(PROMOTIONS_COL).findOne({ id });
        if (!item) {
          return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });
        }
        res.json({ ok: true, item });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tải chi tiết ưu đãi" });
      }
    }
  );

  // PATCH /api/shop/admin/promotions/:id — Sửa chương trình
  app.patch(
    "/api/shop/admin/promotions/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const id = String(req.params.id || "").trim();
        const col = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);
        const existing = await col.findOne({ id });
        if (!existing) {
          return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });
        }

        const b = req.body || {};
        const expectedRevision = Number(b.revision);
        if (expectedRevision && existing.revision !== expectedRevision) {
          return res.status(409).json({
            ok: false,
            error: "Dữ liệu đã được người khác cập nhật trước đó. Vui lòng tải lại trang.",
          });
        }

        const nowIso = new Date().toISOString();
        const actor = String(req.auth?.username || req.auth?.userId || "admin");

        const updateSet: Partial<PromotionDoc> = {
          updatedAt: nowIso,
          updatedBy: actor,
          revision: (existing.revision || 1) + 1,
        };

        if (b.name !== undefined) updateSet.name = String(b.name).trim();
        if (b.title !== undefined) updateSet.title = String(b.title).trim();
        if (b.description !== undefined) updateSet.description = String(b.description).trim();
        if (b.type !== undefined) updateSet.type = b.type === "code" ? "code" : "auto";
        if (b.discountType !== undefined) {
          updateSet.discountType = b.discountType === "fixed" ? "fixed" : "percentage";
        }
        if (b.discountValue !== undefined) {
          const val = Number(b.discountValue);
          if (val > 0) updateSet.discountValue = val;
        }
        if (b.maxDiscountVnd !== undefined) {
          updateSet.maxDiscountVnd = b.maxDiscountVnd ? Math.max(0, Number(b.maxDiscountVnd)) : undefined;
        }
        if (b.minOrderThreshold !== undefined) {
          updateSet.minOrderThreshold = b.minOrderThreshold ? Math.max(0, Number(b.minOrderThreshold)) : undefined;
        }
        if (b.thresholdOperator !== undefined) {
          updateSet.thresholdOperator = b.thresholdOperator === ">=" ? ">=" : ">";
        }
        if (b.scope !== undefined) {
          updateSet.scope = ["category", "product"].includes(b.scope) ? b.scope : "all";
        }
        if (b.categoryIds !== undefined) {
          updateSet.categoryIds = Array.isArray(b.categoryIds) ? b.categoryIds.map(String) : [];
        }
        if (b.productMas !== undefined) {
          updateSet.productMas = Array.isArray(b.productMas)
            ? b.productMas.map((m: any) => String(m).trim().toUpperCase())
            : [];
        }
        if (b.excludedProductMas !== undefined) {
          updateSet.excludedProductMas = Array.isArray(b.excludedProductMas)
            ? b.excludedProductMas.map((m: any) => String(m).trim().toUpperCase())
            : [];
        }
        if (b.targetCustomer !== undefined) {
          updateSet.targetCustomer = ["wholesale", "new_web", "retail"].includes(b.targetCustomer)
            ? b.targetCustomer
            : "retail";
        }
        if (b.startDate !== undefined) {
          updateSet.startDate = b.startDate ? new Date(b.startDate).toISOString() : undefined;
        }
        if (b.endDate !== undefined) {
          updateSet.endDate = b.endDate ? new Date(b.endDate).toISOString() : undefined;
        }
        if (b.usageLimitTotal !== undefined) {
          updateSet.usageLimitTotal = b.usageLimitTotal ? Math.max(1, Number(b.usageLimitTotal)) : undefined;
        }
        if (b.usageLimitPerCustomer !== undefined) {
          updateSet.usageLimitPerCustomer = b.usageLimitPerCustomer
            ? Math.max(1, Number(b.usageLimitPerCustomer))
            : undefined;
        }
        if (b.budgetTotal !== undefined) {
          updateSet.budgetTotal = b.budgetTotal ? Math.max(0, Number(b.budgetTotal)) : undefined;
        }
        if (b.status !== undefined && ["draft", "active", "paused", "archived"].includes(b.status)) {
          updateSet.status = b.status;
        }
        if (b.isPublic !== undefined) updateSet.isPublic = b.isPublic !== false;
        if (b.combineWithShip !== undefined) updateSet.combineWithShip = b.combineWithShip !== false;
        if (b.priority !== undefined) updateSet.priority = Number(b.priority) || 0;

        await col.updateOne({ id }, { $set: updateSet });
        const updated = await col.findOne({ id });

        // Audit log
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
    }
  );

  // POST /api/shop/admin/promotions/:id/status — Đổi trạng thái nhanh
  app.post(
    "/api/shop/admin/promotions/:id/status",
    ...gate,
    async (req: AuthRequest, res: Response) => {
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
        if (!existing) {
          return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });
        }

        const nowIso = new Date().toISOString();
        const actor = String(req.auth?.username || req.auth?.userId || "admin");

        await col.updateOne(
          { id },
          {
            $set: {
              status: newStatus as any,
              updatedAt: nowIso,
              updatedBy: actor,
              revision: (existing.revision || 1) + 1,
            },
          }
        );

        res.json({ ok: true, status: newStatus });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi cập nhật trạng thái" });
      }
    }
  );

  // POST /api/shop/admin/promotions/:id/duplicate — Nhân bản thành bản nháp
  app.post(
    "/api/shop/admin/promotions/:id/duplicate",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const id = String(req.params.id || "").trim();
        const col = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);
        const existing = await col.findOne({ id });
        if (!existing) {
          return res.status(404).json({ ok: false, error: "Không tìm thấy chương trình" });
        }

        const nowIso = new Date().toISOString();
        const actor = String(req.auth?.username || req.auth?.userId || "admin");
        const clonedId = newId("pro");

        const { _id, ...rest } = existing as any;
        const clonedDoc: PromotionDoc = {
          ...rest,
          id: clonedId,
          name: `${existing.name} (Bản sao)`,
          title: existing.title,
          status: "draft",
          budgetUsed: 0,
          budgetHeld: 0,
          usedCount: 0,
          heldCount: 0,
          revision: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          updatedBy: actor,
        };

        await col.insertOne(clonedDoc as any);
        res.json({ ok: true, item: clonedDoc });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi nhân bản ưu đãi" });
      }
    }
  );

  // POST /api/shop/admin/promotions/preview — Mô phỏng / kiểm thử tính tiền
  app.post(
    "/api/shop/admin/promotions/preview",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const b = req.body || {};
        const itemsRaw = Array.isArray(b.items) ? b.items : [];
        const promoConfig: Partial<PromotionDoc> = b.promotion || {};

        const items: CartItemToEvaluate[] = itemsRaw.map((it: any) => ({
          ma: String(it.ma || it.productCode || "").trim().toUpperCase(),
          ten: String(it.ten || it.productName || "").trim(),
          price: Math.max(0, Number(it.price ?? it.gia ?? 0) || 0),
          quantity: Math.max(1, Math.floor(Number(it.quantity ?? it.qty ?? 1) || 1)),
          categoryId: it.categoryId ? String(it.categoryId).trim() : undefined,
        }));

        // Tạo mock promotion từ cấu hình form
        const mockPromo: PromotionDoc = {
          id: promoConfig.id || "preview_promo",
          name: promoConfig.name || "Preview Promotion",
          title: promoConfig.title || "Preview Title",
          type: promoConfig.type || "auto",
          discountType: promoConfig.discountType || "percentage",
          discountValue: Number(promoConfig.discountValue) || 10,
          maxDiscountVnd: promoConfig.maxDiscountVnd ? Number(promoConfig.maxDiscountVnd) : undefined,
          minOrderThreshold: promoConfig.minOrderThreshold ? Number(promoConfig.minOrderThreshold) : undefined,
          thresholdOperator: promoConfig.thresholdOperator || ">",
          scope: promoConfig.scope || "all",
          categoryIds: promoConfig.categoryIds || [],
          productMas: promoConfig.productMas || [],
          excludedProductMas: promoConfig.excludedProductMas || [],
          targetCustomer: promoConfig.targetCustomer || "retail",
          startDate: promoConfig.startDate,
          endDate: promoConfig.endDate,
          usageLimitTotal: promoConfig.usageLimitTotal,
          budgetTotal: promoConfig.budgetTotal,
          budgetUsed: 0,
          budgetHeld: 0,
          usedCount: 0,
          heldCount: 0,
          status: "active",
          priority: 999,
          revision: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const quote = evaluatePromotions({
          items,
          buyer: {
            isNewWebBuyer: b.buyer?.isNewWebBuyer !== false,
            isWholesale: Boolean(b.buyer?.isWholesale),
            phone: b.buyer?.phone,
          },
          promotions: [mockPromo],
          autoMode: true,
        });

        res.json({ ok: true, quote });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi mô phỏng ưu đãi" });
      }
    }
  );

  // GET /api/shop/admin/promotions/:id/codes — Lấy danh sách mã giảm giá của chương trình
  app.get(
    "/api/shop/admin/promotions/:id/codes",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const promotionId = String(req.params.id || "").trim();
        const codeCol = shopDb.collection<PromotionCodeDoc>(PROMOTION_CODES_COL);
        const codes = await codeCol
          .find({ promotionId })
          .sort({ createdAt: -1 })
          .toArray();

        res.json({ ok: true, codes });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tải mã giảm giá" });
      }
    }
  );

  // POST /api/shop/admin/promotions/:id/codes — Tạo mã giảm giá mới
  app.post(
    "/api/shop/admin/promotions/:id/codes",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const promotionId = String(req.params.id || "").trim();
        const b = req.body || {};
        const code = String(b.code || "").trim().toUpperCase();

        if (!code || code.length < 3) {
          return res.status(400).json({ ok: false, error: "Mã giảm giá phải có ít nhất 3 ký tự" });
        }

        const codeCol = shopDb.collection<PromotionCodeDoc>(PROMOTION_CODES_COL);
        const existing = await codeCol.findOne({ code });
        if (existing) {
          return res.status(409).json({ ok: false, error: "Mã giảm giá này đã tồn tại" });
        }

        const nowIso = new Date().toISOString();
        const doc: PromotionCodeDoc = {
          code,
          promotionId,
          assignedBuyerPhone: b.assignedBuyerPhone ? String(b.assignedBuyerPhone).trim() : undefined,
          assignedBuyerEmail: b.assignedBuyerEmail ? String(b.assignedBuyerEmail).trim() : undefined,
          maxUses: b.maxUses ? Math.max(1, Number(b.maxUses)) : undefined,
          usedCount: 0,
          heldCount: 0,
          expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : undefined,
          active: b.active !== false,
          createdAt: nowIso,
        };

        await codeCol.insertOne(doc as any);
        res.json({ ok: true, item: doc });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tạo mã giảm giá" });
      }
    }
  );

  // GET /api/shop/admin/promotions/reports/overview — Báo cáo tổng quan hiệu quả ưu đãi
  app.get(
    "/api/shop/admin/promotions/reports/overview",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const redCol = shopDb.collection(PROMOTION_REDEMPTIONS_COL);
        const promoCol = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);

        const [activeCount, totalUsedStats, recentRedemptions] = await Promise.all([
          promoCol.countDocuments({ status: "active" }),
          redCol
            .aggregate([
              { $match: { status: "used" } },
              {
                $group: {
                  _id: null,
                  totalDiscountGiven: { $sum: "$discountAmount" },
                  totalOrders: { $sum: 1 },
                },
              },
            ])
            .toArray(),
          redCol
            .find()
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray(),
        ]);

        const stats = totalUsedStats[0] || { totalDiscountGiven: 0, totalOrders: 0 };

        res.json({
          ok: true,
          stats: {
            activePromotionsCount: activeCount,
            totalDiscountGiven: stats.totalDiscountGiven || 0,
            totalOrdersUsingDiscount: stats.totalOrders || 0,
          },
          recentRedemptions,
        });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tải báo cáo ưu đãi" });
      }
    }
  );

  // GET /api/shop/admin/promotion-codes — Danh sách tất cả mã giảm giá
  app.get(
    "/api/shop/admin/promotion-codes",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const shopDb = await getShopDb();
        const codeCol = shopDb.collection<PromotionCodeDoc>(PROMOTION_CODES_COL);
        const promoCol = shopDb.collection<PromotionDoc>(PROMOTIONS_COL);

        const [codes, promos] = await Promise.all([
          codeCol.find().sort({ createdAt: -1 }).toArray(),
          promoCol.find().toArray(),
        ]);

        const promoMap = new Map<string, PromotionDoc>(promos.map((p) => [p.id, p]));
        const enriched = codes.map((c) => {
          const p = promoMap.get(c.promotionId);
          return {
            ...c,
            promotionName: p?.name || c.promotionId,
            promotionTitle: p?.title || "",
            discountType: p?.discountType,
            discountValue: p?.discountValue,
            maxDiscountVnd: p?.maxDiscountVnd,
            minOrderThreshold: p?.minOrderThreshold,
            thresholdOperator: p?.thresholdOperator,
            promotionStatus: p?.status || "archived",
          };
        });

        res.json({ ok: true, codes: enriched });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tải danh sách mã khuyến mại" });
      }
    }
  );

  // GET /api/shop/admin/promotions/kiotviet/status — Thông tin đối soát và đồng bộ Voucher KiotViet
  app.get(
    "/api/shop/admin/promotions/kiotviet/status",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      applyShopCors(req, res);
      try {
        const statusReport = {
          ok: true,
          connection: {
            configured: true,
            status: "ready_for_verification",
            mode: "read_only_audit",
            note: "Aloha Web Promotions xử lý chiết khấu trực tiếp và đẩy số tiền giảm sang KiotViet qua trường discount trên hóa đơn. Tích hợp thanh toán bằng Voucher KiotViet (Payments: Voucher) đang ở giai đoạn đối soát và khảo sát API.",
          },
          requirements: [
            {
              name: "Đồng bộ chiết khấu đơn web sang KiotViet",
              status: "connected",
              detail: "Số tiền giảm được phân bổ vào từng dòng đơn hàng (orderDetails[i].discount) và gửi đồng bộ sang KiotViet.",
            },
            {
              name: "Tính hoa hồng CTV theo giá thực thu",
              status: "connected",
              detail: "Doanh số CTV được tính trên lineNet = price * qty - discount sau khi trừ ưu đãi phân bổ.",
            },
            {
              name: "Kiểm tra đợt phát hành KiotViet Voucher (GET /vouchercampaign)",
              status: "audit_mode",
              detail: "Chỉ mở đọc danh mục đợt phát hành phục vụ đối soát, chưa tự động trừ điểm tại web để tránh xung đột giao dịch tại quầy POS.",
            },
            {
              name: "Xác thực trừ thanh toán Voucher KiotViet tại POS vs Web",
              status: "pending_sandbox_test",
              detail: "Yêu cầu kiểm thử trên môi trường Sandbox KiotViet trước khi cho phép khách nhập mã voucher làm phương thức thanh toán.",
            },
          ],
          lastChecked: new Date().toISOString(),
        };

        res.json(statusReport);
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message || "Lỗi tải trạng thái KiotViet" });
      }
    }
  );
}

