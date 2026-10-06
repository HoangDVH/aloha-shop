import test from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { shopSessionRenewal } from "../backend/shopAuth/routes.js";
import { SHOP_ACCOUNTS, SHOP_REFRESH } from "../backend/shopAuth/models.js";
import { REFRESH_GRACE_MS, classifyRefreshRow } from "../backend/shopAuth/refreshTokens.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  hashShopToken,
  signShopAccessToken,
  signShopRefreshToken,
  verifyShopAccessToken,
} from "../backend/shopAuth/tokens.js";

const USER_ID = "user-renew-1";

type FakeState = {
  revoked?: boolean;
  active?: boolean;
  authInvalidBefore?: number;
  hash: string;
  row?: Record<string, unknown>;
  updates?: unknown[];
};

function fakeDb(state: FakeState) {
  return {
    collection(name: string) {
      return {
        async updateMany(filter: unknown, update: unknown) {
          state.updates?.push({ name, filter, update });
          return { modifiedCount: 1 };
        },
        async findOne() {
          if (name === SHOP_REFRESH) return state.row ?? { revokedAt: state.revoked ? new Date() : null, tokenHash: state.hash };
          if (name === SHOP_ACCOUNTS) {
            return { _id: USER_ID, email: "khach@example.com", roles: ["ctv"], active: state.active ?? true, authInvalidBefore: state.authInvalidBefore ?? 0 };
          }
          return null;
        },
      };
    },
  } as unknown as Db;
}

async function run(db: Db, cookies: Record<string, string>, path = "/api/shop/cart") {
  const req = { path, cookies: { ...cookies }, headers: {} } as any;
  const set: Record<string, string> = {};
  const cleared: string[] = [];
  const res = {
    cookie: (name: string, value: string) => { set[name] = value; },
    clearCookie: (name: string) => { cleared.push(name); },
  } as any;
  let nextCalled = false;
  await shopSessionRenewal(async () => db)(req, res, () => { nextCalled = true; });
  assert.ok(nextCalled, "luôn cho request đi tiếp");
  return { req, set, cleared };
}

test("SR1: access hết hạn + refresh còn hiệu lực → cấp lại access cho chính request đó, không đổi refresh", async () => {
  const refresh = signShopRefreshToken({ sub: USER_ID, email: "khach@example.com", roles: ["ctv"], jti: "j1" });
  const { req, set } = await run(fakeDb({ hash: hashShopToken(refresh) }), { [REFRESH_COOKIE]: refresh });
  assert.ok(set[ACCESS_COOKIE], "trả cookie access mới");
  assert.equal(set[REFRESH_COOKIE], undefined, "không xoay refresh");
  assert.equal(req.cookies[ACCESS_COOKIE], set[ACCESS_COOKIE], "route phía sau đọc được access mới");
  const payload = verifyShopAccessToken(set[ACCESS_COOKIE]);
  assert.deepEqual([payload.sub, payload.roles], [USER_ID, ["ctv"]]);
});

test("SR2: refresh bị thu hồi, tài khoản khoá hoặc phiên bị huỷ → không cấp access", async () => {
  const refresh = signShopRefreshToken({ sub: USER_ID, email: "khach@example.com", roles: ["customer"], jti: "j2" });
  const hash = hashShopToken(refresh);
  for (const state of [{ hash, revoked: true }, { hash, active: false }, { hash, authInvalidBefore: Math.floor(Date.now() / 1000) + 60 }, { hash: "khac" }]) {
    const { req, set } = await run(fakeDb(state), { [REFRESH_COOKIE]: refresh });
    assert.equal(set[ACCESS_COOKIE], undefined, JSON.stringify(state));
    assert.equal(req.cookies[ACCESS_COOKIE], undefined);
  }
  const { set } = await run(fakeDb({ hash }), { [REFRESH_COOKIE]: "rac" });
  assert.equal(set[ACCESS_COOKIE], undefined, "refresh hỏng");
});

