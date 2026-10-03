import type { Express, Response } from "express";
import type { AuthRequest } from "../../auth/middleware.js";
import type { GetShopDb } from "../../shopAuth/routes.js";
import { applyShopCors } from "../../shopCors.js";
import {
  PROMOTIONS_COL,
  PROMOTION_CODES_COL,
  PROMOTION_REDEMPTIONS_COL,
  type PromotionDoc,
  type PromotionCodeDoc,
} from "../types.js";
import type { AdminGate } from "./previewRoute.js";

function registerCodeRoutes(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  // GET /api/shop/admin/promotions/:id/codes — Lấy danh sách mã giảm giá của chương trình
  app.get("/api/shop/admin/promotions/:id/codes", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const promotionId = String(req.params.id || "").trim();
      const codes = await shopDb
        .collection<PromotionCodeDoc>(PROMOTION_CODES_COL)
        .find({ promotionId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ ok: true, codes });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải mã giảm giá" });
    }
  });

  // POST /api/shop/admin/promotions/:id/codes — Tạo mã giảm giá mới
  app.post("/api/shop/admin/promotions/:id/codes", ...gate, async (req: AuthRequest, res: Response) => {
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
      if (await codeCol.findOne({ code })) {
        return res.status(409).json({ ok: false, error: "Mã giảm giá này đã tồn tại" });
      }
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
        createdAt: new Date().toISOString(),
      };
      await codeCol.insertOne(doc as any);
      res.json({ ok: true, item: doc });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tạo mã giảm giá" });
    }
  });

  // GET /api/shop/admin/promotion-codes — Danh sách tất cả mã giảm giá
  app.get("/api/shop/admin/promotion-codes", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const shopDb = await getShopDb();
      const [codes, promos] = await Promise.all([
        shopDb.collection<PromotionCodeDoc>(PROMOTION_CODES_COL).find().sort({ createdAt: -1 }).toArray(),
        shopDb.collection<PromotionDoc>(PROMOTIONS_COL).find().toArray(),
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
  });
}

function registerReportRoute(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  // GET /api/shop/admin/promotions/reports/overview — Báo cáo tổng quan hiệu quả ưu đãi
  app.get("/api/shop/admin/promotions/reports/overview", ...gate, async (req: AuthRequest, res: Response) => {
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
        redCol.find().sort({ createdAt: -1 }).limit(20).toArray(),
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
  });
}

const KIOTVIET_REQUIREMENTS = [
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
];

function registerKiotVietStatusRoute(app: Express, gate: AdminGate) {
  // GET /api/shop/admin/promotions/kiotviet/status — Thông tin đối soát và đồng bộ Voucher KiotViet
  app.get("/api/shop/admin/promotions/kiotviet/status", ...gate, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      res.json({
        ok: true,
        connection: {
          configured: true,
          status: "ready_for_verification",
          mode: "read_only_audit",
          note: "Aloha Web Promotions xử lý chiết khấu trực tiếp và đẩy số tiền giảm sang KiotViet qua trường discount trên hóa đơn. Tích hợp thanh toán bằng Voucher KiotViet (Payments: Voucher) đang ở giai đoạn đối soát và khảo sát API.",
        },
        requirements: KIOTVIET_REQUIREMENTS,
        lastChecked: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải trạng thái KiotViet" });
    }
  });
}

export function registerPromotionCodeReportRoutes(app: Express, gate: AdminGate, getShopDb: GetShopDb) {
  registerCodeRoutes(app, gate, getShopDb);
  registerReportRoute(app, gate, getShopDb);
  registerKiotVietStatusRoute(app, gate);
}
