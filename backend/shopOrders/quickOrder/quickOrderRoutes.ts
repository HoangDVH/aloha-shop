import type { Express, Response } from "express";
import type { AuthRequest, GetDb } from "../../auth/middleware.js";
import type { GetShopDb } from "../routes.js";
import { parseQuickOrder } from "./quickOrderParser.js";
import { searchQuickOrderProducts, createQuickOrder } from "./quickOrderService.js";

export function registerQuickOrderRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb,
  gate: any[]
) {
  // 1. Phân tích bóc tách tin nhắn hoặc hình ảnh
  app.post(
    "/api/shop/admin/quick-order/parse",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const { text, imageBase64, imageMime } = req.body || {};
        if (!text && !imageBase64) {
          return res.status(400).json({ error: "Vui lòng nhập đoạn tin nhắn hoặc dán hình ảnh" });
        }
        const result = await parseQuickOrder(shopDb, { text, imageBase64, imageMime });
        return res.json({ ok: true, data: result });
      } catch (err: any) {
        console.error("[QuickOrder] Parse error:", err);
        return res.status(500).json({ error: err?.message || "Lỗi phân tích đơn hàng" });
      }
    }
  );

  // 2. Tìm kiếm gợi ý sản phẩm
  app.get(
    "/api/shop/admin/quick-order/search-products",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const q = String(req.query.q || "").trim();
        const items = await searchQuickOrderProducts(shopDb, q, 20);
        return res.json({ ok: true, data: items });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || "Lỗi tìm kiếm sản phẩm" });
      }
    }
  );

  // 3. Tạo đơn hàng nhanh & Đẩy sang KiotViet
  app.post(
    "/api/shop/admin/quick-order/create",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const [shopDb, mainDb] = await Promise.all([getShopDb(), getDb()]);
        const creatorUser = (req as any).auth?.user || (req as any).auth?.userId || "admin";
        const result = await createQuickOrder(shopDb, mainDb, req.body, creatorUser);
        return res.json(result);
      } catch (err: any) {
        console.error("[QuickOrder] Create error:", err);
        return res.status(400).json({ error: err?.message || "Lỗi tạo đơn hàng" });
      }
    }
  );
}
