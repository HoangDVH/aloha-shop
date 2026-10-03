import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PROMOTIONS_COL } from "../backend/shopPromotions/types.js";
import { VOUCHER_WALLET_COL } from "../backend/shopCampaigns/types.js";
import {
  holdWalletVouchers,
  insertWalletEntry,
  releaseWalletForOrder,
  useWalletForOrder,
  walletId,
} from "../backend/shopPromotions/wallet/walletService.js";
import { V30K } from "./helpers/walletFixtures.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

let t: TestDb;
let restoreFetch: () => void = () => undefined;
const envBefore = { ...process.env };

before(async () => {
  if (TEST_MONGO_SKIP) return;
  process.env.SHOP_CAMPAIGN_ENABLED = "1";
  process.env.SHOP_VOUCHER_WALLET_ENABLED = "1";
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("voucher_wallet");
});
after(async () => {
  process.env.SHOP_CAMPAIGN_ENABLED = envBefore.SHOP_CAMPAIGN_ENABLED;
  process.env.SHOP_VOUCHER_WALLET_ENABLED = envBefore.SHOP_VOUCHER_WALLET_ENABLED;
  restoreFetch();
  await t?.close();
});
beforeEach(async () => {
  if (TEST_MONGO_SKIP) return;
  await t.db.collection(PROMOTIONS_COL).deleteMany({});
  await t.db.collection(VOUCHER_WALLET_COL).deleteMany({});
  await t.db.collection(PROMOTIONS_COL).insertOne(V30K() as any);
});

const nowIso = () => new Date().toISOString();
const claimedCount = async () =>
  Number((await t.db.collection(PROMOTIONS_COL).findOne({ id: "V30K" }))?.claimedCount || 0);
const walletCount = () => t.db.collection(VOUCHER_WALLET_COL).countDocuments({ promotionId: "V30K" });

test("WL01/WL02: lưu V30K → 1 bản ghi saved, claimedCount 1; lưu lần 2 không tăng", { skip: TEST_MONGO_SKIP }, async () => {
  const first = await insertWalletEntry(t.db, V30K(), "acc_moi", "vault", nowIso());
  assert.equal(first.ok && !first.already, true);
  const again = await insertWalletEntry(t.db, V30K(), "acc_moi", "vault", nowIso());
  assert.equal(again.ok && again.already, true);
  if (again.ok) assert.equal(again.message, "Bạn đã lưu voucher này.");
  assert.equal(await claimedCount(), 1);
  assert.equal(await walletCount(), 1);
});

test("WL03: 10 tài khoản cùng lưu V30K (3 lượt) → đúng 3 thành công", { skip: TEST_MONGO_SKIP }, async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => insertWalletEntry(t.db, V30K(), `acc_${i}`, "vault", nowIso()))
  );
  assert.equal(results.filter((r) => r.ok).length, 3);
  assert.equal(results.filter((r) => !r.ok && r.code === "claim_limit").length, 7);
  assert.equal(await claimedCount(), 3);
  assert.equal(await walletCount(), 3);
});

test("WL04: 1 tài khoản gửi 20 request cùng lúc → đúng 1 bản ghi, bộ đếm +1", { skip: TEST_MONGO_SKIP }, async () => {
  await Promise.all(Array.from({ length: 20 }, () => insertWalletEntry(t.db, V30K(), "acc_1", "vault", nowIso())));
  assert.equal(await walletCount(), 1);
  assert.equal(await claimedCount(), 1);
});

test("WL05: ghi ví lỗi sau khi đã tăng claimedCount → bước bù trả lại bộ đếm", { skip: TEST_MONGO_SKIP }, async () => {
  const proto = Object.getPrototypeOf(t.db.collection(VOUCHER_WALLET_COL));
  const realInsert = proto.insertOne;
  proto.insertOne = async function () {
    throw new Error("ghi ví lỗi giả");
  };
  try {
    await assert.rejects(insertWalletEntry(t.db, V30K(), "acc_1", "vault", nowIso()));
  } finally {
    proto.insertOne = realInsert;
  }
  assert.equal(await claimedCount(), 0);
  assert.equal(await walletCount(), 0);
});

test("WL10–WL12: tạo đơn → held; thanh toán → used; huỷ → saved", { skip: TEST_MONGO_SKIP }, async () => {
  await insertWalletEntry(t.db, V30K(), "acc_1", "vault", nowIso());
  const id = walletId("V30K", "acc_1");
  assert.equal(await holdWalletVouchers(t.db, { accountId: "acc_1", orderCode: "DH1", promotionIds: ["V30K"] }), true);
  assert.equal((await t.db.collection(VOUCHER_WALLET_COL).findOne({ _id: id as any }))?.status, "held");
  assert.equal(
    await holdWalletVouchers(t.db, { accountId: "acc_1", orderCode: "DH2", promotionIds: ["V30K"] }),
    false,
    "voucher đang giữ cho đơn 1 không dùng được cho đơn 2"
  );
  assert.equal(await releaseWalletForOrder(t.db, "DH1"), 1);
  assert.equal((await t.db.collection(VOUCHER_WALLET_COL).findOne({ _id: id as any }))?.status, "saved");
  await holdWalletVouchers(t.db, { accountId: "acc_1", orderCode: "DH3", promotionIds: ["V30K"] });
  assert.equal(await useWalletForOrder(t.db, "DH3"), 1);
  assert.equal((await t.db.collection(VOUCHER_WALLET_COL).findOne({ _id: id as any }))?.status, "used");
});

test("WL13: huỷ khi voucher đã hết hạn → ví về expired, không về saved", { skip: TEST_MONGO_SKIP }, async () => {
  await insertWalletEntry(t.db, V30K(), "acc_1", "vault", nowIso());
  await holdWalletVouchers(t.db, { accountId: "acc_1", orderCode: "DH1", promotionIds: ["V30K"] });
  await t.db.collection(PROMOTIONS_COL).updateOne({ id: "V30K" }, { $set: { endDate: "2020-01-01T00:00:00.000Z" } });
  await releaseWalletForOrder(t.db, "DH1");
  const row = await t.db.collection(VOUCHER_WALLET_COL).findOne({ _id: walletId("V30K", "acc_1") as any });
  assert.equal(row?.status, "expired");
});

test("WL14: worker và khách cùng huỷ → ví trả về đúng 1 lần", { skip: TEST_MONGO_SKIP }, async () => {
  await insertWalletEntry(t.db, V30K(), "acc_1", "vault", nowIso());
  await holdWalletVouchers(t.db, { accountId: "acc_1", orderCode: "DH1", promotionIds: ["V30K"] });
  const changed = await Promise.all([releaseWalletForOrder(t.db, "DH1"), releaseWalletForOrder(t.db, "DH1")]);
  assert.equal(changed[0] + changed[1], 1);
});
