import type { Express, Response } from "express";
import type { Db } from "mongodb";
import bcrypt from "bcryptjs";
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
  normalizeEmail,
  shopAccountIdQuery,
  toPublicShopAccount,
  type CtvStatus,
} from "./models.js";
import type { GetShopDb } from "./routes.js";
import { syncBus } from "../syncBus.js";
import { directoryFilter } from "./directoryFilters.js";

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
      const [total, customers, ctvTotal, ctvActive, ctvPending, locked, ctvLocked, customerLocked] =
        await Promise.all([
          col.countDocuments({}),
          col.countDocuments({ roles: "customer" }),
          col.countDocuments({ roles: "ctv" }),
          col.countDocuments({ roles: "ctv", ctvStatus: "active" }),
          col.countDocuments({ roles: "ctv", ctvStatus: "cho_duyet" }),
          col.countDocuments({ active: false }),
          col.countDocuments({ roles: "ctv", active: false }),
          col.countDocuments({ roles: "customer", active: false }),
        ]);
      return res.json({
        ok: true,
        total,
        customers,
        ctvTotal,
        ctvActive,
        ctvPending,
        locked,
        ctvLocked,
        customerLocked,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi thống kê" });
    }
  });

  app.get("/api/shop/admin/accounts/segments", ...gate, async (_req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      const col = db.collection(SHOP_ACCOUNTS);
      const definitions = {
        total: {}, retail: { customerType: "retail" }, HCM: { customerType: "HCM" },
        TINH: { customerType: "TINH" }, unassigned: { customerType: "unassigned" },
        affiliates: { affiliate: "member" }, pending: { pending: "1" },
      };
      const entries = await Promise.all(Object.entries(definitions).map(async ([key, query]) =>
        [key, await col.countDocuments(directoryFilter(query))] as const));
      return res.json(Object.fromEntries(entries));
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Không tải được thống kê" });
    }
  });

  app.get("/api/shop/admin/accounts", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureIdx(db);
      const tab = String(req.query.tab || "all");
      const scope = String(req.query.scope || "").trim(); // "ctv" | "customer" | ""
      const time = String(req.query.time || "all").trim(); // this_month | last_month | last_7d | last_30d | all
      const fromQ = String(req.query.from || "").trim();
      const toQ = String(req.query.to || "").trim();
      const q = String(req.query.q || "").trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
      const filter: Record<string, unknown> = {};

      if (tab === "customer") filter.roles = "customer";
      else if (tab === "ctv") filter.roles = "ctv";
      else if (tab === "active") {
        filter.roles = "ctv";
        filter.ctvStatus = "active";
        filter.active = true;
      } else if (tab === "pending") {
        filter.roles = "ctv";
        filter.ctvStatus = "cho_duyet";
      } else if (tab === "locked") {
        filter.active = false;
        if (scope === "ctv") filter.roles = "ctv";
        else if (scope === "customer") filter.roles = "customer";
      } else if (tab === "all") {
        if (scope === "ctv") filter.roles = "ctv";
        else if (scope === "customer") filter.roles = "customer";
      }

      if (scope === "ctv" && tab !== "customer" && !filter.roles) filter.roles = "ctv";
      if (scope === "customer" && tab !== "ctv" && tab !== "pending" && tab !== "active" && !filter.roles) {
        filter.roles = "customer";
      }

      if (scope === "directory") {
        // Ignore legacy tabs: all roles share one paginated directory.
        for (const key of Object.keys(filter)) delete filter[key];
        try { Object.assign(filter, directoryFilter(req.query)); }
        catch (error) { return res.status(400).json({ error: (error as Error).message }); }
      }

      const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
      let from: Date | null = null;
      let to: Date | null = null;
      if (ymdRe.test(fromQ) && ymdRe.test(toQ)) {
        const [fy, fm, fd] = fromQ.split("-").map(Number);
        const [ty, tm, td] = toQ.split("-").map(Number);
        from = new Date(fy, fm - 1, fd);
        to = new Date(ty, tm - 1, td + 1); // exclusive end
      } else if (time && time !== "all") {
        const now = new Date();
        if (time === "this_month") {
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        } else if (time === "last_month") {
          from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          to = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (time === "last_7d") {
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        } else if (time === "last_30d") {
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        }
      }
      if (from && to) {
        const fromIso = from.toISOString();
        const toIso = to.toISOString();
        filter.$and = [
          ...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []),
          {
            $or: [
              { createdAt: { $gte: from, $lt: to } },
              { createdAt: { $gte: fromIso, $lt: toIso } },
            ],
          },
        ];
      }

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
        ...(scope === "directory" ? { directoryVersion: 1 } : {}),
        total,
        page,
        limit,
        items: rows.map((r) => toPublicShopAccount(r)),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi danh sách" });
    }
  });

  /** Admin tạo CTV mới (đã active). username → ctvCode; email tùy chọn. */
  app.post("/api/shop/admin/accounts", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      await ensureIdx(db);

      const fullName = String(req.body?.fullName || "").trim();
      const phone = String(req.body?.phone || "").trim();
      const password = String(req.body?.password || "");
      const username = normalizeCtvCode(req.body?.username || req.body?.ctvCode || "");
      let email = normalizeEmail(req.body?.email || "");
      const address = String(req.body?.address || "").trim();
      const gender = String(req.body?.gender || "").trim();
      const birthday = String(req.body?.birthday || "").trim();
      const referralChannel = String(req.body?.referralChannel || "").trim();
      const sendInvite = Boolean(req.body?.sendInvite);

      if (!fullName) return res.status(400).json({ error: "Nhập họ và tên" });
      if (!phone) return res.status(400).json({ error: "Nhập số điện thoại" });
      if (!isValidCtvCode(username)) {
        return res.status(400).json({ error: "Tên đăng nhập 3–20 ký tự (A-Z, 0-9, _, -)" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Mật khẩu tạm thời tối thiểu 8 ký tự" });
      }
      if (email && !email.includes("@")) {
        return res.status(400).json({ error: "Email không hợp lệ" });
      }
      if (!email) {
        email = `${username.toLowerCase()}@ctv.local`;
      }

      const takenCode = await db.collection(SHOP_ACCOUNTS).findOne({ ctvCode: username });
      if (takenCode) return res.status(409).json({ error: "Tên đăng nhập / mã CTV đã được dùng" });

      const takenEmail = await db.collection(SHOP_ACCOUNTS).findOne({ email });
      if (takenEmail) return res.status(409).json({ error: "Email đã được dùng" });

      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();
      const doc: Record<string, unknown> = {
        email,
        phone,
        fullName,
        passwordHash,
        avatarUrl: null,
        roles: ["ctv"],
        ctvCode: username,
        ctvStatus: "active",
        commissionRate: null,
        adminNote: null,
        active: true,
        failedLoginCount: 0,
        lockUntil: null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        createdByAdmin: true,
        mustChangePassword: true,
        sendInviteAtCreate: sendInvite,
      };
      if (address) doc.addressText = address;
      if (gender === "male" || gender === "female" || gender === "other") doc.gender = gender;
      if (/^\d{4}-\d{2}-\d{2}$/.test(birthday)) doc.birthday = birthday;
      if (referralChannel) doc.referralChannel = referralChannel;

      const ins = await db.collection(SHOP_ACCOUNTS).insertOne(doc);
      const user = { ...doc, _id: ins.insertedId };
      try {
        syncBus.publish(["aloha_shop_accounts"], "ctv_admin_create", {
          ids: [String(ins.insertedId)],
        });
      } catch {
        /* ignore */
      }
      return res.status(201).json({
        ok: true,
        user: toPublicShopAccount(user),
        loginHint: email.endsWith("@ctv.local")
          ? `Đăng nhập bằng email hệ thống: ${email}`
          : `Đăng nhập bằng email: ${email}`,
        inviteQueued: sendInvite,
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({ error: "Email hoặc mã CTV đã tồn tại" });
      }
      return res.status(500).json({ error: e?.message || "Lỗi tạo CTV" });
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
        if (st === "cho_duyet" || st === "active" || st === "khoa" || st === "tu_choi") {
          patch.ctvStatus = st;
        }
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
        if (user.ctvStatus !== "cho_duyet") {
          return res.status(400).json({ error: "Hồ sơ không còn chờ duyệt" });
        }

        const patch: Record<string, unknown> = {
          ctvStatus: "active",
          ctvRejectReason: null,
          updatedAt: new Date(),
        };

        // Gán ctvCode nếu chưa có — bắt buộc để attribution/HH chạy
        let code = normalizeCtvCode(String(user.ctvCode || ""));
        if (!code) {
          const preferred = normalizeCtvCode(
            String(req.body?.ctvCode || user.username || "").trim()
          );
          const fromEmail = normalizeCtvCode(
            String(user.email || "")
              .split("@")[0] || ""
          );
          let candidate =
            preferred && isValidCtvCode(preferred)
              ? preferred
              : fromEmail && isValidCtvCode(fromEmail)
                ? fromEmail
                : "";
          if (!candidate) {
            candidate = normalizeCtvCode(`CTV${String(user._id).slice(-6)}`);
          }
          // Tránh trùng mã
          let n = 0;
          let tryCode = candidate;
          while (n < 20) {
            const taken = await db.collection(SHOP_ACCOUNTS).findOne({
              ctvCode: tryCode,
              _id: { $ne: user._id },
            });
            if (!taken) break;
            n += 1;
            tryCode = normalizeCtvCode(`${candidate}${n}`);
          }
          if (!isValidCtvCode(tryCode)) {
            return res.status(400).json({ error: "Không tạo được mã CTV hợp lệ" });
          }
          code = tryCode;
          patch.ctvCode = code;
        }

        await db.collection(SHOP_ACCOUNTS).updateOne(q, { $set: patch });
        const updated = await db.collection(SHOP_ACCOUNTS).findOne(q);
        try {
          syncBus.publish(["aloha_shop_accounts"], "ctv_approve", {
            ids: [String(user._id)],
          });
        } catch {
          /* ignore */
        }
        return res.json({ ok: true, user: toPublicShopAccount(updated!) });
      } catch (e: any) {
        if (e?.code === 11000) return res.status(409).json({ error: "Trùng mã CTV" });
        return res.status(500).json({ error: e?.message || "Lỗi duyệt" });
      }
    }
  );

  app.post(
    "/api/shop/admin/accounts/:id/reject-ctv",
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
        if (user.ctvStatus !== "cho_duyet") {
          return res.status(400).json({ error: "Hồ sơ không còn chờ duyệt" });
        }
        const reason = String(req.body?.reason || "").trim();
        if (!reason) {
          return res.status(400).json({ error: "Nhập lý do từ chối" });
        }
        await db.collection(SHOP_ACCOUNTS).updateOne(q, {
          $set: {
            ctvStatus: "tu_choi",
            ctvRejectReason: reason.slice(0, 500),
            updatedAt: new Date(),
          },
        });
        const updated = await db.collection(SHOP_ACCOUNTS).findOne(q);
        try {
          syncBus.publish(["aloha_shop_accounts"], "ctv_reject", {
            ids: [String(user._id)],
          });
        } catch {
          /* ignore */
        }
        return res.json({ ok: true, user: toPublicShopAccount(updated!) });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi từ chối" });
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
