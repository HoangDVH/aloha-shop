import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PROMOTIONS_COL, type PromotionDoc } from "../backend/shopPromotions/types.js";
import { VOUCHER_WALLET_COL } from "../backend/shopCampaigns/types.js";
import {
  applyDrawnPercents,
  drawMysteryPercent,
  parseMysteryConfig,
  pickTier,
  publicMystery,
  type MysteryConfig,
} from "../backend/shopPromotions/mystery.js";
import { evaluatePromotions } from "../backend/shopPromotions/evaluator.js";
import { buildNewPromotion, buildPromotionUpdate } from "../backend/shopPromotions/admin/promotionPayload.js";
import { drawnPercentsFor, insertWalletEntry } from "../backend/shopPromotions/wallet/walletService.js";
import { promo } from "./helpers/walletFixtures.js";
import { TEST_MONGO_SKIP, blockOutboundFetch, openTestDb, type TestDb } from "./helpers/testMongo.js";

const WEIGHTED6 = [
  { percent: 10, weight: 50 },
  { percent: 11, weight: 20 },
  { percent: 12, weight: 15 },
  { percent: 13, weight: 8 },
  { percent: 14, weight: 5 },
  { percent: 15, weight: 2 },
];

function config(tiers: { percent: number; weight: number; limit?: number }[]): MysteryConfig {
  const r = parseMysteryConfig({ tiers });
  if (r.error || !r.value) throw new Error(r.error || "không có cấu hình");
  return r.value;
}

const MYSTERY = (over: Partial<PromotionDoc> = {}) =>
  promo("VMU", {
    claimRequired: true,
    claimedCount: 0,
    discountType: "percentage",
    discountValue: 10,
    maxDiscountVnd: 200_000,
    minOrderThreshold: 0,
    mystery: config(WEIGHTED6),
    ...over,
  });

test("MU01: đọc cấu hình — sắp theo %, chặn trùng, thiếu mức, % sai, tỉ lệ 0", () => {
  const ok = parseMysteryConfig({ tiers: [{ percent: 15, weight: 2 }, { percent: 10, weight: 50, limit: 5 }] });
  assert.deepEqual(
    ok.value?.tiers.map((t) => [t.percent, t.limit, t.remaining]),
    [
      [10, 5, 5],
      [15, null, 0],
    ]
  );
  assert.equal(parseMysteryConfig(undefined).value, undefined);
  assert.equal(parseMysteryConfig(null).value, null);
  assert.match(parseMysteryConfig({ tiers: [{ percent: 10, weight: 1 }] }).error || "", /ít nhất 2/);
  assert.match(parseMysteryConfig({ tiers: [{ percent: 10, weight: 1 }, { percent: 10, weight: 1 }] }).error || "", /trùng/);
  assert.match(parseMysteryConfig({ tiers: [{ percent: 0, weight: 1 }, { percent: 10, weight: 1 }] }).error || "", /1 đến 100/);
  assert.match(parseMysteryConfig({ tiers: [{ percent: 9, weight: 0 }, { percent: 10, weight: 1 }] }).error || "", /lớn hơn 0/);
});

test("MU02: bốc theo trọng số — biên dưới/trên của từng mức đúng tỉ lệ 50/20/15/8/5/2", () => {
  const tiers = config(WEIGHTED6).tiers;
  const total = 100_000;
  const at = (r: number) => pickTier(tiers, () => r)?.percent;
  assert.equal(at(0), 10);
  assert.equal(at(49_999), 10);
  assert.equal(at(50_000), 11);
  assert.equal(at(69_999), 11);
  assert.equal(at(70_000), 12);
  assert.equal(at(85_000), 13);
  assert.equal(at(93_000), 14);
  assert.equal(at(98_000), 15);
  assert.equal(at(total - 1), 15);
});

test("MU03: phân phối thực tế với crypto.randomInt sát tỉ lệ công bố", () => {
  const tiers = config(WEIGHTED6).tiers;
  const counts = new Map<number, number>();
  const n = 40_000;
  for (let i = 0; i < n; i++) {
    const p = pickTier(tiers)!.percent;
    counts.set(p, (counts.get(p) || 0) + 1);
  }
  for (const t of WEIGHTED6) {
    const share = ((counts.get(t.percent) || 0) / n) * 100;
    assert.ok(Math.abs(share - t.weight) < 1.5, `${t.percent}%: ${share.toFixed(2)}% lệch quá xa ${t.weight}%`);
  }
});

