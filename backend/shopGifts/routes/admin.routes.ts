import type { Express, Response } from 'express';
import type { Db } from 'mongodb';
import path from 'path';
import fs from 'fs';
import {
  requireAuth,
  requireActive,
  requireManager,
  checkSameOrigin,
  type AuthRequest,
  type GetDb as GetOpsDb,
} from '../../auth/middleware.js';
import { applyShopCors } from '../../shopCors.js';
import { listAllGiftsAdmin, createGiftAdmin, updateGiftAdmin, deleteGiftAdmin } from '../giftRepo.js';
import { giftCollectionInputSchema, giftCollectionUpdateSchema } from '../schema.js';
import { registerGiftProductAdminRoutes } from './products.routes.js';

export function registerGiftAdminRoutes(app: Express, getOpsDb: GetOpsDb, getShopDb: () => Promise<Db>) {
  const guards = [requireAuth(getOpsDb), requireActive, requireManager, checkSameOrigin];
  registerGiftProductAdminRoutes(app, guards, getShopDb);

  // GET /api/shop/admin/gifts — Lấy tất cả thẻ quà tặng cho trang quản trị
  app.get('/api/shop/admin/gifts', ...guards, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const db = await getShopDb();
      const items = await listAllGiftsAdmin(db);
      res.json({ ok: true, data: items });
    } catch (err: any) {
      console.error('[shopGifts Admin] GET /api/shop/admin/gifts error:', err);
      res.status(500).json({ ok: false, error: 'Không thể tải danh sách quà tặng' });
    }
  });

  // POST /api/shop/admin/gifts — Tạo thẻ quà tặng mới
  app.post('/api/shop/admin/gifts', ...guards, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const parsed = giftCollectionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Dữ liệu không hợp lệ',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const db = await getShopDb();
      const created = await createGiftAdmin(db, parsed.data);
      res.json({ ok: true, data: created });
    } catch (err: any) {
      console.error('[shopGifts Admin] POST /api/shop/admin/gifts error:', err);
      res.status(500).json({ ok: false, error: 'Không thể tạo quà tặng' });
    }
  });

  // PUT /api/shop/admin/gifts/:id — Cập nhật thông tin / thay ảnh thẻ quà tặng
  app.put('/api/shop/admin/gifts/:id', ...guards, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const id = String(req.params.id || '').trim();
      const parsed = giftCollectionUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'Dữ liệu cập nhật không hợp lệ',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const db = await getShopDb();
      const ok = await updateGiftAdmin(db, id, parsed.data);
      if (!ok) {
        return res.status(404).json({ ok: false, error: 'Không tìm thấy thẻ quà tặng để cập nhật' });
      }

      res.json({ ok: true, message: 'Đã cập nhật thành công' });
    } catch (err: any) {
      console.error('[shopGifts Admin] PUT /api/shop/admin/gifts/:id error:', err);
      res.status(500).json({ ok: false, error: 'Không thể cập nhật quà tặng' });
    }
  });

  // DELETE /api/shop/admin/gifts/:id — Xóa thẻ quà tặng
  app.delete('/api/shop/admin/gifts/:id', ...guards, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const id = String(req.params.id || '').trim();
      const db = await getShopDb();
      const ok = await deleteGiftAdmin(db, id);
      if (!ok) {
        return res.status(404).json({ ok: false, error: 'Không tìm thấy thẻ quà tặng để xóa' });
      }

      res.json({ ok: true, message: 'Đã xóa thẻ quà tặng' });
    } catch (err: any) {
      console.error('[shopGifts Admin] DELETE /api/shop/admin/gifts/:id error:', err);
      res.status(500).json({ ok: false, error: 'Không thể xóa quà tặng' });
    }
  });

  // POST /api/shop/admin/gifts/upload-image — Tải ảnh trực tiếp từ máy tính lên
  app.post('/api/shop/admin/gifts/upload-image', ...guards, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const { filename, base64Data } = req.body || {};
      if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ ok: false, error: 'Thiếu dữ liệu ảnh base64' });
      }

      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ ok: false, error: 'Chuỗi base64 ảnh không hợp lệ' });
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ ok: false, error: 'Dung lượng ảnh tối đa 5MB' });
      }

      let ext = '.jpg';
      if (mimeType === 'image/png') ext = '.png';
      else if (mimeType === 'image/webp') ext = '.webp';
      else if (mimeType === 'image/jpeg') ext = '.jpg';

      const safeBase = (filename || 'gift-upload')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      const cleanFileName = `gift_${Date.now()}_${safeBase}${ext}`;

      const targetDir = path.resolve(process.cwd(), 'uploads', 'gifts');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, cleanFileName);
      fs.writeFileSync(targetPath, buffer);

      const publicUrl = `/uploads/gifts/${cleanFileName}`;
      res.json({ ok: true, url: publicUrl });
    } catch (err: any) {
      console.error('[shopGifts Admin] upload-image error:', err);
      res.status(500).json({ ok: false, error: 'Lỗi khi lưu ảnh tải lên' });
    }
  });

  // GET /api/shop/admin/gifts/library-plants — Lấy danh sách cây thật có sẵn của Aloha để chọn ảnh
  app.get('/api/shop/admin/gifts/library-plants', ...guards, async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const db = await getShopDb();
      const col = db.collection('aloha_products');
      const plants = await col
        .find({
          isActive: { $ne: false },
          anh: { $exists: true, $ne: '' },
        })
        .project({ ma: 1, ten: 1, fullName: 1, gia: 1, anh: 1 })
        .limit(60)
        .toArray();

      res.json({ ok: true, data: plants });
    } catch (err: any) {
      console.error('[shopGifts Admin] library-plants error:', err);
      res.status(500).json({ ok: false, error: 'Không thể lấy thư viện cây thật' });
    }
  });
}
