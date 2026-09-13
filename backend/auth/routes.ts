import type { Express, Response } from "express";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  loginBodySchema,
  registerBodySchema,
  unlockBodySchema,
  linkZaloBodySchema,
  type PublicUser,
} from "./schemas.js";
import {
  ACCESS_TTL_SEC,
  REFRESH_COOKIE,
  ACCESS_COOKIE,
  clearAuthCookies,
  hashToken,
  newRefreshJti,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens.js";
import {
  requireAuth,
  requireActive,
  requireManager,
  checkSameOrigin,
  userIdQuery,
  type AuthRequest,
  type GetDb,
} from "./middleware.js";
import { syncBus } from "../syncBus.js";

const USERS = "aloha_users";
const REFRESH = "aloha_refresh_tokens";
const LOGIN_IP = "aloha_login_ip";
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 60 * 1000;
const IP_MAX = 30;

function toPublicUser(doc: any): PublicUser {
  const active = doc.active !== false;
  let approvalStatus: "pending" | "approved" | "rejected" | undefined;
  if (doc.approvalStatus === "pending" || doc.approvalStatus === "approved" || doc.approvalStatus === "rejected") {
    approvalStatus = doc.approvalStatus;
  } else if (!active) {
    approvalStatus = "pending";
  } else {
    approvalStatus = "approved";
  }
  return {
    id: String(doc._id),
    username: String(doc.username || ""),
    fullName: String(doc.fullName || doc.username || ""),
    role: doc.role === "manager" ? "manager" : "staff",
    permissions: Array.isArray(doc.permissions) ? doc.permissions.map(String) : [],
    active,
    approvalStatus,
    zaloId: doc.zaloId ? String(doc.zaloId) : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

async function issueSession(res: Response, db: Db, user: any) {
  const payload = {
    sub: String(user._id),
    username: String(user.username),
    role: (user.role === "manager" ? "manager" : "staff") as "manager" | "staff",
  };
  const jti = newRefreshJti();
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ ...payload, jti });
  await db.collection(REFRESH).insertOne({
    jti,
    userId: String(user._id),
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
  });
  setAuthCookies(res, accessToken, refreshToken);
  return {
    ok: true,
    user: toPublicUser(user),
    expires_in: ACCESS_TTL_SEC,
  };
}

function clientIp(req: AuthRequest): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function rateLimitIp(db: Db, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - IP_WINDOW_MS);
  const n = await db.collection(LOGIN_IP).countDocuments({ ip, at: { $gte: since } });
  await db.collection(LOGIN_IP).insertOne({ ip, at: new Date() });
  return n < IP_MAX;
}

