import { randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";
import { requireAuth, requireActive, requireManager } from "../auth/middleware.js";
import { requireShopAuth } from "../shopAuth/routes.js";

/** Serialize existing order mutations against the outbox without changing retail. */
export function registerWholesaleSyncGuard(app: Express, getDb: () => Promise<Db>, getOps: () => Promise<Db>) {
  const guard: RequestHandler = async (req, res, next) => {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
    const match = req.path.match(/^\/api\/shop\/(?:admin\/(?:orders|backorders)|orders\/me)\/([^/]+)\//);
    if (!match) return next();
    let db: Db;
    try {
      db = await getDb();
      const col = db.collection(SHOP_ORDERS);
      const order = await col.findOne({ ...shopOrderLookupFilter(decodeURIComponent(match[1])), priceMode: "si",
        ...(req.path.includes("/orders/me/") ? { shopAccountId: (req as any).shopAuth.userId } : {}) });
      if (!order) return next();
      if (req.path.endsWith("/retry-kv-push")) {
        res.status(409).json({ error: "Đơn sỉ phải xử lý tại mục Đồng bộ đơn sỉ KiotViet để kiểm tra chống trùng." }); return;
      }
      const now = new Date(), owner = randomUUID();
      const r = await col.updateOne({ _id: order._id, kvPushStatus: { $nin: ["sending", "unknown"] },
        $and: [{ $or: [{ kvSyncLeaseUntil: { $exists: false } }, { kvSyncLeaseUntil: { $lte: now } }] },
          { $or: [{ kvEditLeaseUntil: { $exists: false } }, { kvEditLeaseUntil: { $lte: now } }] }] },
        { $set: { kvEditOwner: owner, kvEditLeaseUntil: new Date(Date.now() + 10 * 60000) } });
      if (!r.modifiedCount) { res.status(409).json({ error: "Đơn đang đồng bộ hoặc chờ đối soát KiotViet. Vui lòng kiểm tra trước khi thay đổi." }); return; }
      const timer = setInterval(() => { void col.updateOne({ _id: order._id, kvEditOwner: owner },
        { $set: { kvEditLeaseUntil: new Date(Date.now() + 10 * 60000) } }).catch(() => {}); }, 30000);
      timer.unref();
      res.once("finish", () => { clearInterval(timer); void col.updateOne({ _id: order._id, kvEditOwner: owner },
        { $unset: { kvEditOwner: "", kvEditLeaseUntil: "" } }).catch(() => {}); });
      res.once("close", () => clearInterval(timer));
      next();
    } catch { res.status(503).json({ error: "Chưa khóa được đơn để cập nhật. Vui lòng thử lại." }); }
  };
  app.use((req, res, next) => {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method) || !/^\/api\/shop\/(?:admin\/(?:orders|backorders)|orders\/me)\/[^/]+\//.test(req.path)) return next();
    if (req.path.includes("/admin/")) return requireAuth(getOps)(req, res, () => requireActive(req as any, res, () => requireManager(req as any, res, () => guard(req, res, next))));
    return requireShopAuth(getDb)(req, res, () => guard(req, res, next));
  });
}
