import type { Express, Request, Response, NextFunction } from "express";
import type { Db } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  SHOP_ACCOUNTS,
  SHOP_REFRESH,
  SHOP_LOGIN_IP,
  SHOP_OAUTH_STATE,
  ensureShopAuthIndexes,
  isValidCtvCode,
  normalizeCtvCode,
  normalizeEmail,
  shopAccountIdQuery,
  toPublicShopAccount,
  type ShopRole,
} from "./models.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TTL_SEC,
  clearShopAuthCookies,
  hashShopToken,
  newShopRefreshJti,
  setShopAuthCookies,
  signShopAccessToken,
  signShopRefreshToken,
  verifyShopAccessToken,
  verifyShopRefreshToken,
  type ShopAccessPayload,
} from "./tokens.js";
import { applyShopCors, isAllowedShopOrigin } from "../shopCors.js";
import { syncBus } from "../syncBus.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import {
  allocateCtvCode,
  ctvApplicationToDoc,
  isValidPhoneVn,
  normalizePhoneVn,
  parseCtvApplicationBody,
} from "./ctvApplication.js";

function publishShopAccountChange(userId: string, source: string) {
  try {
    syncBus.publish(["aloha_shop_accounts"], source, {
      ids: [userId],
    });
  } catch {
    /* ignore */
  }
}

export type ShopAuthRequest = Request & {
  shopAuth?: ShopAccessPayload & { userId: string; active: boolean };
};

export type GetShopDb = () => Promise<Db>;

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 60 * 1000;
const IP_MAX = 40;

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function rateLimitIp(db: Db, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - IP_WINDOW_MS);
  const n = await db.collection(SHOP_LOGIN_IP).countDocuments({ ip, at: { $gte: since } });
  await db.collection(SHOP_LOGIN_IP).insertOne({ ip, at: new Date() });
  return n < IP_MAX;
}

function parseRoles(raw: unknown): ShopRole[] {
  const arr = Array.isArray(raw) ? raw.map(String) : [];
  const roles = arr.filter((r): r is ShopRole => r === "customer" || r === "ctv");
  if (!roles.length) return ["customer"];
  return [...new Set(roles)];
}

export async function issueShopSession(res: Response, db: Db, user: Record<string, unknown>) {
  const roles = parseRoles(user.roles);
  const payload: ShopAccessPayload = {
    sub: String(user._id),
    email: String(user.email || ""),
    roles,
  };
  const jti = newShopRefreshJti();
  const accessToken = signShopAccessToken(payload);
  const refreshToken = signShopRefreshToken({ ...payload, jti });
  await db.collection(SHOP_REFRESH).insertOne({
    jti,
    userId: String(user._id),
    tokenHash: hashShopToken(refreshToken),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
  });
  setShopAuthCookies(res, accessToken, refreshToken);
  return {
    ok: true,
    user: toPublicShopAccount(user),
    expires_in: ACCESS_TTL_SEC,
  };
}

export function requireShopAuth(getShopDb: GetShopDb) {
  return async (req: ShopAuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) || bearer;
      if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
      const payload = verifyShopAccessToken(token);
      const db = await getShopDb();
      const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(payload.sub));
      if (!user || user.active === false || Number(payload.iat || 0) < Number(user.authInvalidBefore || 0)) {
        return res.status(401).json({ error: "Tài khoản không hợp lệ hoặc đã bị khóa" });
      }
      req.shopAuth = {
        ...payload,
        userId: payload.sub,
        active: true,
        roles: parseRoles(user.roles),
      };
      next();
    } catch {
      return res.status(401).json({ error: "Phiên hết hạn hoặc không hợp lệ" });
    }
  };
}

function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function defaultShopOrigin(): string {
  return (process.env.NEXT_PUBLIC_SHOP_ORIGIN || "https://alohathegioichaucay.com").replace(
    /\/$/,
    ""
  );
}

/** Origin shop được phép redirect sau Google (local + prod). */
function resolveShopReturnOrigin(raw: unknown, referer?: string): string {
  const candidates = [String(raw || "").trim(), String(referer || "").trim()];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c.includes("://") ? c : `http://${c}`);
      const origin = u.origin;
      if (isAllowedShopOrigin(origin)) return origin;
    } catch {
      /* ignore */
    }
  }
  return defaultShopOrigin();
}

function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "https://alohathegioichaucay.com/api/shop/auth/google/callback"
  );
}

