import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Db } from "mongodb";
import { registerWholesaleRoutes } from "../backend/shopWholesale/routes.js";
import { signShopAccessToken, ACCESS_COOKIE } from "../backend/shopAuth/tokens.js";
import { putSiLookup } from "../backend/shopWholesale/siEphemeral.js";
import { canonicalAddress } from "../backend/shopWholesale/schema.js";
import { isActiveWholesale } from "../backend/shopWholesale/policy.js";
import { wholesaleAdminFilter } from "../backend/shopWholesale/approvalSource.js";
import { catalogPriceContext, currentPriceMode } from "../backend/shopWholesale/priceContext.js";
import { provisionWholesaleCustomer } from "../backend/shopWholesale/provision.js";

const input = { phone: "0901234567", province: "Hồ Chí Minh", ward: "Bến Thành", detail: "123 Lê Lợi",
  fullName: "Khách Google", shopName: "Cửa hàng", businessType: "Cây cảnh", acceptedTerms: true };

function harness(extra: Record<string, unknown> = {}) {
  const account: Record<string, any> = { _id: "google-customer", email: "google@example.com", googleId: "google-123", roles: ["customer"], active: true, ...extra };
  const writes: Record<string, any>[] = [];
  const db = { collection: () => ({
    createIndex: async () => "index",
    findOne: async () => account,
    find: () => ({ limit: () => ({ toArray: async () => [] }) }),
    updateOne: async (_filter: unknown, update: Record<string, any>) => {
      writes.push(update); Object.assign(account, update.$set); account.roles = ["customer", "si"];
      return { modifiedCount: 1 };
    },
    insertOne: async () => ({ insertedId: "refresh" }),
  }) } as unknown as Db;
  const handlers = new Map<string, any>();
  const app = { use() {}, get(path: string, ...fns: any[]) { handlers.set(path, fns.at(-1)); },
    post(path: string, ...fns: any[]) { handlers.set(path, fns.at(-1)); }, patch() {} };
  registerWholesaleRoutes(app as any, async () => db, async () => { throw new Error("KV unavailable"); });
  async function call(path: string, body = {}, authenticated = true) {
    let status = 200; let data: any;
    const token = signShopAccessToken({ sub: String(account._id), email: account.email, roles: account.roles });
    const req = { cookies: authenticated ? { [ACCESS_COOKIE]: token } : {}, body };
    const res = { status(value: number) { status = value; return this; }, json(value: unknown) { data = value; }, cookie() {}, clearCookie() {} };
    await handlers.get(path)(req, res);
    return { status, data };
  }
  async function priceMode() {
    let mode: string | undefined;
    const token = signShopAccessToken({ sub: String(account._id), email: account.email, roles: account.roles });
    await catalogPriceContext(async () => db)({ cookies: { [ACCESS_COOKIE]: token } } as any,
      { setHeader() {}, vary() {} } as any, () => { mode = currentPriceMode(); });
    return mode;
  }
  return { account, writes, call, priceMode };
}

test("Google customer without Zalo is verified and can submit a wholesale application", async () => {
  const h = harness();
  const session = await h.call("/api/shop/auth/si/session");
  assert.equal(session.data.verified, true);
  const lookup = await h.call("/api/shop/auth/si/lookup", input);
  assert.equal(lookup.status, 200);
  const result = await h.call("/api/shop/auth/si/register", { ...input, lookupId: lookup.data.lookupId });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.siStatus, "active");
  assert.equal(result.data.user.siRegion, "HCM");
  assert.equal(h.account.addresses.length, 1);
  assert.equal(h.account.addresses[0].fullName, input.fullName);
  assert.equal(h.account.addresses[0].detail, input.detail);
  assert.equal(h.account.addresses[0].isDefault, true);
  assert.equal(h.account.siRegistrationAddressId, h.account.addresses[0].id);
  assert.equal(result.data.user.addresses[0].id, h.account.siRegistrationAddressId);
  assert.equal(result.data.user.siVerificationStatus, "pending");
  assert.equal(isActiveWholesale(h.account), true);
  assert.equal(await h.priceMode(), "si");
  assert.equal(h.account.siKvSyncStatus, "awaiting_verification");
  assert.equal(h.account.googleId, "google-123");
  assert.equal(Object.hasOwn(h.writes[0].$set, "zaloId"), false);
  assert.equal(Object.hasOwn(h.writes[0].$set, "zaloVerifiedAt"), false);
});

