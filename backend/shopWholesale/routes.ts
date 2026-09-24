import crypto from "node:crypto";
import { provisionWholesaleCustomer } from "./provision.js";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery, toPublicShopAccount } from "../shopAuth/models.js";
import { issueShopSession } from "../shopAuth/routes.js";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { applyShopCors, isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { syncBus } from "../syncBus.js";
import { addressSchema, applicationSchema, canonicalAddress } from "./schema.js";
import { verifyCustomerRegion, lookupKvCustomers } from "./kvCustomers.js";
import { SI_TERMS_VERSION, wholesaleMinimum } from "./policy.js";

type GetDb = () => Promise<Db>;
const SESSIONS = "aloha_shop_si_sessions";
const LOOKUPS = "aloha_shop_si_lookups";
const COOKIE = "shop_si_onboarding";
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === "1" || process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 30 * 60 * 1000 });

async function currentAccount(req: Request, db: Db) {
  try {
    const payload = verifyShopAccessToken(req.cookies?.[ACCESS_COOKIE] || "");
    const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(payload.sub));
    return account && account.active !== false && Number(payload.iat || 0) >= Number(account.authInvalidBefore || 0) ? account : null;
  } catch { return null; }
}

async function identity(req: Request, db: Db) {
  const account = await currentAccount(req, db);
  if (account?.zaloId && account.zaloVerifiedAt) return { owner: String(account._id), zaloId: String(account.zaloId), account };
  const secret = String(req.cookies?.[COOKIE] || "");
  const session = secret && await db.collection(SESSIONS).findOne({ tokenHash: hash(secret), kind: "identity", expiresAt: { $gt: new Date() } });
  if (!session) return null;
  if (session.accountId && String(account?._id) !== session.accountId) return null;
  return { owner: session.tokenHash as string, zaloId: session.zaloId as string, account };
}

function sendError(res: Response, error: any) {
  if (error?.code === 11000) return res.status(409).json({ error: "Email, SĐT hoặc Zalo đã được dùng. Hãy đăng nhập tài khoản cũ hoặc liên hệ Aloha." });
  if (error?.issues) return res.status(400).json({ error: error.issues[0]?.message || "Thông tin chưa hợp lệ" });
  console.error("[si]", error?.message);
  return res.status(503).json({ error: "Chưa xử lý được yêu cầu. Vui lòng thử lại." });
}