export function registerShopAuthRoutes(app: Express, getShopDb: GetShopDb) {
  let indexesReady = false;
  const ensureIdx = async (db: Db) => {
    if (indexesReady) return;
    await ensureShopAuthIndexes(db);
    indexesReady = true;
  };

  app.use("/api/shop/auth", (req, res, next) => {
    applyShopCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  app.post("/api/shop/auth/register", async (req, res) => {
    try {
      if (!shopRateLimitOrReject(req, res, "shop_register", 8, 60_000)) {
        return;
      }
      const db = await getShopDb();
      await ensureIdx(db);
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const fullName = String(req.body?.fullName || "").trim();
      const phoneRaw = String(req.body?.phone || "").trim();
      const roles = parseRoles(req.body?.roles);
      const asCtv = roles.includes("ctv");

      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Email không hợp lệ" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Mật khẩu tối thiểu 8 ký tự" });
      }
      if (!fullName) {
        return res.status(400).json({ error: "Nhập họ tên" });
      }

      let phone: string | null = phoneRaw || null;
      let ctvApp: ReturnType<typeof ctvApplicationToDoc> | null = null;
      let ctvCode = "";

      if (asCtv) {
        if (!isValidPhoneVn(phoneRaw)) {
          return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
        }
        phone = normalizePhoneVn(phoneRaw);
        const parsed = parseCtvApplicationBody(req.body);
        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }
        ctvApp = ctvApplicationToDoc(parsed.fields);

        const phoneTaken = await db.collection(SHOP_ACCOUNTS).findOne({
          $or: [{ phone }, { phone: phoneRaw }, { phone: `+84${phone.slice(1)}` }],
        });
        if (phoneTaken) {
          return res.status(409).json({ error: "Số điện thoại đã được dùng" });
        }

        const preferred = normalizeCtvCode(req.body?.ctvCode || "");
        ctvCode =
          (preferred && isValidCtvCode(preferred)
            ? preferred
            : null) ||
          (await allocateCtvCode(db, email)) ||
          "";
        if (!ctvCode || !isValidCtvCode(ctvCode)) {
          return res.status(400).json({ error: "Không tạo được mã CTV hợp lệ" });
        }
        const codeTaken = await db.collection(SHOP_ACCOUNTS).findOne({ ctvCode });
        if (codeTaken) {
          const again = await allocateCtvCode(db, email);
          if (!again) return res.status(409).json({ error: "Mã CTV đã được dùng" });
          ctvCode = again;
        }
      } else if (phoneRaw && !isValidPhoneVn(phoneRaw)) {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
      } else if (phoneRaw) {
        phone = normalizePhoneVn(phoneRaw);
      }

      const exists = await db.collection(SHOP_ACCOUNTS).findOne({ email });
      if (exists) {
        return res.status(409).json({
          error: asCtv
            ? "Email đã được đăng ký — hãy đăng nhập rồi nộp hồ sơ CTV trên tài khoản đó"
            : "Email đã được đăng ký",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();
      const doc: Record<string, unknown> = {
        email,
        phone,
        fullName,
        passwordHash,
        avatarUrl: null,
        roles,
        ctvStatus: asCtv ? "cho_duyet" : null,
        commissionRate: null,
        adminNote: null,
        active: true,
        failedLoginCount: 0,
        lockUntil: null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        ...(ctvApp || {}),
      };
      // Không ghi googleId/ctvCode = null — unique sparse index coi null là 1 giá trị
      if (ctvCode) doc.ctvCode = ctvCode;
      const ins = await db.collection(SHOP_ACCOUNTS).insertOne(doc);
      const user = { ...doc, _id: ins.insertedId };
      const body = await issueShopSession(res, db, user);
      if (asCtv) {
        publishShopAccountChange(String(ins.insertedId), "ctv_register");
      } else {
        publishShopAccountChange(String(ins.insertedId), "shop_register");
      }
      return res.status(201).json(body);
    } catch (e: any) {
      if (e?.code === 11000) {
        return res.status(409).json({ error: "Email hoặc mã CTV đã tồn tại" });
      }
      console.error("[shop/auth/register]", e);
      return res.status(500).json({ error: e?.message || "Lỗi đăng ký" });
    }
  });

  app.post("/api/shop/auth/login", async (req, res) => {
    try {
      const db = await getShopDb();
      await ensureIdx(db);
      const ip = clientIp(req);
      if (!(await rateLimitIp(db, ip))) {
        return res.status(429).json({ error: "Thử quá nhiều lần. Đợi khoảng 1 phút." });
      }
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const failMsg = "Email hoặc mật khẩu không đúng";
      const user = await db.collection(SHOP_ACCOUNTS).findOne({ email });
      if (!user || user.active === false) {
        return res.status(401).json({ error: failMsg });
      }
      if (!user.passwordHash) {
        return res.status(401).json({
          error: "Tài khoản này đăng nhập bằng Google. Hãy dùng nút Google.",
        });
      }
      if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
        return res.status(403).json({
          error: `Tài khoản tạm khóa đến ${new Date(user.lockUntil).toLocaleString("vi-VN")}`,
        });
      }
      const ok = await bcrypt.compare(password, String(user.passwordHash));
      if (!ok) {
        const fails = Number(user.failedLoginCount || 0) + 1;
        const patch: Record<string, unknown> = { failedLoginCount: fails };
        if (fails >= MAX_FAILS) {
          patch.lockUntil = new Date(Date.now() + LOCK_MS);
          patch.failedLoginCount = 0;
        }
        await db.collection(SHOP_ACCOUNTS).updateOne({ _id: user._id }, { $set: patch });
        return res.status(401).json({ error: failMsg });
      }
      await db.collection(SHOP_ACCOUNTS).updateOne(
        { _id: user._id },
        { $set: { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() } }
      );
      return res.json(await issueShopSession(res, db, user));
    } catch (e: any) {
      console.error("[shop/auth/login]", e);
      return res.status(500).json({ error: e?.message || "Lỗi đăng nhập" });
    }
  });

  app.post("/api/shop/auth/refresh", async (req, res) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (!token) return res.status(401).json({ error: "Không có refresh token" });
      const payload = verifyShopRefreshToken(token);
      const db = await getShopDb();
      const row = await db.collection(SHOP_REFRESH).findOne({ jti: payload.jti });
      if (!row || row.revokedAt || row.tokenHash !== hashShopToken(token)) {
        clearShopAuthCookies(res);
        return res.status(401).json({ error: "Refresh không hợp lệ" });
      }
      const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(payload.sub));
      if (!user || user.active === false || Number(payload.iat || 0) < Number(user.authInvalidBefore || 0)) {
        clearShopAuthCookies(res);
        return res.status(401).json({ error: "Tài khoản không hợp lệ" });
      }
      await db.collection(SHOP_REFRESH).updateOne({ jti: payload.jti }, { $set: { revokedAt: new Date() } });
      return res.json(await issueShopSession(res, db, user));
    } catch {
      clearShopAuthCookies(res);
      return res.status(401).json({ error: "Refresh hết hạn" });
    }
  });

  app.post("/api/shop/auth/logout", async (req, res) => {
    res.clearCookie("shop_si_onboarding", { path: "/" });
    try {
      const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (token) {
        try {
          const payload = verifyShopRefreshToken(token);
          const db = await getShopDb();
          await db.collection(SHOP_REFRESH).updateOne({ jti: payload.jti }, { $set: { revokedAt: new Date() } });
        } catch {
          /* ignore */
        }
      }
      clearShopAuthCookies(res);
      return res.json({ ok: true });
    } catch (e: any) {
      clearShopAuthCookies(res);
      return res.json({ ok: true });
    }
  });

  app.get("/api/shop/auth/me", requireShopAuth(getShopDb), async (req: ShopAuthRequest, res) => {
    try {
      const db = await getShopDb();
      const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.shopAuth!.userId));
      if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản" });
      return res.json({ ok: true, user: toPublicShopAccount(user) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Lỗi" });
    }
  });

  app.patch("/api/shop/auth/me", requireShopAuth(getShopDb), async (req: ShopAuthRequest, res) => {
    try {
      const db = await getShopDb();
      const fullName = String(req.body?.fullName || "").trim();
      const phoneRaw =
        req.body?.phone !== undefined ? String(req.body?.phone || "").trim() : undefined;
      const becomeCtv = Boolean(req.body?.becomeCtv);

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (fullName) patch.fullName = fullName;

      const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.shopAuth!.userId));
      if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản" });

      if (user.active === false) {
        return res.status(403).json({ error: "Tài khoản đang bị khóa, liên hệ Aloha" });
      }

      if (phoneRaw !== undefined && user.roles?.includes("si") && normalizePhoneVn(phoneRaw) !== normalizePhoneVn(String(user.phone || ""))) {
        return res.status(403).json({ error: "Vui lòng liên hệ Aloha để đổi SĐT tài khoản sỉ" });
      }
      if (phoneRaw !== undefined) {
        if (phoneRaw && !isValidPhoneVn(phoneRaw)) {
          return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
        }
        patch.phone = phoneRaw ? normalizePhoneVn(phoneRaw) : null;
      }

      if (becomeCtv) {
        const roles = parseRoles(user.roles);
        const status = String(user.ctvStatus || "");
        if (status === "active" && roles.includes("ctv")) {
          return res.status(400).json({ error: "Tài khoản đã là CTV" });
        }
        if (status === "cho_duyet" && roles.includes("ctv")) {
          return res.status(400).json({ error: "Hồ sơ CTV đang chờ duyệt" });
        }
        if (status === "khoa" && roles.includes("ctv")) {
          return res.status(403).json({ error: "Tài khoản đang bị khóa, liên hệ Aloha" });
        }

        const phoneForCtv =
          (patch.phone as string | null | undefined) ??
          (user.phone ? String(user.phone) : "");
        if (!isValidPhoneVn(String(phoneForCtv || ""))) {
          return res.status(400).json({ error: "Số điện thoại không hợp lệ" });
        }
        const phoneNorm = normalizePhoneVn(String(phoneForCtv));
        patch.phone = phoneNorm;

        const phoneTaken = await db.collection(SHOP_ACCOUNTS).findOne({
          _id: { $ne: user._id },
          $or: [
            { phone: phoneNorm },
            { phone: `+84${phoneNorm.slice(1)}` },
          ],
        });
        if (phoneTaken) {
          return res.status(409).json({ error: "Số điện thoại đã được dùng" });
        }

        const parsed = parseCtvApplicationBody(req.body);
        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }
        Object.assign(patch, ctvApplicationToDoc(parsed.fields));

        if (!roles.includes("ctv")) {
          let ctvCode = normalizeCtvCode(req.body?.ctvCode || String(user.ctvCode || ""));
          if (!isValidCtvCode(ctvCode)) {
            ctvCode = (await allocateCtvCode(db, String(user.email || ""), user._id)) || "";
          } else {
            const taken = await db.collection(SHOP_ACCOUNTS).findOne({
              ctvCode,
              _id: { $ne: user._id },
            });
            if (taken) {
              ctvCode = (await allocateCtvCode(db, String(user.email || ""), user._id)) || "";
            }
          }
          if (!isValidCtvCode(ctvCode)) {
            return res.status(400).json({ error: "Không tạo được mã CTV hợp lệ" });
          }
          patch.roles = [...roles, "ctv"];
          patch.ctvCode = ctvCode;
        }
        patch.ctvStatus = "cho_duyet";
        patch.ctvRejectReason = null;
      }

      await db.collection(SHOP_ACCOUNTS).updateOne({ _id: user._id }, { $set: patch });
      const updated = await db.collection(SHOP_ACCOUNTS).findOne({ _id: user._id });
      if (becomeCtv && patch.ctvStatus === "cho_duyet") {
        publishShopAccountChange(String(user._id), "ctv_apply");
      }
      return res.json({ ok: true, user: toPublicShopAccount(updated!) });
    } catch (e: any) {
      if (e?.code === 11000) return res.status(409).json({ error: "Mã CTV đã tồn tại" });
      return res.status(500).json({ error: e?.message || "Lỗi cập nhật" });
    }
  });

  app.get("/api/shop/auth/google/start", async (req, res) => {
    try {
      if (!googleConfigured()) {
        return res.status(503).json({
          error: "Chưa cấu hình Google OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)",
        });
      }
      const db = await getShopDb();
      await ensureIdx(db);
      const state = crypto.randomBytes(24).toString("hex");
      const next = String(req.query.next || "/").slice(0, 200);
      const returnOrigin = resolveShopReturnOrigin(
        req.query.origin,
        String(req.headers.referer || "")
      );
      await db.collection(SHOP_OAUTH_STATE).insertOne({
        state,
        next,
        returnOrigin,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      });
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: googleRedirectUri(),
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account",
      });
      return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    } catch (e: any) {
      console.error("[shop/auth/google/start]", e);
      return res.status(500).json({ error: e?.message || "Lỗi Google" });
    }
  });

  app.get("/api/shop/auth/google/callback", async (req, res) => {
    let shopOrigin = defaultShopOrigin();
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        return res.redirect(`${shopOrigin}/dang-nhap?error=google_denied`);
      }
      const db = await getShopDb();
      const st = await db.collection(SHOP_OAUTH_STATE).findOne({ state });
      if (!st) return res.redirect(`${shopOrigin}/dang-nhap?error=google_state`);
      await db.collection(SHOP_OAUTH_STATE).deleteOne({ state });
      shopOrigin = resolveShopReturnOrigin(st.returnOrigin);
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: googleRedirectUri(),
          grant_type: "authorization_code",
        }),
      });
      const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenJson.access_token) {
        console.error("[shop/google/token]", tokenJson);
        return res.redirect(`${shopOrigin}/dang-nhap?error=google_token`);
      }
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const profile = (await profileRes.json()) as {
        id?: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      const googleId = String(profile.id || "");
      const email = normalizeEmail(profile.email || "");
      if (!googleId || !email) {
        return res.redirect(`${shopOrigin}/dang-nhap?error=google_profile`);
      }

      let user = await db.collection(SHOP_ACCOUNTS).findOne({
        $or: [{ googleId }, { email }],
      });
      const now = new Date();
      if (!user) {
        // Không ghi phone/ctvCode/passwordHash = null — unique sparse index coi null là 1 giá trị
        // (giống register email). Tài khoản Google thứ 2+ lỗi google_callback vì ctvCode: null.
        const doc: Record<string, unknown> = {
          email,
          fullName: String(profile.name || email),
          googleId,
          roles: ["customer"] as ShopRole[],
          ctvStatus: null,
          commissionRate: null,
          adminNote: null,
          active: true,
          failedLoginCount: 0,
          lockUntil: null,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        };
        if (profile.picture) doc.avatarUrl = String(profile.picture);
        const ins = await db.collection(SHOP_ACCOUNTS).insertOne(doc);
        user = { ...doc, _id: ins.insertedId };
      } else {
        if (user.active === false) {
          return res.redirect(`${shopOrigin}/dang-nhap?error=locked`);
        }
        await db.collection(SHOP_ACCOUNTS).updateOne(
          { _id: user._id },
          {
            $set: {
              googleId,
              avatarUrl: profile.picture || user.avatarUrl || null,
              lastLoginAt: now,
              updatedAt: now,
              ...(user.email ? {} : { email }),
            },
          }
        );
        user = await db.collection(SHOP_ACCOUNTS).findOne({ _id: user._id });
      }

      await issueShopSession(res, db, user!);
      const nextRaw = String(st.next || "/");
      let next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
      const pub = toPublicShopAccount(user!);
      const roles = Array.isArray(pub.roles) ? pub.roles : [];
      const pathOnly = next.split("?")[0] || "/";
      if (roles.includes("ctv") && pub.ctvStatus === "cho_duyet" && !roles.includes("customer")) {
        next = "/cho-duyet-ctv";
      } else if (
        roles.includes("ctv") &&
        pub.ctvStatus === "active" &&
        (pathOnly === "/" || pathOnly === "" || pathOnly === "/tai-khoan")
      ) {
        next = "/cong-tac-vien";
      }
      return res.redirect(`${shopOrigin}${next}`);
    } catch (e) {
      console.error("[shop/auth/google/callback]", e);
      return res.redirect(`${shopOrigin}/dang-nhap?error=google_callback`);
    }
  });

  /**
   * SSE phiên đăng nhập — admin duyệt CTV → shop nhận ngay, refetch /me.
   */
  app.get(
    "/api/shop/auth/stream",
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res: Response) => {
      applyShopCors(req, res);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof (res as any).flushHeaders === "function") {
        (res as any).flushHeaders();
      }

      const userId = String(req.shopAuth!.userId);
      const writeEvent = (event: string, data: unknown) => {
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* closed */
        }
      };
      writeEvent("hello", { at: Date.now(), userId });

      const onChange = (payload: { collections?: string[]; ids?: string[]; source?: string }) => {
        const cols = payload?.collections || [];
        if (!cols.includes("aloha_shop_accounts") && !cols.includes(SHOP_ACCOUNTS)) return;
        const ids = (payload.ids || []).map(String);
        if (ids.length && !ids.includes(userId)) return;
        void (async () => {
          try {
            const db = await getShopDb();
            const user = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(userId));
            writeEvent("account", {
              userId,
              ctvStatus: user?.ctvStatus ?? null,
              source: payload.source || "",
              at: Date.now(),
            });
          } catch {
            writeEvent("account", { userId, at: Date.now(), source: payload.source || "" });
          }
        })();
      };
      syncBus.on("change", onChange);

      const ping = setInterval(() => {
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch {
          /* */
        }
      }, 25000);

      const cleanup = () => {
        clearInterval(ping);
        syncBus.off("change", onChange);
      };
      req.on("close", cleanup);
      req.on("aborted", cleanup);
    }
  );
}