export function registerAuthRoutes(app: Express, getDb: GetDb) {
  app.use("/api/auth", checkSameOrigin);

  app.post("/api/auth/login", async (req: AuthRequest, res) => {
    try {
      const parsed = loginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ",
        });
      }
      const db = await getDb();
      const ip = clientIp(req);
      if (!(await rateLimitIp(db, ip))) {
        return res.status(429).json({ error: "Thử quá nhiều lần. Đợi khoảng 1 phút rồi thử lại." });
      }

      const username = parsed.data.username.trim().toLowerCase();
      const user = await db.collection(USERS).findOne({ username });

      // Lỗi chung — không lộ user có/không
      const failMsg = "Tài khoản hoặc mật khẩu không đúng";

      if (!user || user.active === false) {
        return res.status(401).json({ error: failMsg });
      }

      if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
        const until = new Date(user.lockUntil);
        return res.status(403).json({
          error: `Tài khoản đang tạm khóa đến ${until.toLocaleString("vi-VN")}`,
          lockUntil: until.toISOString(),
        });
      }

      const ok = await bcrypt.compare(parsed.data.password, String(user.passwordHash || ""));
      if (!ok) {
        const fails = Number(user.failedLoginCount || 0) + 1;
        const patch: Record<string, unknown> = { failedLoginCount: fails };
        if (fails >= MAX_FAILS) {
          patch.lockUntil = new Date(Date.now() + LOCK_MS);
          patch.failedLoginCount = 0;
        }
        await db.collection(USERS).updateOne({ _id: user._id }, { $set: patch });
        if (fails >= MAX_FAILS) {
          return res.status(403).json({
            error: "Sai mật khẩu quá 5 lần. Tài khoản khóa 15 phút.",
            lockUntil: (patch.lockUntil as Date).toISOString(),
          });
        }
        return res.status(401).json({
          error: failMsg,
          remainingAttempts: MAX_FAILS - fails,
        });
      }

      await db.collection(USERS).updateOne(
        { _id: user._id },
        { $set: { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() } }
      );

      const body = await issueSession(res, db, user);
      return res.json(body);
    } catch (e: any) {
      console.error("[auth/login]", e);
      return res.status(500).json({ error: e?.message || "Lỗi đăng nhập" });
    }
  });

  app.post("/api/auth/refresh", async (req: AuthRequest, res) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (!token) return res.status(401).json({ error: "Không có refresh token" });
      const payload = verifyRefreshToken(token);
      const db = await getDb();
      const row = await db.collection(REFRESH).findOne({ jti: payload.jti });
      if (!row || row.revokedAt || row.tokenHash !== hashToken(token)) {
        clearAuthCookies(res);
        return res.status(401).json({ error: "Refresh không hợp lệ" });
      }
      if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
        clearAuthCookies(res);
        return res.status(401).json({ error: "Refresh hết hạn" });
      }
      const user = await db.collection(USERS).findOne(userIdQuery(payload.sub));
      if (!user) {
        clearAuthCookies(res);
        return res.status(401).json({ error: "Tài khoản không tồn tại" });
      }
      if (user.approvalStatus === "rejected") {
        clearAuthCookies(res);
        return res.status(401).json({
          error: "Tài khoản Zalo đã bị Quản lý từ chối. Liên hệ ALOHA nếu cần mở lại.",
          code: "REJECTED",
        });
      }
      // thu hồi refresh cũ, cấp cặp mới (kể cả chờ duyệt — để xem màn chờ)
      await db.collection(REFRESH).updateOne({ jti: payload.jti }, { $set: { revokedAt: new Date() } });
      const body = await issueSession(res, db, user);
      return res.json(body);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Refresh thất bại" });
    }
  });

  app.post("/api/auth/logout", async (req: AuthRequest, res) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (token) {
        try {
          const payload = verifyRefreshToken(token);
          const db = await getDb();
          await db.collection(REFRESH).updateOne(
            { jti: payload.jti },
            { $set: { revokedAt: new Date() } }
          );
        } catch {
          /* ignore */
        }
      }
      clearAuthCookies(res);
      return res.json({ ok: true });
    } catch (e: any) {
      clearAuthCookies(res);
      return res.json({ ok: true });
    }
  });

  app.get("/api/auth/me", requireAuth(getDb), async (req: AuthRequest, res) => {
    try {
      const db = await getDb();
      const user = await db.collection(USERS).findOne(userIdQuery(req.auth!.userId));
      if (!user) return res.status(401).json({ error: "Không tìm thấy user" });
      return res.json({ user: toPublicUser(user) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi /me" });
    }
  });

  app.post(
    "/api/auth/register",
    requireAuth(getDb),
    requireManager,
    async (req: AuthRequest, res) => {
      try {
        const parsed = registerBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ",
          });
        }
        const db = await getDb();
        const username = parsed.data.username.trim().toLowerCase();
        const exists = await db.collection(USERS).findOne({ username });
        if (exists) return res.status(409).json({ error: "Tài khoản đã tồn tại" });
        const passwordHash = await bcrypt.hash(parsed.data.password, 10);
        const doc = {
          username,
          passwordHash,
          fullName: parsed.data.fullName.trim(),
          role: parsed.data.role,
          permissions: parsed.data.permissions || [],
          zaloId: parsed.data.zaloId || null,
          active: true,
          approvalStatus: "approved",
          failedLoginCount: 0,
          lockUntil: null,
          createdAt: new Date(),
        };
        const result = await db.collection(USERS).insertOne(doc);
        return res.status(201).json({
          ok: true,
          user: toPublicUser({ ...doc, _id: result.insertedId }),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi tạo tài khoản" });
      }
    }
  );

  app.post(
    "/api/auth/unlock",
    requireAuth(getDb),
    requireManager,
    async (req: AuthRequest, res) => {
      const parsed = unlockBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Thiếu username" });
      const db = await getDb();
      await db.collection(USERS).updateOne(
        { username: parsed.data.username.trim().toLowerCase() },
        { $set: { failedLoginCount: 0, lockUntil: null } }
      );
      return res.json({ ok: true });
    }
  );

  app.post(
    "/api/auth/link-zalo",
    requireAuth(getDb),
    requireManager,
    async (req: AuthRequest, res) => {
      const parsed = linkZaloBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Thiếu username hoặc zaloId" });
      const db = await getDb();
      const r = await db.collection(USERS).updateOne(
        { username: parsed.data.username.trim().toLowerCase() },
        { $set: { zaloId: parsed.data.zaloId.trim() } }
      );
      if (!r.matchedCount) return res.status(404).json({ error: "Không tìm thấy user" });
      return res.json({ ok: true });
    }
  );

  /** Danh sách tài khoản chờ duyệt (chỉ Quản lý) */
  app.get(
    "/api/auth/pending-users",
    requireAuth(getDb),
    requireManager,
    async (_req: AuthRequest, res) => {
      try {
        const db = await getDb();
        const rows = await db
          .collection(USERS)
          .find({
            $or: [{ approvalStatus: "pending" }, { active: false, approvalStatus: { $ne: "rejected" } }],
          })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray();
        return res.json({ users: rows.map(toPublicUser) });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi danh sách chờ duyệt" });
      }
    }
  );

  app.post(
    "/api/auth/approve/:id",
    requireAuth(getDb),
    requireManager,
    async (req: AuthRequest, res) => {
      try {
        const id = String(req.params.id || "");
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "ID không hợp lệ" });
        const db = await getDb();
        const user = await db.collection(USERS).findOneAndUpdate(
          {
            $and: [
              userIdQuery(id),
              { $or: [{ approvalStatus: "pending" }, { active: false, approvalStatus: { $ne: "rejected" } }] },
            ],
          },
          {
            $set: {
              active: true,
              approvalStatus: "approved",
              approvedAt: new Date(),
              approvedBy: req.auth!.userId,
            },
          },
          { returnDocument: "after" }
        );
        if (!user) {
          return res.status(404).json({ error: "Không tìm thấy tài khoản chờ duyệt" });
        }
        syncBus.publish(["aloha_users_pending"], "auth_approve", { ids: [id] });
        return res.json({ ok: true, user: toPublicUser(user) });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi duyệt" });
      }
    }
  );

  app.post(
    "/api/auth/reject/:id",
    requireAuth(getDb),
    requireManager,
    async (req: AuthRequest, res) => {
      try {
        const id = String(req.params.id || "");
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "ID không hợp lệ" });
        const db = await getDb();
        const user = await db.collection(USERS).findOneAndUpdate(
          userIdQuery(id),
          {
            $set: {
              active: false,
              approvalStatus: "rejected",
              rejectedAt: new Date(),
              rejectedBy: req.auth!.userId,
            },
          },
          { returnDocument: "after" }
        );
        if (!user) {
          return res.status(404).json({ error: "Không tìm thấy tài khoản" });
        }
        await db.collection(REFRESH).updateMany(
          { userId: id, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
        syncBus.publish(["aloha_users_pending"], "auth_reject", { ids: [id] });
        return res.json({ ok: true, user: toPublicUser(user) });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi từ chối" });
      }
    }
  );

  // ─── Zalo OAuth v4 ─────────────────────────────────────────
  const pkceStore = new Map<string, { verifier: string; at: number }>();

  /** Luôn ưu tiên env — sau proxy HTTPS req.protocol dễ ra http → Zalo báo Invalid redirect uri */
  function zaloRedirectUri(req: { protocol?: string; get: (h: string) => string | undefined }) {
    const fromEnv = (process.env.ZALO_REDIRECT_URI || "").trim().replace(/\/$/, "");
    if (fromEnv) return fromEnv;
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
    const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    return `${proto}://${host}/api/auth/zalo/callback`;
  }

  app.get("/api/auth/zalo/start", (req, res) => {
    const appId = process.env.ZALO_APP_ID;
    const redirectUri = zaloRedirectUri(req);
    if (!appId) {
      return res.status(503).send(
        "Chưa cấu hình ZALO_APP_ID trên máy chủ. Dùng đăng nhập mật khẩu hoặc thêm env Zalo."
      );
    }
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(16).toString("hex");
    pkceStore.set(state, { verifier, at: Date.now() });
    const url = new URL("https://oauth.zaloapp.com/v4/permission");
    url.searchParams.set("app_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  });

  app.get("/api/auth/zalo/callback", async (req: AuthRequest, res) => {
    try {
      const appId = process.env.ZALO_APP_ID;
      const secret = process.env.ZALO_APP_SECRET;
      const redirectUri = zaloRedirectUri(req);
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      const entry = pkceStore.get(state);
      pkceStore.delete(state);
      if (!appId || !secret) {
        return res.redirect("/?auth_error=" + encodeURIComponent("Chưa cấu hình Zalo"));
      }
      if (!code || !entry) {
        return res.redirect("/?auth_error=" + encodeURIComponent("Zalo callback không hợp lệ"));
      }
      const tokenRes = await fetch("https://oauth.zaloapp.com/v4/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: secret,
        },
        body: new URLSearchParams({
          app_id: appId,
          code,
          grant_type: "authorization_code",
          code_verifier: entry.verifier,
          redirect_uri: redirectUri,
        }).toString(),
      });
      const tokenJson: any = await tokenRes.json();
      if (!tokenJson.access_token) {
        const detail = String(tokenJson.error_description || tokenJson.error || "").trim();
        return res.redirect(
          "/?auth_error=" +
            encodeURIComponent(
              detail
                ? `Không kết nối được Zalo (${detail}). Thử lại hoặc dùng mật khẩu.`
                : "Không kết nối được Zalo (không nhận được token). Thử lại hoặc dùng mật khẩu."
            )
        );
      }
      const meRes = await fetch("https://graph.zalo.me/v2.0/me?fields=id,name", {
        headers: { access_token: tokenJson.access_token },
      });
      const meJson: any = await meRes.json();
      const zaloId = meJson?.id ? String(meJson.id) : "";
      if (!zaloId) {
        return res.redirect("/?auth_error=" + encodeURIComponent("Không lấy được Zalo ID"));
      }
      const db = await getDb();
      let user = await db.collection(USERS).findOne({ zaloId });
      if (user && user.approvalStatus === "rejected") {
        return res.redirect(
          "/?auth_error=" +
            encodeURIComponent(
              "Tài khoản Zalo này đã bị Quản lý từ chối trước đó. Liên hệ ALOHA để mở lại (không phải lỗi Zalo)."
            )
        );
      }
      // Zalo lần đầu → tạo tài khoản staff CHỜ DUYỆT (tắt bằng ZALO_OPEN_SIGNUP=0)
      const openSignup =
        process.env.ZALO_OPEN_SIGNUP !== "0" &&
        process.env.ZALO_OPEN_SIGNUP !== "false";
      if (!user && openSignup) {
        const displayName = String(meJson?.name || "").trim() || `Zalo ${zaloId.slice(-6)}`;
        let username = `zalo_${zaloId}`.slice(0, 64);
        const clash = await db.collection(USERS).findOne({ username });
        if (clash) username = `zalo_${zaloId}_${Date.now().toString(36)}`.slice(0, 64);
        const doc = {
          username,
          passwordHash: null,
          fullName: displayName,
          role: "staff" as const,
          permissions: [] as string[],
          zaloId,
          active: false,
          approvalStatus: "pending" as const,
          failedLoginCount: 0,
          lockUntil: null,
          createdAt: new Date(),
          createdVia: "zalo_open_signup",
        };
        const ins = await db.collection(USERS).insertOne(doc);
        user = { ...doc, _id: ins.insertedId };
        syncBus.publish(["aloha_users_pending"], "zalo_signup", {
          ids: [String(ins.insertedId)],
        });
      }
      if (!user) {
        return res.redirect(
          "/?auth_error=" +
            encodeURIComponent(
              `Zalo chưa được cấp quyền. Zalo ID: ${zaloId}. Nhờ Quản lý gắn vào tài khoản.`
            ) +
            "&zalo_id=" +
            encodeURIComponent(zaloId)
        );
      }
      const waiting =
        user.active === false || user.approvalStatus === "pending";
      if (waiting && user.approvalStatus !== "rejected") {
        syncBus.publish(["aloha_users_pending"], "zalo_pending_login", {
          ids: [String(user._id)],
        });
      }
      await issueSession(res, db, user);
      return res.redirect(waiting ? "/?pending=1" : "/");
    } catch (e: any) {
      console.error("[auth/zalo]", e);
      return res.redirect("/?auth_error=" + encodeURIComponent(e?.message || "Lỗi Zalo"));
    }
  });

  // Indexes (best-effort)
  void (async () => {
    try {
      const db = await getDb();
      await db.collection(USERS).createIndex({ username: 1 }, { unique: true });
      await db.collection(USERS).createIndex({ zaloId: 1 }, { sparse: true });
      await db.collection(REFRESH).createIndex({ jti: 1 }, { unique: true });
      await db.collection(REFRESH).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch (e) {
      console.warn("[auth] index:", (e as Error)?.message);
    }
  })();
}

export function mountAuthGuards(app: Express, getDb: GetDb) {
  const guard = [requireAuth(getDb), requireActive];
  app.use("/api/db", ...guard);
  app.use("/api/aloha", ...guard);
}

/** Đọc cookie access (dùng test) */
export { ACCESS_COOKIE, REFRESH_COOKIE };
