import type { Express, RequestHandler } from 'express';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { giftProductFilter } from '../products.js';
import { publicImages, toPublicProduct } from '../../shopCatalog/catalog/publicProduct.js';
import { viLooseRegex } from '../../shopCatalog/catalog/text.js';

const querySchema = z.object({
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  codes: z.string().max(10100).default('').transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.string().trim().min(1).max(100)).max(100)),
});

export function registerGiftProductAdminRoutes(
  app: Express, guards: RequestHandler[], getShopDb: () => Promise<Db>,
) {
  app.get('/api/shop/admin/gifts/products', ...guards, async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Tìm kiếm không hợp lệ' });
    try {
      const { q, page, codes } = parsed.data;
      const col = (await getShopDb()).collection('aloha_products');
      const filter = giftProductFilter();
      if (q) {
        const rx = viLooseRegex(q);
        filter.$or = [{ ma: rx }, { ten: rx }, { fullName: rx }];
      }
      const limit = 12;
      const [docs, total, selectedDocs, visibleDocs] = await Promise.all([
        col.find(filter).sort({ ten: 1, ma: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
        col.countDocuments(filter),
        codes.length ? col.find({ ma: { $in: codes } }).toArray() : [],
        codes.length ? col.find(giftProductFilter(codes)).project({ ma: 1 }).toArray() : [],
      ]);
      const visible = new Set(visibleDocs.map((d) => String(d.ma)));
      const summary = (doc: Record<string, any>) => {
        const p = toPublicProduct(doc);
        return { ma: p.ma, ten: p.ten, anh: p.anh, images: publicImages(doc), gia: p.gia, visible: visible.has(String(doc.ma)) };
      };
      res.json({ ok: true, items: docs.map(summary), selected: selectedDocs.map(summary), total, page, limit });
    } catch {
      res.status(500).json({ ok: false, error: 'Không thể tải danh sách sản phẩm' });
    }
  });
}