test("SR3: access còn hạn, route đăng xuất/refresh → không đụng tới", async () => {
  const refresh = signShopRefreshToken({ sub: USER_ID, email: "khach@example.com", roles: ["customer"], jti: "j3" });
  const db = fakeDb({ hash: hashShopToken(refresh) });
  const access = signShopAccessToken({ sub: USER_ID, email: "khach@example.com", roles: ["customer"] });
  assert.deepEqual((await run(db, { [REFRESH_COOKIE]: refresh, [ACCESS_COOKIE]: access })).set, {});
  assert.deepEqual((await run(db, { [REFRESH_COOKIE]: refresh }, "/api/shop/auth/logout")).set, {});
  assert.deepEqual((await run(db, { [REFRESH_COOKIE]: refresh }, "/api/shop/auth/refresh")).set, {});
});

test("SR4: phân loại refresh token — còn dùng, vừa xoay (grace), dùng lại, đã đăng xuất", () => {
  const token = "tok";
  const tokenHash = hashShopToken(token);
  const now = Date.now();
  const rotatedAgo = (ms: number) => ({ jti: "j", familyId: "fam", tokenHash, revokedAt: new Date(now - ms), revokedReason: "rotated" });
  assert.equal(classifyRefreshRow({ jti: "j", tokenHash, revokedAt: null }, token, now).kind, "ok");
  assert.equal(classifyRefreshRow(rotatedAgo(5_000), token, now).kind, "grace");
  assert.equal(classifyRefreshRow(rotatedAgo(REFRESH_GRACE_MS), token, now).kind, "grace");
  assert.deepEqual(classifyRefreshRow(rotatedAgo(REFRESH_GRACE_MS + 1), token, now), { kind: "reuse", familyId: "fam" });
  assert.equal(classifyRefreshRow({ ...rotatedAgo(5_000), revokedReason: "logout" }, token, now).kind, "invalid", "token đã đăng xuất không phải dùng lại");
  assert.equal(classifyRefreshRow({ ...rotatedAgo(5_000), revokedReason: "reuse" }, token, now).kind, "invalid", "chuỗi đã bị thu hồi");
  assert.equal(classifyRefreshRow({ ...rotatedAgo(5_000), revokedReason: undefined }, token, now).kind, "invalid", "thu hồi khi đổi mật khẩu");
  assert.equal(classifyRefreshRow({ jti: "j", tokenHash: "khac", revokedAt: null }, token, now).kind, "invalid");
  assert.equal(classifyRefreshRow(null, token, now).kind, "invalid");
  const legacy = { jti: "cu", tokenHash, revokedAt: new Date(now - REFRESH_GRACE_MS * 2), revokedReason: "rotated" };
  assert.deepEqual(classifyRefreshRow(legacy, token, now), { kind: "reuse", familyId: "cu" }, "token cũ chưa có familyId");
});

test("SR5: middleware — grace vẫn gia hạn; dùng lại thì thu hồi cả chuỗi và xoá cookie", async () => {
  const refresh = signShopRefreshToken({ sub: USER_ID, email: "khach@example.com", roles: ["customer"], jti: "j5" });
  const tokenHash = hashShopToken(refresh);
  const rotated = (ms: number) => ({ jti: "j5", familyId: "fam5", userId: USER_ID, tokenHash, revokedAt: new Date(Date.now() - ms), revokedReason: "rotated" });

  const grace = await run(fakeDb({ hash: tokenHash, row: rotated(1_000) }), { [REFRESH_COOKIE]: refresh });
  assert.ok(grace.set[ACCESS_COOKIE], "tab thứ 2 vẫn được gia hạn");
  assert.deepEqual(grace.cleared, []);

  const updates: any[] = [];
  const reuse = await run(fakeDb({ hash: tokenHash, row: rotated(REFRESH_GRACE_MS + 5_000), updates }), { [REFRESH_COOKIE]: refresh });
  assert.equal(reuse.set[ACCESS_COOKIE], undefined);
  assert.equal(reuse.req.cookies[ACCESS_COOKIE], undefined);
  assert.deepEqual(reuse.cleared.sort(), [ACCESS_COOKIE, REFRESH_COOKIE].sort());
  assert.equal(updates.length, 1);
  assert.equal(updates[0].name, SHOP_REFRESH);
  assert.deepEqual(updates[0].filter, { $or: [{ familyId: "fam5" }, { jti: "fam5" }] });
  assert.equal(updates[0].update.$set.revokedReason, "reuse");
});