test("MU04: mức hết suất không còn được bốc; hết sạch suất trả null", () => {
  const tiers = config([
    { percent: 10, weight: 50, limit: 1 },
    { percent: 15, weight: 50, limit: 1 },
  ]).tiers;
  tiers[0].remaining = 0;
  for (let r = 0; r < 100; r += 7) assert.equal(pickTier(tiers, (n) => r % n)?.percent, 15);
  tiers[1].remaining = 0;
  assert.equal(pickTier(tiers), null);
});

test("MU05: thông tin công khai có tỉ lệ làm tròn, không lộ số suất còn lại", () => {
  const pub = publicMystery(MYSTERY())!;
  assert.equal(pub.min, 10);
  assert.equal(pub.max, 15);
  assert.deepEqual(
    pub.tiers.map((t) => t.chance),
    [50, 20, 15, 8, 5, 2]
  );
  assert.equal("remaining" in (pub.tiers[0] as object), false);
  assert.equal(publicMystery(promo("THUONG")), undefined);
});

test("MU06: báo giá dùng % khách đã bóc, trần 200K vẫn áp", () => {
  const [mine] = applyDrawnPercents([MYSTERY()], new Map([["VMU", 13]]));
  assert.equal(mine.discountValue, 13);
  const q = evaluatePromotions({
    items: [{ ma: "SP1", price: 1_000_000, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [mine],
  });
  assert.equal(q.discountTotal, 130_000);
  assert.equal(q.candidates[0].mystery?.drawnPercent, 13);
  const big = evaluatePromotions({
    items: [{ ma: "SP1", price: 3_000_000, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [mine],
  });
  assert.equal(big.discountTotal, 200_000);
});

test("MU07: khách chưa bóc / voucher thường không bị đổi giá trị", () => {
  const [unopened, plain] = applyDrawnPercents([MYSTERY(), promo("THUONG")], new Map([["THUONG", 15]]));
  assert.equal(unopened.discountValue, 10);
  assert.equal(unopened.drawnPercent, undefined);
  assert.equal(plain.discountValue, 30_000);
});

test("MU08: tạo voucher túi mù — ép giảm %, mệnh giá = mức thấp nhất, bắt buộc lưu và trần VND", () => {
  const now = "2026-10-01T00:00:00.000Z";
  const r = buildNewPromotion(
    { name: "Túi mù", discountType: "fixed", discountValue: 50_000, maxDiscountVnd: 200_000, mystery: { tiers: WEIGHTED6 } },
    "admin",
    now
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.discountType, "percentage");
  assert.equal(r.value.discountValue, 10);
  assert.equal(r.value.claimRequired, true);
  assert.equal(r.value.mystery?.tiers.length, 6);

  const noCap = buildNewPromotion({ name: "x", discountValue: 10, mystery: { tiers: WEIGHTED6 } }, "admin", now);
  assert.equal(noCap.ok, false);
  const ship = buildNewPromotion(
    { name: "x", benefitType: "shipping", discountValue: 10, maxDiscountVnd: 1, mystery: { tiers: WEIGHTED6 } },
    "admin",
    now
  );
  assert.equal(ship.ok, false);
});

test("MU09: đã có khách bóc → khoá bảng mức; gửi lại y bảng cũ không reset suất đã bốc", () => {
  const now = "2026-10-01T00:00:00.000Z";
  const existing = MYSTERY({ claimedCount: 3 });
  existing.mystery!.tiers[0].drawn = 3;
  const same = buildPromotionUpdate({ mystery: { tiers: WEIGHTED6 }, title: "Đổi tên" }, existing, "admin", now);
  assert.equal(same.ok, true);
  if (same.ok) assert.equal("mystery" in same.value, false, "bảng không đổi thì không ghi đè (giữ drawn)");

  const changed = buildPromotionUpdate(
    { mystery: { tiers: WEIGHTED6.map((t) => (t.percent === 15 ? { ...t, weight: 10 } : t)) } },
    existing,
    "admin",
    now
  );
  assert.equal(changed.ok, false);
  const off = buildPromotionUpdate({ mystery: null }, existing, "admin", now);
  assert.equal(off.ok, false);

  const fresh = buildPromotionUpdate({ mystery: { tiers: WEIGHTED6.slice(0, 3) } }, MYSTERY(), "admin", now);
  assert.equal(fresh.ok, true);
  if (fresh.ok) assert.equal(fresh.value.discountValue, 10);
});

// ── Tích hợp Mongo (cần TEST_MONGO_URI, DB aloha_shop_test_*) ──

let t: TestDb;
let restoreFetch: () => void = () => undefined;
const envBefore = { ...process.env };

before(async () => {
  if (TEST_MONGO_SKIP) return;
  process.env.SHOP_VOUCHER_WALLET_ENABLED = "1";
  restoreFetch = blockOutboundFetch();
  t = await openTestDb("voucher_mystery");
});
after(async () => {
  process.env.SHOP_VOUCHER_WALLET_ENABLED = envBefore.SHOP_VOUCHER_WALLET_ENABLED;
  restoreFetch();
  await t?.close();
});
beforeEach(async () => {
  if (TEST_MONGO_SKIP) return;
  await t.db.collection(PROMOTIONS_COL).deleteMany({});
  await t.db.collection(VOUCHER_WALLET_COL).deleteMany({});
});

const nowIso = () => new Date().toISOString();
const tiersInDb = async () =>
  ((await t.db.collection<PromotionDoc>(PROMOTIONS_COL).findOne({ id: "VMU" }))?.mystery?.tiers || []).map((x) => ({
    percent: x.percent,
    remaining: x.remaining,
    drawn: x.drawn,
  }));

test("MU10: lưu ví → bốc 1 mức, lưu % vào ví; lưu lại trả đúng % cũ, không bốc lại", { skip: TEST_MONGO_SKIP }, async () => {
  await t.db.collection(PROMOTIONS_COL).insertOne(MYSTERY() as any);
  const first = await insertWalletEntry(t.db, MYSTERY(), "acc_1", "vault", nowIso());
  assert.equal(first.ok && !first.already, true);
  const pct = first.ok ? first.drawnPercent : undefined;
  assert.ok(pct && pct >= 10 && pct <= 15);
  const again = await insertWalletEntry(t.db, MYSTERY(), "acc_1", "vault", nowIso());
  assert.equal(again.ok && again.already, true);
  assert.equal(again.ok ? again.drawnPercent : undefined, pct);
  assert.equal((await drawnPercentsFor(t.db, "acc_1")).get("VMU"), pct);
  const drawnTotal = (await tiersInDb()).reduce((s, x) => s + x.drawn, 0);
  assert.equal(drawnTotal, 1);
});

test("MU11: 30 khách tranh 2 mức giới hạn (1+1 suất) → đúng 2 người trúng, còn lại hết lượt", { skip: TEST_MONGO_SKIP }, async () => {
  const doc = MYSTERY({ mystery: config([{ percent: 10, weight: 1, limit: 1 }, { percent: 15, weight: 1, limit: 1 }]) });
  await t.db.collection(PROMOTIONS_COL).insertOne(doc as any);
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, i) => insertWalletEntry(t.db, doc, `acc_${i}`, "vault", nowIso()))
  );
  const winners = results.filter((r) => r.ok);
  assert.equal(winners.length, 2);
  assert.deepEqual(winners.map((r) => (r.ok ? r.drawnPercent : 0)).sort(), [10, 15]);
  assert.equal(results.filter((r) => !r.ok && r.code === "claim_limit").length, 28);
  assert.deepEqual(
    (await tiersInDb()).map((x) => x.remaining),
    [0, 0]
  );
  assert.equal(Number((await t.db.collection(PROMOTIONS_COL).findOne({ id: "VMU" }))?.claimedCount), 2);
});

test("MU12: mức được chọn vừa hết suất → tự rơi sang mức còn suất", { skip: TEST_MONGO_SKIP }, async () => {
  const doc = MYSTERY({ mystery: config([{ percent: 10, weight: 99, limit: 1 }, { percent: 12, weight: 1 }]) });
  await t.db.collection(PROMOTIONS_COL).insertOne({ ...doc, mystery: { tiers: [{ ...doc.mystery!.tiers[0], remaining: 0 }, doc.mystery!.tiers[1]] } } as any);
  assert.equal(await drawMysteryPercent(t.db, doc, () => 0), 12);
});

test("MU13: ghi ví lỗi sau khi đã bốc → trả lại suất của mức và lượt lưu", { skip: TEST_MONGO_SKIP }, async () => {
  const doc = MYSTERY({ mystery: config([{ percent: 10, weight: 1, limit: 5 }, { percent: 15, weight: 1, limit: 5 }]) });
  await t.db.collection(PROMOTIONS_COL).insertOne(doc as any);
  const proto = Object.getPrototypeOf(t.db.collection(VOUCHER_WALLET_COL));
  const realInsert = proto.insertOne;
  proto.insertOne = async function () {
    throw new Error("ghi ví lỗi giả");
  };
  try {
    await assert.rejects(insertWalletEntry(t.db, doc, "acc_1", "vault", nowIso()));
  } finally {
    proto.insertOne = realInsert;
  }
  assert.deepEqual(
    (await tiersInDb()).map((x) => [x.remaining, x.drawn]),
    [
      [5, 0],
      [5, 0],
    ]
  );
  assert.equal(Number((await t.db.collection(PROMOTIONS_COL).findOne({ id: "VMU" }))?.claimedCount || 0), 0);
});
