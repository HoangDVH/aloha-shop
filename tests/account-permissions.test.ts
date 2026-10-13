import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Db } from "mongodb";
import { registerAccountPermissionRoutes, permissionsInput, updateAccountPermissions } from "../backend/shopAuth/accountPermissions.js";
import { openTestDb, TEST_MONGO_SKIP, blockOutboundFetch } from "./helpers/testMongo.js";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";
import { signAccessToken } from "../backend/auth/tokens.js";
import { isActiveWholesale, SI_TERMS_VERSION } from "../backend/shopWholesale/policy.js";

const input = (doc: Record<string, any>, changes: Record<string, any> = {}) => permissionsInput.parse({
  customerType: doc.roles.includes("si") ? "wholesale" : "retail", ctv: doc.roles.includes("ctv"), reason: "Admin xác nhận quyền",
  expected: { roles: doc.roles, siStatus: doc.siStatus ?? null, ctvStatus: doc.ctvStatus ?? null, revision: doc.permissionsRevision || 0 }, ...changes,
});
test("permissions schema rejects staff roles, injected fields and invalid CTV codes", () => {
  const valid = input({ roles: ["customer"] });
  assert.equal(permissionsInput.safeParse({ ...valid, roles: ["admin"] }).success, false);
  assert.equal(permissionsInput.safeParse({ ...valid, reason: "" }).success, false);
  for (const code of ["a", "abc!", "x".repeat(21)]) assert.equal(permissionsInput.safeParse({ ...valid, ctvCode: code }).success, false);
  assert.equal(permissionsInput.safeParse({ ...valid, expected: { ...valid.expected, roles: ["admin"] } }).success, false);
});
test("only active managers can change account permissions", async () => {
  let actor = { username: "employee", role: "staff", active: true }, calls = 0;
  const auth = { collection: () => ({ findOne: async () => actor }) } as unknown as Db;
  const app = express(); app.use(express.json());
  registerAccountPermissionRoutes(app, async () => auth, async () => { calls++; throw new Error("no DB expected"); });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/shop/admin/accounts/A/permissions`;
  const token = signAccessToken({ sub: "permission-admin", username: "employee", role: "staff" });
  try {
    const request = (headers = {}) => fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: "{}" });
    assert.equal((await request()).status, 401);
    assert.equal((await request({ Authorization: `Bearer ${token}` })).status, 403);
    actor = { username: "manager", role: "manager", active: false };
    assert.equal((await request({ Authorization: `Bearer ${token}` })).status, 403);
    actor.active = true; assert.equal((await request({ Authorization: `Bearer ${token}` })).status, 400);
    assert.equal(calls, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test("Mongo: assign/revoke existing account roles, preserve history, consent gate, conflicts and audit", { skip: TEST_MONGO_SKIP }, async () => {
  const fixture = await openTestDb("account_permissions"), restore = blockOutboundFetch(), col = fixture.db.collection(SHOP_ACCOUNTS);
  try {
    await col.insertOne({ _id: "A" as any, email: "test@example.invalid", roles: ["customer"], fullName: "Test", phone: "0901234567",
      active: true, passwordHash: "unchanged", ctvBalanceDebt: 10000, lastLoginAt: "2026-10-12" });
    let account = (await col.findOne({ _id: "A" as any }))!;
    const grant = input(account, { ctv: true, ctvCode: "SHOPCTV" });
    assert.equal((await updateAccountPermissions(fixture.db, "A", grant, "admin-1")).status, 200);
    assert.equal((await updateAccountPermissions(fixture.db, "A", grant, "admin-2")).status, 409);
    account = (await col.findOne({ _id: "A" as any }))!;
    assert.deepEqual(account.roles, ["customer", "ctv"]); assert.equal(account.ctvStatus, "active");
    assert.equal(account.ctvCode, "SHOPCTV"); assert.equal(account.passwordHash, "unchanged");
    assert.equal(account.permissionsAudit[0].actorAdminId, "admin-1");
    await col.insertOne({ _id: "B" as any, email: "b@example.invalid", roles: ["customer"], active: true });
    const other = (await col.findOne({ _id: "B" as any }))!;
    assert.equal((await updateAccountPermissions(fixture.db, "B", input(other, { ctv: true, ctvCode: "SHOPCTV" }), "admin")).status, 409);
    assert.equal((await col.findOne({ _id: "B" as any }))!.permissionsRevision, undefined);
    assert.equal((await updateAccountPermissions(fixture.db, "A", input(account, { ctv: false }), "admin")).status, 200);
    account = (await col.findOne({ _id: "A" as any }))!;
    assert.equal(account.ctvStatus, "khoa"); assert.equal(account.ctvCode, "SHOPCTV"); assert.equal(account.ctvBalanceDebt, 10000);
    assert.equal((await updateAccountPermissions(fixture.db, "A", input(account, { ctv: true, ctvCode: "DIFFERENT" }), "admin")).status, 400);
    assert.equal((await updateAccountPermissions(fixture.db, "A", input(account, { customerType: "wholesale", ctv: true }), "admin")).status, 200);
    account = (await col.findOne({ _id: "A" as any }))!;
    assert.deepEqual(account.roles, ["customer", "si", "ctv"]); assert.equal(account.siStatus, "cho_duyet");
    assert.equal(account.siApplicationSource, "admin");
    assert.equal(isActiveWholesale(account), false); assert.equal(account.siProfile?.acceptedTermsAt, undefined);
    assert.equal(account.ctvStatus, "active"); assert.equal(account.ctvCode, "SHOPCTV");
    assert.equal((await updateAccountPermissions(fixture.db, "B", input(other, { customerType: "wholesale" }), "admin")).status, 400);
    // Revoke wholesale without changing CTV or its finances.
    await updateAccountPermissions(fixture.db, "A", input(account, { customerType: "retail" }), "admin");
    account = (await col.findOne({ _id: "A" as any }))!;
    assert.deepEqual(account.roles, ["customer", "ctv"]); assert.equal(account.siStatus, "khoa"); assert.equal(account.ctvStatus, "active");
    await col.updateOne({ _id: account._id }, { $set: { siProfile: { acceptedTermsAt: "2026-10-12", termsVersion: SI_TERMS_VERSION }, active: false } });
    account = (await col.findOne({ _id: "A" as any }))!;
    await updateAccountPermissions(fixture.db, "A", input(account, { customerType: "wholesale" }), "admin");
    account = (await col.findOne({ _id: "A" as any }))!;
    assert.equal(account.siStatus, "cho_duyet"); assert.equal(account.active, false); assert.equal(isActiveWholesale(account), false);
    // Changing customer type must not silently approve an existing CTV application.
    await col.updateOne({ _id: account._id }, { $set: { ctvStatus: "cho_duyet" } });
    account = (await col.findOne({ _id: "A" as any }))!;
    await updateAccountPermissions(fixture.db, "A", input(account, { customerType: "retail" }), "admin");
    account = (await col.findOne({ _id: "A" as any }))!; assert.equal(account.ctvStatus, "cho_duyet");
    await updateAccountPermissions(fixture.db, "A", input(account, { activateCtv: true }), "admin");
    assert.equal((await col.findOne({ _id: "A" as any }))!.ctvStatus, "active");
    assert.equal((await updateAccountPermissions(fixture.db, "missing", input(other), "admin")).status, 404);
    const latest = (await col.findOne({ _id: "A" as any }))!;
    const simultaneous = await Promise.all([
      updateAccountPermissions(fixture.db, "A", input(latest, { ctv: false }), "admin-1"),
      updateAccountPermissions(fixture.db, "A", input(latest, { ctv: false }), "admin-2"),
    ]);
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 409]);
    await col.insertOne({ _id: "legacy" as any, email: "legacy@example.invalid", active: true });
    assert.equal((await updateAccountPermissions(fixture.db, "legacy", input({ roles: ["customer"] }, { ctv: true }), "admin")).status, 200);
    assert.deepEqual((await col.findOne({ _id: "legacy" as any }))!.roles, ["customer", "ctv"]);
  } finally { restore(); await fixture.close(); }
});
