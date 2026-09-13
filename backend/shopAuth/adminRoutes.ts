import type { Express, Response } from "express";
import type { Db } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import {
  SHOP_ACCOUNTS,
  ensureShopAuthIndexes,
  isValidCtvCode,
  normalizeCtvCode,
  shopAccountIdQuery,
  toPublicShopAccount,
  type CtvStatus,
} from "./models.js";
import type { GetShopDb } from "./routes.js";
import { syncBus } from "../syncBus.js";

async function ensureIdx(db: Db) {
  await ensureShopAuthIndexes(db);
}

export function registerShopAccountsAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];

  app.get("/api/shop/admin/accounts/stats", ...gate, async (_req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureIdx(db);
      const col = db.collection(SHOP_ACCOUNTS);
      const [total, customers, ctvActive, ctvPending, locked] = await Promise.all([
        col.countDocuments({}),
        col.countDocuments({ roles: "customer" }),
        col.countDocuments({ roles: "ctv", ctvStatus: "active" }),
        col.countDocuments({ roles: "ctv", ctvStatus: "cho_duyet" }),
        col.countDocuments({ active: false }),
      ]);
      return res.json({ ok: true, total, customers, ctvActive, ctvPending, locked });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi thống kê" });
    }
  });

  app.get("/api/shop/admin/accounts", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureIdx(db);
      const tab = String(req.query.tab || "all");
      const q = String(req.query.q || "").trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
      const filter: Record<string, unknown> = {};

      if (tab === "customer") filter.roles = "customer";
      else if (tab === "ctv") filter.roles = "ctv";
      else if (tab === "pending") {
        filter.roles = "ctv";
        filter.ctvStatus = "cho_duyet";
      } else if (tab === "locked") filter.active = false;

      if (q) {
        const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }, { ctvCode: rx }];
      }

      const col = db.collection(SHOP_ACCOUNTS);
      const total = await col.countDocuments(filter);
      const rows = await col
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      return res.json({
        ok: true,
        total,
        page,
        limit,
        items: rows.map((r) => toPublicShopAccount(r)),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi danh sách" });
    }
  });

  app.get("/api/shop/admin/accounts/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.params.id));
      if (!user) return res.status(404).json({ error: "Không tìm thấy" });
      return res.json({ ok: true, user: toPublicShopAccount(user) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi" });
    }
  });

  app.patch("/api/shop/admin/accounts/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.params.id));
      if (!user) return res.status(404).json({ error: "Không tìm thấy" });

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body?.active === "boolean") patch.active = req.body.active;
      if (req.body?.adminNote !== undefined) patch.adminNote = String(req.body.adminNote || "");
      if (req.body?.ctvStatus) {
        const st = String(req.body.ctvStatus) as CtvStatus;
        if (st === "cho_duyet" || st === "active" || st === "khoa") patch.ctvStatus = st;
      }
      if (req.body?.ctvCode !== undefined) {
        const code = normalizeCtvCode(req.body.ctvCode);
        if (code && !isValidCtvCode(code)) {
          return res.status(400).json({ error: "Mã CTV không hợp lệ" });
        }
        if (code) {
          const taken = await db.collection(SHOP_ACCOUNTS).findOne({
            ctvCode: code,
            _id: { $ne: user._id },
          });
          if (taken) return res.status(409).json({ error: "Mã CTV đã dùng" });
          patch.ctvCode = code;
        }
      }
      if (req.body?.commissionRate !== undefined) {
        const n = Number(req.body.commissionRate);
        patch.commissionRate = Number.isFinite(n) ? n : null;
      }

      await db.collection(SHOP_ACCOUNTS).updateOne({ _id: user._id }, { $set: patch });
      const updated = await db.collection(SHOP_ACCOUNTS).findOne({ _id: user._id });
      try {
        const { syncBus } = await import("../syncBus.js");
        syncBus.publish(["aloha_shop_accounts"], "shop_account_patch", {
          ids: [String(user._id)],
        });
      } catch {
        /* ignore */
      }
      return res.json({ ok: true, user: toPublicShopAccount(updated!) });
    } catch (e: any) {
      if (e?.code === 11000) return res.status(409).json({ error: "Trùng mã CTV" });
      return res.status(500).json({ error: e?.message || "Lỗi cập nhật" });
    }
  });

  app.post(
    "/api/shop/admin/accounts/:id/approve-ctv",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await getShopDb();
        const q = shopAccountIdQuery(req.params.id);
        const user = await db.collection(SHOP_ACCOUNTS).findOne(q);
        if (!user) return res.status(404).json({ error: "Không tìm thấy" });
        const roles = Array.isArray(user.roles) ? user.roles.map(String) : [];
        if (!roles.includes("ctv")) {
          return res.status(400).json({ error: "Tài khoản chưa đăng ký CTV" });
        }
        await db.collection(SHOP_ACCOUNTS).updateOne(q, {
          $set: { ctvStatus: "active", updatedAt: new Date() },
        });
        const updated = await db.collection(SHOP_ACCOUNTS).findOne(q);
        try {
          const { syncBus } = await import("../syncBus.js");
          syncBus.publish(["aloha_shop_accounts"], "ctv_approve", {
            ids: [String(user._id)],
          });
        } catch {
          /* ignore */
        }
        return res.json({ ok: true, user: toPublicShopAccount(updated!) });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi duyệt" });
      }
    }
  );

  /** Xóa hẳn tài khoản khách / CTV (không khôi phục). */
  app.delete(
    "/api/shop/admin/accounts/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await getShopDb();
        const q = shopAccountIdQuery(req.params.id);
        const user = await db.collection(SHOP_ACCOUNTS).findOne(q);
        if (!user) return res.status(404).json({ error: "Không tìm thấy" });
        const r = await db.collection(SHOP_ACCOUNTS).deleteOne(q);
        if (!r.deletedCount) return res.status(404).json({ error: "Không xóa được" });
        try {
          const { syncBus } = await import("../syncBus.js");
          syncBus.publish(["aloha_shop_accounts"], "shop_account_delete", {
            ids: [String(user._id)],
          });
        } catch {
          /* ignore */
        }
        return res.json({
          ok: true,
          deletedId: String(user._id),
          email: String(user.email || ""),
          ctvCode: user.ctvCode ? String(user.ctvCode) : null,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi xóa" });
      }
    }
  );
}