export function registerWholesaleRoutes(app: Express, getDb: GetDb, getOpsDb: GetDb) {
  let indexes: Promise<unknown> | undefined;
  const ensure = (db: Db) => indexes ||= Promise.all([
    db.collection(SESSIONS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(SESSIONS).createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection(LOOKUPS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(LOOKUPS).createIndex({ lookupId: 1 }, { unique: true }),
    db.collection(SHOP_ACCOUNTS).createIndex({ zaloId: 1 }, { unique: true, partialFilterExpression: { zaloId: { $type: "string" } } }),
    db.collection(SHOP_ACCOUNTS).createIndex({ phoneNorm: 1 }, { unique: true, partialFilterExpression: { siIdentity: true, phoneNorm: { $type: "string" } } }),
    db.collection(SHOP_ACCOUNTS).createIndex({ kvRetailer: 1, kvCustomerId: 1 }, { unique: true, partialFilterExpression: { kvCustomerId: { $type: "number" }, siIdentity: true } }),
  ]).catch(error => { indexes = undefined; throw error; });

  app.use(["/api/shop/auth/si", "/api/shop/auth/zalo"], (req, res, next) => {
    applyShopCors(req, res);
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET" && req.headers.origin && !isAllowedShopOrigin(req.headers.origin)) return res.sendStatus(403);
    if (!shopRateLimitOrReject(req, res, "si_onboarding", 30, 60000)) return;
    next();
  });

  app.get("/api/shop/auth/si/session", async (req, res) => {
    try {
      const db = await getDb();
      const who = await identity(req, db);
      res.json({ verified: Boolean(who), user: who?.account ? toPublicShopAccount(who.account) : null,
        zaloConfigured: Boolean(process.env.ZALO_APP_ID && process.env.ZALO_APP_SECRET && process.env.ZALO_REDIRECT_URI),
        minOrder: wholesaleMinimum("TINH"), termsVersion: SI_TERMS_VERSION });
    } catch (error) { sendError(res, error); }
  });

  app.get("/api/shop/auth/zalo/start", async (req, res) => {
    try {
      if (!process.env.ZALO_APP_ID || !process.env.ZALO_APP_SECRET || !process.env.ZALO_REDIRECT_URI) {
        return res.redirect("/dang-ky-si?error=zalo_not_configured");
      }
      const db = await getDb(); await ensure(db);
      const account = await currentAccount(req, db);
      const verifier = crypto.randomBytes(32).toString("base64url");
      const state = crypto.randomBytes(32).toString("hex");
      const binding = crypto.randomBytes(32).toString("hex");
      await db.collection(SESSIONS).insertOne({ tokenHash: hash(binding), kind: "oauth", stateHash: hash(state), verifier,
        accountId: account ? String(account._id) : null, expiresAt: new Date(Date.now() + 10 * 60000) });
      res.cookie(COOKIE, binding, cookieOptions());
      const query = new URLSearchParams({ app_id: process.env.ZALO_APP_ID, redirect_uri: process.env.ZALO_REDIRECT_URI,
        code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), state });
      res.redirect(`https://oauth.zaloapp.com/v4/permission?${query}`);
    } catch (error) { sendError(res, error); }
  });

  app.get("/api/shop/auth/zalo/callback", async (req, res) => {
    try {
      const db = await getDb(); await ensure(db);
      const binding = String(req.cookies?.[COOKIE] || "");
      const state = String(req.query.state || "");
      if (!binding || !state || !req.query.code) return res.redirect("/dang-ky-si?error=zalo_cancelled");
      const session = await db.collection(SESSIONS).findOneAndDelete({ tokenHash: hash(binding), kind: "oauth",
        stateHash: hash(state), expiresAt: { $gt: new Date() } });
      if (!session) return res.redirect("/dang-ky-si?error=zalo_expired");
      const current = await currentAccount(req, db);
      if ((session.accountId || null) !== (current ? String(current._id) : null)) return res.redirect("/dang-ky-si?error=account_changed");
      const tokenResponse = await fetch("https://oauth.zaloapp.com/v4/access_token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: process.env.ZALO_APP_SECRET! },
        body: new URLSearchParams({ code: String(req.query.code), app_id: process.env.ZALO_APP_ID!, grant_type: "authorization_code", code_verifier: session.verifier }),
        signal: AbortSignal.timeout(10000),
      });
      const tokens = await tokenResponse.json() as any;
      if (!tokenResponse.ok || !tokens.access_token) throw new Error("Zalo token exchange failed");
      const profileResponse = await fetch("https://graph.zalo.me/v2.0/me?fields=id,name,picture", {
        headers: { access_token: tokens.access_token }, signal: AbortSignal.timeout(10000) });
      const profile = await profileResponse.json() as any;
      if (!profileResponse.ok || !profile.id) throw new Error("Zalo profile failed");
      const zaloId = String(profile.id);
      let account = await db.collection(SHOP_ACCOUNTS).findOne({ zaloId });
      if (account && (account.active === false || (current && String(current._id) !== String(account._id)))) {
        return res.redirect("/dang-ky-si?error=zalo_account_conflict");
      }
      if (current && !account) {
        if (current.zaloId && current.zaloId !== zaloId) return res.redirect("/dang-ky-si?error=zalo_account_conflict");
        await db.collection(SHOP_ACCOUNTS).updateOne({ _id: current._id }, { $set: { zaloId, zaloVerifiedAt: new Date().toISOString() } });
        account = await db.collection(SHOP_ACCOUNTS).findOne({ _id: current._id });
      }
      const secret = crypto.randomBytes(32).toString("hex");
      await db.collection(SESSIONS).insertOne({ tokenHash: hash(secret), kind: "identity", zaloId,
        accountId: account ? String(account._id) : null, expiresAt: new Date(Date.now() + 30 * 60000) });
      res.cookie(COOKIE, secret, cookieOptions());
      if (account) await issueShopSession(res, db, account);
      res.redirect("/dang-ky-si");
    } catch { res.redirect("/dang-ky-si?error=zalo_failed"); }
  });

  app.post("/api/shop/auth/si/lookup", async (req, res) => {
    try {
      const db = await getDb(); await ensure(db);
      const who = await identity(req, db);
      if (!who) return res.status(401).json({ error: "Vui lòng đăng nhập Zalo trước" });
      const input = addressSchema.parse(req.body);

      // Nếu tài khoản đã có SĐT gắn với Zalo trước đó, khóa cố định SĐT này, không cho tra cứu số khác
      if (who.account?.phoneNorm && normalizeWholesalePhone(who.account.phoneNorm) !== input.phone) {
        return res.status(400).json({ error: "Số điện thoại tra cứu phải trùng khớp với số điện thoại đã liên kết của tài khoản Zalo này." });
      }

      let result = "lookup_unavailable"; let candidate: any = null; let retailer: string | null = null;
      try {
        const found = await lookupKvCustomers(await getOpsDb(), input.phone);
        retailer = found.retailer;
        if (!found.customers.length) result = "not_found";
        else if (found.customers.length !== 1) result = "manual_review";
        else {
          candidate = found.customers[0];
          // A vetted mapping row is required for old administrative names. No fuzzy ownership inference.
          const mapping = await db.collection("aloha_shop_address_map").findOne({
            kvLocation: String(candidate.locationName || ""), kvWard: String(candidate.wardName || ""), verified: true });
          const directAddress = candidate.locationName && candidate.wardName ? {
            province: String(candidate.locationName).split(",").pop()?.trim() || String(candidate.locationName),
            ward: String(candidate.wardName || ""),
            detail: String(candidate.address || ""),
          } : null;
          const address = mapping ? { province: String(mapping.province), ward: String(mapping.ward), detail: String(candidate.address || "") } : directAddress;
          const isWholesale = await verifyCustomerRegion(await getOpsDb(), candidate);
          // Nới lỏng: Chỉ cần đúng SĐT có trên KiotViet và thuộc nhóm khách sỉ là công nhận khách sỉ cũ (existing_si_candidate),
          // không bắt buộc phải khớp 100% từng chữ của địa chỉ kho do cách nhập khác nhau.
          result = !isWholesale ? "existing_non_si" : "existing_si_candidate";
        }
      } catch { result = "lookup_unavailable"; }
      const lookupId = crypto.randomUUID();
      await db.collection(LOOKUPS).insertOne({ lookupId, owner: who.owner, address: canonicalAddress(input), phone: input.phone,
        result, candidate, retailer, expiresAt: new Date(Date.now() + 30 * 60000) });
      res.json({ lookupId, result });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/shop/auth/si/register", async (req, res) => {
    try {
      const db = await getDb(); await ensure(db);
      const who = await identity(req, db);
      if (!who) return res.status(401).json({ error: "Vui lòng đăng nhập Zalo lại" });
      const input = applicationSchema.parse(req.body);
      const lookup = await db.collection(LOOKUPS).findOne({ lookupId: input.lookupId, owner: who.owner,
        phone: input.phone, address: canonicalAddress(input), expiresAt: { $gt: new Date() } });
      if (!lookup) return res.status(409).json({ error: "Thông tin đã thay đổi hoặc hết hạn. Vui lòng kiểm tra lại SĐT/địa chỉ." });
      if (lookup.result !== "existing_si_candidate" && (!input.shopName || !input.businessType)) return res.status(400).json({ error: "Vui lòng nhập tên cửa hàng và loại hình kinh doanh" });
      let account = who.account;
      if (account && ["active", "cho_duyet", "khoa"].includes(String(account.siStatus))) {
        return res.status(409).json({ error: "Tài khoản đã có hồ sơ sỉ. Vui lòng xem trạng thái hồ sơ." });
      }
      // Nếu tài khoản đã có SĐT gắn với Zalo trước đó, bắt buộc phải dùng đúng SĐT này để tránh đổi sang số khác
      if (account?.phoneNorm && normalizeWholesalePhone(account.phoneNorm) !== input.phone) {
        return res.status(409).json({ error: "Số điện thoại đăng ký phải trùng khớp với số điện thoại đã liên kết của tài khoản Zalo này." });
      }

      // Check legacy phone spellings as well as the new atomic unique index.
      const conflicts = await db.collection(SHOP_ACCOUNTS).findOne({
        ...(account ? { _id: { $ne: account._id } } : {}),
        $or: [{ phoneNorm: input.phone }, { phone: input.phone }, { phone: `+84${input.phone.slice(1)}` }, { phone: `84${input.phone.slice(1)}` }],
      });
      if (conflicts) return res.status(409).json({ error: "SĐT đã có tài khoản. Hãy đăng nhập tài khoản cũ hoặc liên hệ Aloha." });
      const { password, email, lookupId, acceptedTerms, ...profile } = input;
      const now = new Date().toISOString();
      const patch = { fullName: input.fullName, phone: input.phone, phoneNorm: input.phone, siIdentity: true,
        siStatus: "cho_duyet", siProfile: { ...profile, acceptedTermsAt: now, termsVersion: SI_TERMS_VERSION },
        siLookupId: lookupId, siLookupResult: lookup.result, siCandidate: lookup.candidate,
        siCandidateRetailer: lookup.retailer, siVerification: { status: "pending" },
        zaloId: who.zaloId, zaloVerifiedAt: now, updatedAt: now };
      if (!account) {
        if (!email || !password) return res.status(400).json({ error: "Nhập email và mật khẩu để hoàn tất tài khoản" });
        const doc = { ...patch, email, passwordHash: await bcrypt.hash(password, 12), roles: ["customer", "si"],
          active: true, applicationRevision: 1, createdAt: now };
        const inserted = await db.collection(SHOP_ACCOUNTS).insertOne(doc);
        account = await db.collection(SHOP_ACCOUNTS).findOne({ _id: inserted.insertedId });
      } else {
        const result = await db.collection(SHOP_ACCOUNTS).updateOne({ _id: account._id,
          siStatus: { $nin: ["active", "cho_duyet", "khoa"] } }, {
          $set: patch, $addToSet: { roles: "si" }, $inc: { applicationRevision: 1 },
        });
        if (!result.modifiedCount) return res.status(409).json({ error: "Hồ sơ vừa thay đổi. Vui lòng tải lại." });
        account = await db.collection(SHOP_ACCOUNTS).findOne({ _id: account._id });
      }
      res.clearCookie(COOKIE, { path: "/" });
      syncBus.publish([SHOP_ACCOUNTS], "si_register_pending", { ids: [String(account!._id)] });
      res.json(await issueShopSession(res, db, account!));
    } catch (error) { sendError(res, error); }
  });

  const gate = [requireAuth(getOpsDb), requireActive, requireManager];
  app.get("/api/shop/admin/si", ...gate, async (req, res) => {
    try {
      const db = await getDb();
      const status = String(req.query.status || "");
      const filter = { roles: "si", ...(status ? { siStatus: status } : {}) };
      const docs = await db.collection(SHOP_ACCOUNTS).find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
      res.json({ items: docs.map(d => ({ ...toPublicShopAccount(d), revision: d.applicationRevision || 0,
        verification: d.siVerification, candidate: d.siCandidate, kvCustomerId: d.kvCustomerId,
        syncStatus: d.siKvSyncStatus, siLookupResult: d.siLookupResult, audit: d.siAudit || [] })) });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/shop/admin/si/:id/retry-kv", ...gate, async (req, res) => {
    try {
      const db = await getDb();
      const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(String(req.params.id)));
      if (!account) return res.sendStatus(404);
      const result = await provisionWholesaleCustomer(db, await getOpsDb(), account._id);
      res.json(result);
    } catch (error) { sendError(res, error); }
  });

  app.patch("/api/shop/admin/si/:id", ...gate, async (req: AuthRequest, res) => {
    try {
      const db = await getDb(); await ensure(db);
      const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(String(req.params.id)));
      if (!account?.roles?.includes("si")) return res.sendStatus(404);
      const to = String(req.body.status || "");
      if (!["active", "tu_choi", "khoa"].includes(to)) return res.sendStatus(400);
      const reason = String(req.body.reason || "").trim().slice(0, 1000);
      if (!reason) return res.status(400).json({ error: "Nhập lý do / phương thức xác minh" });
      const region = String(req.body.region || account.siRegion || "");
      if (to === "active" && (req.body.verified !== true || !["HCM", "TINH"].includes(region))) {
        return res.status(400).json({ error: "Xác minh quyền đại diện và chọn vùng trước khi duyệt" });
      }
      const now = new Date().toISOString();
      const patch: Record<string, any> = { siStatus: to, updatedAt: now };
      if (to === "active") {
        if (!account.siProfile?.acceptedTermsAt || account.siProfile.termsVersion !== SI_TERMS_VERSION) return res.status(409).json({ error: "Khách cần đồng ý điều khoản mua sỉ hiện hành trước khi duyệt." });
        // Recheck live before linking. Outage cannot turn a legacy customer into a new one.
        const found = await lookupKvCustomers(await getOpsDb(), account.phoneNorm);
        if (found.customers.length > 1) return res.status(409).json({ error: "Có nhiều KH KV cùng SĐT. Cần đối soát trước khi duyệt." });
        if (found.customers.length === 1) {
          const candidate = found.customers[0];
          const kvRegion = await verifyCustomerRegion(await getOpsDb(), candidate);
          if (!kvRegion) return res.status(409).json({ error: "KH KV chưa có nhóm sỉ rõ ràng. Hãy xác nhận/cập nhật nhóm KV trước." });
          if (region !== kvRegion) return res.status(409).json({ error: "Vùng chọn khác nhóm KV. Cần đối soát trước." });
          Object.assign(patch, { kvCustomerId: Number(candidate.id), kvCustomerCode: String(candidate.code), kvRetailer: found.retailer, siKvSyncStatus: "synced" });
        } else {
          // Durable queue; provisioning is only enabled after KV contract verification.
          patch.siKvSyncStatus = "pending";
          patch.siKvSyncNextAt = now;
        }
        Object.assign(patch, { siRegion: region, siVerification: { status: "verified", method: reason, verifiedBy: req.auth!.userId, verifiedAt: now }, siApprovedNotifyPending: true });
      }
      const audit = { id: crypto.randomUUID(), action: to, fromStatus: account.siStatus, toStatus: to,
        reason, actorAdminId: req.auth!.userId, at: now };
      const result = await db.collection(SHOP_ACCOUNTS).updateOne({ _id: account._id, applicationRevision: Number(req.body.revision), siStatus: account.siStatus }, {
        $set: patch, $inc: { applicationRevision: 1 }, $push: { siAudit: audit } as any,
      });
      if (!result.modifiedCount) return res.status(409).json({ error: "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi duyệt." });
      // The authoritative audit is atomic with status on the account; mirror can be rebuilt.
      await db.collection("aloha_shop_si_audit").updateOne({ id: audit.id }, { $setOnInsert: { ...audit, accountId: String(account._id) } }, { upsert: true }).catch(() => { /* Atomic account audit remains authoritative. */ });
      syncBus.publish([SHOP_ACCOUNTS], "si_status_changed", { ids: [String(account._id)] });
      res.json({ ok: true });
    } catch (error) { sendError(res, error); }
  });
}
