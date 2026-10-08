import type { Express } from 'express';
import { ObjectId, type Db } from 'mongodb';
import { createHash } from 'node:crypto';
import { requireAuth, requireActive, requireManager, checkSameOrigin, type GetDb } from '../auth/middleware.js';
import { clientIpFromReq, rateLimitAllow } from '../shopRateLimit.js';
import { inquiryInputSchema, inquiryListSchema, inquiryUpdateSchema } from './schema.js';

export const INQUIRIES_COL = 'aloha_shop_quote_requests';
const indexed = new WeakMap<Db, Promise<unknown>>();
const fields = { requestId: 0, payloadHash: 0 };

export async function ensureInquiryIndexes(db: Db) {
  let pending = indexed.get(db);
  if (!pending) {
    const col = db.collection(INQUIRIES_COL);
    pending = Promise.all([
      col.createIndex({ requestId: 1 }, { unique: true }),
      col.createIndex({ createdAt: -1, _id: -1 }),
      col.createIndex({ status: 1, createdAt: -1 }),
      col.createIndex({ source: 1, status: 1, createdAt: -1 }),
    ]).catch((e) => { indexed.delete(db); throw e; });
    indexed.set(db, pending);
  }
  await pending;
}

export function registerShopInquiryRoutes(app: Express, getOpsDb: GetDb, getShopDb: () => Promise<Db>) {
  const guards = [requireAuth(getOpsDb), requireActive, requireManager, checkSameOrigin];
  app.post('/api/shop/quote-requests', checkSameOrigin, async (req, res) => {
    const parsed = inquiryInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Thông tin không hợp lệ' });
    if (!(await rateLimitAllow(`quote-request:${clientIpFromReq(req)}`, 10, 15 * 60_000))) {
      return res.status(429).json({ error: 'Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' });
    }
    try {
      const db = await getShopDb();
      await ensureInquiryIndexes(db);
      const col = db.collection(INQUIRIES_COL);
      const { requestId, ...input } = parsed.data;
      const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const now = new Date();
      let doc;
      try {
        doc = await col.findOneAndUpdate({ requestId }, { $setOnInsert: {
          ...input, requestId, payloadHash, status: 'new', adminNotes: '', version: 0, createdAt: now, updatedAt: now,
        } }, { upsert: true, returnDocument: 'after' });
      } catch (e: any) {
        if (e?.code !== 11000) throw e;
        doc = await col.findOne({ requestId });
      }
      if (!doc) throw new Error('Request was not persisted');
      if (doc.payloadHash !== payloadHash) return res.status(409).json({ error: 'Yêu cầu đã thay đổi. Vui lòng gửi lại.' });
      res.status(201).json({ ok: true, id: String(doc._id) });
    } catch {
      res.status(500).json({ error: 'Chưa lưu được yêu cầu. Vui lòng thử lại hoặc gọi hotline Aloha.' });
    }
  });

  app.get('/api/shop/admin/quote-requests/counts', ...guards, async (_req, res) => {
    try {
      const col = (await getShopDb()).collection(INQUIRIES_COL);
      res.json({ newCount: await col.countDocuments({ status: 'new' }) });
    } catch { res.status(500).json({ error: 'Không thể tải số yêu cầu mới' }); }
  });
  app.get('/api/shop/admin/quote-requests', ...guards, async (req, res) => {
    const parsed = inquiryListSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Bộ lọc không hợp lệ' });
    try {
      const { q, status, source, page } = parsed.data;
      const filter: Record<string, unknown> = {};
      if (status !== 'all') filter.status = status;
      if (source !== 'all') filter.source = source;
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = ['companyName', 'contactName', 'phone', 'email'].map((key) => ({ [key]: rx }));
      }
      const col = (await getShopDb()).collection(INQUIRIES_COL);
      const limit = 20;
      const [items, total, newCount] = await Promise.all([
        col.find(filter, { projection: fields }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        col.countDocuments(filter), col.countDocuments({ status: 'new' }),
      ]);
      res.json({ items, total, newCount, page, limit });
    } catch { res.status(500).json({ error: 'Không thể tải yêu cầu báo giá' }); }
  });
  app.patch('/api/shop/admin/quote-requests/:id', ...guards, async (req, res) => {
    const id = String(req.params.id);
    const parsed = inquiryUpdateSchema.safeParse(req.body);
    if (!/^[a-f\d]{24}$/i.test(id) || !parsed.success) return res.status(400).json({ error: 'Thông tin cập nhật không hợp lệ' });
    try {
      const { version, ...patch } = parsed.data;
      const col = (await getShopDb()).collection(INQUIRIES_COL);
      const doc = await col.findOneAndUpdate({ _id: new ObjectId(id), version }, {
        $set: { ...patch, updatedAt: new Date() }, $inc: { version: 1 },
      }, { returnDocument: 'after', projection: fields });
      if (!doc) return res.status(409).json({ error: 'Yêu cầu đã được cập nhật ở nơi khác. Hãy làm mới danh sách.' });
      res.json({ ok: true, item: doc });
    } catch { res.status(500).json({ error: 'Không thể lưu cập nhật' }); }
  });
}
