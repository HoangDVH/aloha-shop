import crypto from "node:crypto";
import { wholesaleApprovalBasis, wholesaleAdminFilter } from "./approvalSource.js";
import { assignWholesaleRegion } from "./regionAssignment.js";
import { provisionWholesaleCustomer } from "./provision.js";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery, toPublicShopAccount } from "../shopAuth/models.js";
import { issueShopSession, requireShopAuth, type ShopAuthRequest } from "../shopAuth/routes.js";
import { registrationAddressPatch, ensureRegistrationAddress } from "./registrationAddress.js";
import { addressSnapshotFilter } from "../shopOrders/addressWrite.js";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { applyShopCors, isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { syncBus } from "../syncBus.js";
import { addressSchema, applicationSchema, canonicalAddress } from "./schema.js";
import { verifyCustomerRegion, lookupKvCustomers } from "./kvCustomers.js";
import { SI_TERMS_VERSION, normalizeWholesalePhone } from "./policy.js";
import { loadPurchasePolicy } from "./purchasePolicy.js";
import { accountOwnsPhone, decideWholesalePhoneLink, maskShopEmail, phoneOwnerFilter } from "./accountLink.js";
import {
  getSiIdentitySession,
  getSiLookup,
  putSiIdentitySession,
  putSiLookup,
  putSiOauthSession,
  takeSiOauthSession,
} from "./siEphemeral.js";
import { zaloNotifyService, NOTIFY_PHONE_TARGET } from "./zaloNotifyService.js";

type GetDb = () => Promise<Db>;
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
  if (account) return { owner: String(account._id), zaloId: account.zaloId && account.zaloVerifiedAt ? String(account.zaloId) : null, account };
  const secret = String(req.cookies?.[COOKIE] || "");
  const session = secret ? await getSiIdentitySession(hash(secret)) : null;
  if (!session) return null;
  if (session.accountId && String(account?._id) !== session.accountId) return null;
  return { owner: session.tokenHash, zaloId: session.zaloId, account };
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
    db.collection(SHOP_ACCOUNTS).createIndex({ zaloId: 1 }, { unique: true, partialFilterExpression: { zaloId: { $type: "string" } } }),
    db.collection(SHOP_ACCOUNTS).createIndex({ phoneNorm: 1 }, { unique: true, partialFilterExpression: { siIdentity: true, phoneNorm: { $type: "string" } } }),
    db.collection(SHOP_ACCOUNTS).createIndex({ kvRetailer: 1, kvCustomerId: 1 }, { unique: true, partialFilterExpression: { kvCustomerId: { $type: "number" }, siIdentity: true } }),
    db.collection(SHOP_ACCOUNTS).createIndex({ roles: 1, siStatus: 1, updatedAt: -1 }),
    db.collection(SHOP_ACCOUNTS).createIndex({ roles: 1, "siVerification.status": 1, siStatus: 1, updatedAt: -1 }),
  ]).catch(error => { indexes = undefined; throw error; });

  app.use(["/api/shop/auth/si", "/api/shop/auth/zalo"], async (req, res, next) => {
    applyShopCors(req, res);
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET" && req.headers.origin && !isAllowedShopOrigin(req.headers.origin)) return res.sendStatus(403);
    if (!(await shopRateLimitOrReject(req, res, "si_onboarding", 30, 60000))) return;
    next();
  });

  app.get("/api/shop/auth/si/session", async (req, res) => {
    try {
      const db = await getDb();
      const who = await identity(req, db);
      res.json({ verified: Boolean(who), user: who?.account ? toPublicShopAccount(who.account) : null,
        zaloConfigured: Boolean(process.env.ZALO_APP_ID && process.env.ZALO_APP_SECRET && process.env.ZALO_REDIRECT_URI),
        minOrder: (await loadPurchasePolicy(db)).tinhMinimum, termsVersion: SI_TERMS_VERSION });
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
      await putSiOauthSession(hash(binding), {
        stateHash: hash(state),
        verifier,
        accountId: account ? String(account._id) : null,
      });
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
      const session = await takeSiOauthSession(hash(binding), hash(state));
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
      await putSiIdentitySession(hash(secret), {
        zaloId,
        accountId: account ? String(account._id) : null,
      });
      res.cookie(COOKIE, secret, cookieOptions());
      if (account) await issueShopSession(res, db, account);
      res.redirect("/dang-ky-si");
    } catch { res.redirect("/dang-ky-si?error=zalo_failed"); }
  });

  app.post("/api/shop/auth/si/lookup", async (req, res) => {
    try {
      const db = await getDb(); await ensure(db);
      const who = await identity(req, db);
      if (!who) return res.status(401).json({ error: "Vui lòng đăng nhập trước khi đăng ký sỉ" });
      const input = addressSchema.parse(req.body);

      // Giữ SĐT đã liên kết với tài khoản, không cho tra cứu số khác.
      if (who.account?.phoneNorm && normalizeWholesalePhone(who.account.phoneNorm) !== input.phone) {
        return res.status(400).json({ error: "Số điện thoại tra cứu phải trùng khớp với số điện thoại đã liên kết của tài khoản này." });
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
      await putSiLookup({
        lookupId,
        owner: who.owner,
        address: canonicalAddress(input),
        phone: input.phone,
        result,
        candidate,
        retailer,
      });
      res.json({ lookupId, result });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/shop/auth/si/register", async (req, res) => {
    try {
      const db = await getDb(); await ensure(db);
      const who = await identity(req, db);
      if (!who) return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại" });
      const input = applicationSchema.parse(req.body);
      const lookup = await getSiLookup(input.lookupId);
      if (
        !lookup ||
        lookup.owner !== who.owner ||
        lookup.phone !== input.phone ||
        lookup.address !== canonicalAddress(input)
      ) {
        return res.status(409).json({ error: "Thông tin đã thay đổi hoặc hết hạn. Vui lòng kiểm tra lại SĐT/địa chỉ." });
      }
      if (lookup.result !== "existing_si_candidate" && (!input.shopName || !input.businessType)) return res.status(400).json({ error: "Vui lòng nhập tên cửa hàng và loại hình kinh doanh" });
      let account = who.account || await currentAccount(req, db);
      if (account && ["active", "cho_duyet", "khoa"].includes(String(account.siStatus))) {
        return res.status(409).json({ error: "Tài khoản đã có hồ sơ sỉ. Vui lòng xem trạng thái hồ sơ." });
      }
      if (account?.phoneNorm && normalizeWholesalePhone(account.phoneNorm) !== input.phone) {
        return res.status(409).json({ error: "Số điện thoại đăng ký phải trùng khớp với số điện thoại đã liên kết của tài khoản này." });
      }

      const owners = await db.collection(SHOP_ACCOUNTS).find(phoneOwnerFilter(input.phone)).limit(5).toArray();
      const ownerIds = owners.map((owner) => String(owner._id));
      if (account && accountOwnsPhone(account, input.phone) && !ownerIds.includes(String(account._id))) {
        ownerIds.push(String(account._id));
      }
      const otherOwner = owners.find((owner) => !account || String(owner._id) !== String(account._id)) || owners[0];
      const decision = decideWholesalePhoneLink({
        sessionAccountId: account ? String(account._id) : null,
        ownerIds,
        maskedEmail: otherOwner ? maskShopEmail(String(otherOwner.email || "")) : null,
      });
      if (decision.action === "login_required") {
        return res.status(409).json({
          error: `Số ${input.phone} đã thuộc tài khoản ${decision.maskedEmail}. Đăng nhập tài khoản đó rồi gửi lại — hồ sơ sẽ gắn vào tài khoản sẵn có.`,
          code: "phone_requires_login",
        });
      }
      if (decision.action === "switch_account") {
        return res.status(409).json({
          error: `Số ${input.phone} thuộc tài khoản ${decision.maskedEmail}, khác tài khoản đang đăng nhập. Đăng xuất và đăng nhập đúng tài khoản đó để tiếp tục.`,
          code: "phone_belongs_to_other",
        });
      }
      if (decision.action === "create") account = null;

      const zaloOwner = who.zaloId ? await db.collection(SHOP_ACCOUNTS).findOne({ zaloId: who.zaloId }) : null;
      if (zaloOwner && (!account || String(zaloOwner._id) !== String(account._id))) {
        return res.status(409).json({
          error: "Zalo này đã gắn với tài khoản khác. Hãy đăng nhập đúng tài khoản đó rồi thử lại.",
          code: "zalo_account_conflict",
        });
      }
      const { password, email, lookupId, acceptedTerms, ...profile } = input;
      const now = new Date().toISOString();
      const regionAssignment = assignWholesaleRegion(input);
      const patch = { ...registrationAddressPatch(account?.addresses, input), fullName: input.fullName, phone: input.phone, phoneNorm: input.phone, siIdentity: true,
        siStatus: "active", siRegion: regionAssignment.region, siRegionAssignment: { ...regionAssignment, assignedAt: now },
        siKvSyncStatus: "awaiting_verification",
        siApplicationSource: "customer", siProfile: { ...profile, acceptedTermsAt: now, termsVersion: SI_TERMS_VERSION },
        siLookupId: lookupId, siLookupResult: lookup.result, siCandidate: lookup.candidate,
        siCandidateRetailer: lookup.retailer, siVerification: { status: "pending" },
        ...(who.zaloId ? { zaloId: who.zaloId, zaloVerifiedAt: now } : {}), updatedAt: now };
      if (!account) {
        if (!email || !password) return res.status(400).json({ error: "Nhập email và mật khẩu để hoàn tất tài khoản" });
        const doc = { ...patch, email, passwordHash: await bcrypt.hash(password, 12), roles: ["customer", "si"],
          active: true, applicationRevision: 1, createdAt: now };
        const inserted = await db.collection(SHOP_ACCOUNTS).insertOne(doc);
        account = await db.collection(SHOP_ACCOUNTS).findOne({ _id: inserted.insertedId });
      } else {
        const result = await db.collection(SHOP_ACCOUNTS).updateOne({ ...addressSnapshotFilter(account),
          siStatus: { $nin: ["active", "cho_duyet", "khoa"] } }, {
          $set: patch, $addToSet: { roles: "si" }, $inc: { applicationRevision: 1 },
        });
        if (!result.modifiedCount) return res.status(409).json({ error: "Hồ sơ vừa thay đổi. Vui lòng tải lại." });
        account = await db.collection(SHOP_ACCOUNTS).findOne({ _id: account._id });
      }
      res.clearCookie(COOKIE, { path: "/" });
      syncBus.publish([SHOP_ACCOUNTS], "si_registered_pending_verification", { ids: [String(account!._id)] });
      // Gửi thông báo tự động vào mục Cloud của tôi trên Zalo số test (0337095980) theo Cách 1
      void zaloNotifyService.sendWholesaleRegistrationNotice({
        fullName: input.fullName,
        phone: input.phone,
        region: regionAssignment.region,
        shopName: input.shopName,
        businessType: input.businessType,
        note: input.note,
      }).catch((err) => {
        console.error("[ZaloNotify] Auto notice error:", err?.message || err);
      });
      res.json(await issueShopSession(res, db, account!));
    } catch (error) { sendError(res, error); }
  });

  const gate = [requireAuth(getOpsDb), requireActive, requireManager];
  app.post("/api/shop/auth/si/address", requireShopAuth(getDb), async (req: ShopAuthRequest, res) => {
    try {
      const db = await getDb();
      const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(req.shopAuth!.userId));
      if (!account) return res.sendStatus(401);
      const addresses = await ensureRegistrationAddress(db.collection(SHOP_ACCOUNTS), account);
      if (!addresses) return res.status(409).json({ error: "Địa chỉ vừa thay đổi. Vui lòng thử lại." });
      res.json({ addresses });
    } catch (error) { sendError(res, error); }
  });
  app.get("/api/shop/admin/si", ...gate, async (req, res) => {
    try {
      const db = await getDb();
      const status = String(req.query.status || "");
      await ensure(db);
      const filter = wholesaleAdminFilter(status);
      const docs = await db.collection(SHOP_ACCOUNTS).find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
      res.json({ items: docs.map(d => ({ ...toPublicShopAccount(d), revision: d.applicationRevision || 0,
        verification: d.siVerification, candidate: d.siCandidate, kvCustomerId: d.kvCustomerId,
        syncStatus: d.siKvSyncStatus, siLookupResult: d.siLookupResult, audit: d.siAudit || [] })) });
    } catch (error) { sendError(res, error); }
  });

  app.get("/api/shop/admin/si/:id", ...gate, async (req, res) => {
    try {
      const db = await getDb();
      const d = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(String(req.params.id)));
      if (!d?.roles?.includes("si")) return res.status(404).json({ error: "Không tìm thấy hồ sơ sỉ" });
      res.json({ ...toPublicShopAccount(d), revision: d.applicationRevision || 0,
        verification: d.siVerification, candidate: d.siCandidate, kvCustomerId: d.kvCustomerId,
        syncStatus: d.siKvSyncStatus, siLookupResult: d.siLookupResult, audit: d.siAudit || [] });
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
        const approvalBasis = wholesaleApprovalBasis(account);
        if (!approvalBasis) return res.status(409).json({ error: "Khách cần đồng ý điều khoản mua sỉ hiện hành trước khi duyệt." });
        patch.siApprovalBasis = { source: approvalBasis, actorAdminId: req.auth!.userId, at: now, reason };
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
        reason, actorAdminId: req.auth!.userId, at: now, ...(to === "active" ? { approvalBasis: patch.siApprovalBasis } : {}) };
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

  // Endpoints kết nối và kiểm tra thông báo Zalo cho số 0337095980
  app.get("/api/shop/zalo-notify/status", (_req, res) => {
    res.json(zaloNotifyService.getStatus());
  });

  app.post("/api/shop/zalo-notify/qr", async (_req, res) => {
    try {
      const qr = await zaloNotifyService.generateQR();
      res.json({ success: true, qr, ...zaloNotifyService.getStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Lỗi tạo mã QR Zalo" });
    }
  });

  app.post("/api/shop/zalo-notify/test-send", async (_req, res) => {
    try {
      const result = await zaloNotifyService.sendWholesaleRegistrationNotice({
        fullName: "Khách Thử Nghiệm",
        phone: "0912345678",
        region: "HCM",
        shopName: "Tiệm Cây Xanh Test",
        businessType: "Đại lý bán lẻ",
        note: "Tin nhắn kiểm tra tính năng thông báo Zalo đến số " + NOTIFY_PHONE_TARGET,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Lỗi gửi tin nhắn" });
    }
  });

  app.get("/zalo-connect", (_req, res) => {
    res.send(renderZaloConnectHtml());
  });
}

function renderZaloConnectHtml() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kết Nối Zalo Thông Báo Sỉ (0337095980) - Aloha</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F1F8EF; }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-900/10 text-center">
    <div class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 mb-3">
      Test Thông Báo Zalo (Số: ${NOTIFY_PHONE_TARGET})
    </div>
    <h1 class="text-2xl font-black text-[#0f3822]">KẾT NỐI ZALO THÔNG BÁO SỈ</h1>
    <p class="text-xs text-slate-500 mt-1">
      Quét mã QR bằng ứng dụng Zalo trên số <strong class="text-emerald-800">${NOTIFY_PHONE_TARGET}</strong> để nhận thông báo tức thì vào nhóm Zalo "Aloha - Thông Báo Sỉ" (gồm số test ${NOTIFY_PHONE_TARGET} và số shop 0794901233).
    </p>

    <div id="statusBadge" class="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
      Đang kiểm tra trạng thái...
    </div>

    <div class="my-5 flex flex-col items-center justify-center min-h-[260px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4">
      <div id="qrLoading" class="text-xs text-slate-400">Bấm nút bên dưới để tạo mã QR</div>
      <img id="qrImage" class="hidden w-56 h-56 object-contain rounded-xl shadow-md border border-slate-200" alt="Zalo QR" />
    </div>

    <div class="space-y-2.5">
      <button id="btnGenerate" onclick="generateQR()" class="w-full rounded-xl bg-[#0068FF] hover:bg-[#0057D9] text-white py-3 px-4 text-sm font-bold shadow-md transition active:scale-95 cursor-pointer">
        Tạo mã QR kết nối Zalo
      </button>

      <button id="btnTestSend" onclick="testSend()" class="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-4 text-xs font-bold shadow transition active:scale-95 cursor-pointer">
        Gửi tin nhắn thử nghiệm vào Nhóm Zalo
      </button>
    </div>

    <div class="mt-5 text-[11px] text-slate-500 text-left bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 leading-relaxed">
      <strong>Hướng dẫn kiểm tra:</strong><br />
      1. Bấm <strong>"Tạo mã QR kết nối Zalo"</strong>.<br />
      2. Mở app Zalo trên điện thoại <strong>${NOTIFY_PHONE_TARGET}</strong> &gt; Chọn Quét mã QR.<br />
      3. Bấm <strong>"Xác nhận đăng nhập"</strong> trên điện thoại.<br />
      4. Bấm <strong>"Gửi tin nhắn thử nghiệm vào Nhóm Zalo"</strong> > Nhóm <strong>"Aloha - Thông Báo Sỉ"</strong> sẽ nhận tin nhắn ngay lập tức!
    </div>
  </div>

  <script>
    async function checkStatus() {
      try {
        const res = await fetch('/api/shop/zalo-notify/status');
        const data = await res.json();
        const badge = document.getElementById('statusBadge');
        const img = document.getElementById('qrImage');
        const loading = document.getElementById('qrLoading');

        if (data.connected) {
          badge.className = 'mt-4 p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-800';
          badge.innerHTML = '✅ ĐÃ KẾT NỐI ZALO (Số: ' + data.targetPhone + ')';
          img.classList.add('hidden');
          loading.classList.remove('hidden');
          loading.innerHTML = '<span class="text-emerald-700 font-bold">Hệ thống đã sẵn sàng gửi thông báo vào nhóm Zalo <strong>Aloha - Thông Báo Sỉ</strong>!</span>';
        } else {
          if (data.status === 'cho_quet' && data.qrImage) {
            badge.className = 'mt-4 p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-xs font-bold text-amber-800 animate-pulse';
            badge.innerText = '📱 Đã có mã QR! Mở Zalo số ' + data.targetPhone + ' quét mã bên dưới';
            img.src = data.qrImage;
            img.classList.remove('hidden');
            loading.classList.add('hidden');
          } else if (data.status === 'da_quet_cho_xac_nhan') {
            badge.className = 'mt-4 p-2.5 rounded-xl bg-blue-100 border border-blue-300 text-xs font-bold text-blue-800 animate-pulse';
            badge.innerText = '⏳ Đã quét mã! Bấm Xác nhận đăng nhập trên điện thoại...';
          } else {
            badge.className = 'mt-4 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600';
            badge.innerText = 'Chưa kết nối. Bấm nút bên dưới để tạo mã QR.';
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function generateQR() {
      const btn = document.getElementById('btnGenerate');
      btn.innerText = 'Đang khởi tạo mã QR...';
      btn.disabled = true;
      try {
        await fetch('/api/shop/zalo-notify/qr', { method: 'POST' });
        setTimeout(checkStatus, 1000);
      } catch (e) {
        alert('Lỗi tạo mã QR: ' + e.message);
      } finally {
        btn.innerText = 'Tạo lại mã QR kết nối Zalo';
        btn.disabled = false;
      }
    }

    async function testSend() {
      const btn = document.getElementById('btnTestSend');
      btn.innerText = 'Đang gửi...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/shop/zalo-notify/test-send', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          alert('✅ Đã gửi thông báo test thành công vào nhóm Zalo "Aloha - Thông Báo Sỉ"! Mở Zalo kiểm tra ting ting nhé.');
        } else {
          alert('⚠️ Chưa thể gửi: ' + (result.reason || result.error || 'Vui lòng quét mã QR trước'));
        }
      } catch (e) {
        alert('Lỗi: ' + e.message);
      } finally {
        btn.innerText = 'Gửi tin nhắn thử nghiệm vào Nhóm Zalo';
        btn.disabled = false;
      }
    }

    setInterval(checkStatus, 3000);
    checkStatus();
  </script>
</body>
</html>`;
}

