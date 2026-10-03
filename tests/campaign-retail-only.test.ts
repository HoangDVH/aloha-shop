import test from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { isRetailAccount, isRetailBuyer, resolveRetailStatus } from "../backend/shopCampaigns/retail.js";

const KH_MOI = { _id: "moi", roles: ["customer"], email: "moi@x.vn" };
const KH_CU = { _id: "cu", roles: ["customer"], email: "cu@x.vn" };
const KH_SI = { _id: "si", roles: ["customer", "si"], siStatus: "active", email: "si@x.vn", phone: "0901111111" };
const KH_SI_CHO = { _id: "sicho", roles: ["si"], siStatus: "cho_duyet", email: "sicho@x.vn" };
const KH_CTV = { _id: "ctv", roles: ["customer", "ctv"], ctvStatus: "active", email: "ctv@x.vn" };
const SI_CTV = { _id: "both", roles: ["si", "ctv"], email: "both@x.vn" };
const LOCKED = { _id: "lock", roles: ["customer"], active: false, email: "lock@x.vn" };

/** DB tối giản chỉ đủ cho tra tài khoản theo SĐT / email. */
function accountsDb(rows: Record<string, any>[]): Db {
  const match = (r: any, f: any) =>
    f.$or.some((c: any) => (c.phone ? c.phone.$in.includes(r.phone) : c.email ? r.email === c.email : false));
  return {
    collection: () => ({
      find: (f: any) => ({ limit: () => ({ toArray: async () => rows.filter((r) => match(r, f)) }) }),
    }),
  } as unknown as Db;
}

test("KL01: isRetailAccount — KHACH, KH_MOI, KH_CU là khách lẻ; SI, SI chờ duyệt, CTV, SI+CTV thì không", () => {
  assert.equal(isRetailAccount(null), true);
  assert.equal(isRetailAccount(KH_MOI), true);
  assert.equal(isRetailAccount(KH_CU), true);
  assert.equal(isRetailAccount(KH_SI), false);
  assert.equal(isRetailAccount(KH_SI_CHO), false);
  assert.equal(isRetailAccount(KH_CTV), false);
  assert.equal(isRetailAccount(SI_CTV), false);
});

test("KL09: không đăng nhập nhưng dùng SĐT của KH_SI (dạng +84) / email của KH_CTV → xử lý như tài khoản đó", async () => {
  const db = accountsDb([KH_SI, KH_CTV, KH_MOI]);
  assert.equal(await isRetailBuyer(db, null, "+84901111111"), false);
  assert.equal(await isRetailBuyer(db, null, undefined, "CTV@x.vn"), false);
  assert.equal(await isRetailBuyer(db, null, "0909999999", "khach@x.vn"), true);
});

test("EX14: tài khoản bị khoá không được hưởng ưu đãi chiến dịch", async () => {
  const db = accountsDb([]);
  const s = await resolveRetailStatus(db, { account: LOCKED });
  assert.equal(s.retail, true);
  assert.equal(s.locked, true);
  assert.equal(await isRetailBuyer(db, LOCKED), false);
});