test("KiotViet provisioning requires an active wholesale account and known region, but allows pending verification", async () => {
  const previous = process.env.SHOP_SI_KV_PROVISION_ENABLED;
  process.env.SHOP_SI_KV_PROVISION_ENABLED = "1";
  let filter: any;
  try {
    const db: any = { collection: () => ({ findOneAndUpdate: async (value: any) => { filter = value; return null; } }) };
    assert.equal((await provisionWholesaleCustomer(db, db, "new-account")).status, "busy_or_synced");
    assert.deepEqual(filter.siRegion, { $in: ["HCM", "TINH"] });
    assert.equal(filter["siVerification.status"], undefined);
    assert.equal(filter.roles, "si");
    assert.deepEqual(filter.active, { $ne: false });
  } finally {
    if (previous === undefined) delete process.env.SHOP_SI_KV_PROVISION_ENABLED;
    else process.env.SHOP_SI_KV_PROVISION_ENABLED = previous;
  }
});

test("registration assigns province addresses outside old HCM to TINH without waiting for verification", async () => {
  const h = harness();
  const address = { ...input, province: "Bình Dương", district: "Thuận An", ward: "Lái Thiêu" };
  const lookup = await h.call("/api/shop/auth/si/lookup", address);
  const result = await h.call("/api/shop/auth/si/register", { ...address, lookupId: lookup.data.lookupId, siRegion: "HCM" });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.siRegion, "TINH");
  assert.equal(result.data.user.siVerificationStatus, "pending");
  assert.equal(h.account.siRegionAssignment.policy, "hcm_pre_merger_v1");
});

test("changed district requires a fresh lookup before region assignment", async () => {
  const h = harness();
  const lookup = await h.call("/api/shop/auth/si/lookup", { ...input, district: "Quận 1" });
  const result = await h.call("/api/shop/auth/si/register", { ...input, district: "Thuận An", lookupId: lookup.data.lookupId });
  assert.equal(result.status, 409);
  assert.equal(h.writes.length, 0);
});

test("active price access awaiting verification remains in the admin review queue", () => {
  assert.deepEqual(wholesaleAdminFilter("cho_duyet"), { roles: "si", $or: [
    { siStatus: "cho_duyet" }, { siStatus: "active", "siVerification.status": "pending" },
  ] });
  assert.deepEqual(wholesaleAdminFilter("active"), { roles: "si", siStatus: "active", "siVerification.status": { $ne: "pending" } });
});

test("incomplete profiles cannot gain wholesale price access", async () => {
  for (const patch of [{ acceptedTerms: false }, { fullName: "" }, { ward: "" }]) {
    const h = harness();
    const lookup = await h.call("/api/shop/auth/si/lookup", input);
    const result = await h.call("/api/shop/auth/si/register", { ...input, lookupId: lookup.data.lookupId, ...patch });
    assert.equal(result.status, 400);
    assert.equal(isActiveWholesale(h.account), false);
    assert.equal(h.writes.length, 0);
  }
});

test("a locked wholesale account cannot reactivate itself by registering again", async () => {
  const h = harness({ roles: ["customer", "si"], siStatus: "khoa" });
  const lookup = await h.call("/api/shop/auth/si/lookup", input);
  const result = await h.call("/api/shop/auth/si/register", { ...input, lookupId: lookup.data.lookupId });
  assert.equal(result.status, 409);
  assert.equal(isActiveWholesale(h.account), false);
  assert.equal(h.writes.length, 0);
});

test("existing email login also continues without Zalo", async () => {
  assert.equal((await harness({ googleId: undefined }).call("/api/shop/auth/si/session")).data.verified, true);
});

test("Google registration does not mark an unverified Zalo link as verified", async () => {
  const h = harness({ zaloId: "unverified-zalo" });
  const lookup = await h.call("/api/shop/auth/si/lookup", input);
  const result = await h.call("/api/shop/auth/si/register", { ...input, lookupId: lookup.data.lookupId });
  assert.equal(result.status, 200);
  assert.equal(h.account.zaloId, "unverified-zalo");
  assert.equal(h.account.zaloVerifiedAt, undefined);
});

test("anonymous, locked and revoked sessions cannot look up or register", async () => {
  for (const [extra, authenticated] of [[{}, false], [{ active: false }, true], [{ authInvalidBefore: Math.floor(Date.now() / 1000) + 60 }, true]] as const) {
    const h = harness(extra);
    assert.equal((await h.call("/api/shop/auth/si/session", {}, authenticated)).data.verified, false);
    for (const path of ["/api/shop/auth/si/lookup", "/api/shop/auth/si/register"]) {
      assert.equal((await h.call(path, input, authenticated)).status, 401);
    }
  }
});

test("lookup from another account cannot be used after Google login", async () => {
  const lookupId = crypto.randomUUID();
  await putSiLookup({ lookupId, owner: "other-customer", address: canonicalAddress(input), phone: input.phone,
    result: "not_found", candidate: null, retailer: null });
  const h = harness();
  assert.equal((await h.call("/api/shop/auth/si/register", { ...input, lookupId })).status, 409);
  assert.equal(h.writes.length, 0);
});
