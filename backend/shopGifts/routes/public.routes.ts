import type { Express, Request, Response } from 'express';
import type { Db } from 'mongodb';
import { listActiveGifts, getGiftBySlug } from '../giftRepo.js';
import { loadGiftProducts } from '../products.js';

export function registerGiftPublicRoutes(app: Express, getShopDb: () => Promise<Db>) {
  // GET /api/shop/gifts — Danh sách thẻ quà tặng đang bật (hiển thị trang chủ)
  app.get('/api/shop/gifts', async (_req: Request, res: Response) => {
    try {
      const db = await getShopDb();
      const items = await listActiveGifts(db);
      res.json({ ok: true, data: items });
    } catch (err: any) {
      console.error('[shopGifts] GET /api/shop/gifts error:', err);
      res.status(500).json({ ok: false, error: 'Không thể tải danh sách quà tặng' });
    }
  });

  // GET /api/shop/gifts/:slug — Chi tiết một nhóm quà tặng + Sản phẩm KiotViet tương ứng
  app.get('/api/shop/gifts/:slug', async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || '').trim();
      const db = await getShopDb();
      const gift = await getGiftBySlug(db, slug);
      if (!gift) {
        return res.status(404).json({ ok: false, error: 'Không tìm thấy nhóm quà tặng' });
      }

      // Tải thông tin các sản phẩm KiotViet được liên kết (nếu có mã)
      const products = await loadGiftProducts(db, gift.linkedProductCodes || []);

      res.json({ ok: true, data: { ...gift, products } });
    } catch (err: any) {
      console.error('[shopGifts] GET /api/shop/gifts/:slug error:', err);
      res.status(500).json({ ok: false, error: 'Không thể tải chi tiết quà tặng' });
    }
  });
}
