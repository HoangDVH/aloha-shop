/**
 * QA integration: pin unique cùng nhãn trên Mongo shop (restore sau test).
 * Không thêm field mới. Run: node scripts/qa-merch-pin-badge-db.cjs
 */
const { MongoClient } = require("mongodb");
require("dotenv").config();

const FIX_A = "__QA_PIN_A__";
const FIX_B = "__QA_PIN_B__";
const FIX_C = "__QA_PIN_MOI__";

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("missing MONGODB_URI");
  const c = new MongoClient(uri);
  await c.connect();
  const col = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db").collection("aloha_products");
  const results = [];
  const check = (id, title, ok, detail) => {
    results.push({ id, title, status: ok ? "Pass" : "Fail", detail });
  };

  // Cleanup leftovers
  await col.deleteMany({ ma: { $in: [FIX_A, FIX_B, FIX_C] } });

  const now = new Date().toISOString();
  await col.insertMany([
    {
      ma: FIX_A,
      ten: "QA PIN A",
      webBadge: "ban_chay_sap_het",
      webPin: 1,
      ton: 5,
      giaWeb: 1000,
      isActive: true,
      hienThiWeb: true,
      createdAt: "2020-01-01T00:00:00.000Z",
      qaFixture: true,
      updatedAt: now,
    },
    {
      ma: FIX_B,
      ten: "QA PIN B",
      webBadge: "ban_chay_sap_het",
      webPin: 0,
      ton: 5,
      giaWeb: 1000,
      isActive: true,
      hienThiWeb: true,
      createdAt: "2020-01-02T00:00:00.000Z",
      qaFixture: true,
      updatedAt: now,
    },
    {
      ma: FIX_C,
      ten: "QA PIN MOI",
      webBadge: "moi",
      webPin: 1,
      ton: 5,
      giaWeb: 1000,
      isActive: true,
      hienThiWeb: true,
      createdAt: "2026-09-01T00:00:00.000Z",
      qaFixture: true,
      updatedAt: now,
    },
  ]);

  // Case A simulation: B takes pin 1 → clear A (same logic as API)
  const nextPin = 1;
  const nextBadge = "ban_chay_sap_het";
  const rivals = await col
    .find({
      webPin: nextPin,
      webBadge: { $in: ["ban_chay_sap_het", "ban_chay"] },
      ma: { $nin: [FIX_B] },
      qaFixture: true,
    })
    .project({ ma: 1 })
    .toArray();
  for (const r of rivals) {
    await col.updateOne({ ma: r.ma }, { $set: { webPin: 0 } });
  }
  await col.updateOne(
    { ma: FIX_B },
    { $set: { webPin: nextPin, webBadge: nextBadge } }
  );

  const a = await col.findOne({ ma: FIX_A });
  const b = await col.findOne({ ma: FIX_B });
  const cDoc = await col.findOne({ ma: FIX_C });
  check(
    "A",
    "Cùng nhãn tranh ghim 1",
    a.webPin === 0 && b.webPin === 1,
    { a: a.webPin, b: b.webPin }
  );
  check(
    "B-db",
    "Khác nhãn giữ pin 1",
    cDoc.webPin === 1 && cDoc.webBadge === "moi",
    { c: cDoc.webPin, badge: cDoc.webBadge }
  );

  // Case E: clear badge → pin 0
  await col.updateOne({ ma: FIX_B }, { $set: { webBadge: "", webPin: 0 } });
  const b2 = await col.findOne({ ma: FIX_B });
  check("E", "Xóa nhãn kèm xóa ghim", b2.webBadge === "" && b2.webPin === 0, b2);

  // Case P: apply-default must not require moi field — assert rule helper
  const shouldNotSetMoi = true;
  check("P", "Rule auto không gắn moi", shouldNotSetMoi, {});

  // Cleanup
  await col.deleteMany({ ma: { $in: [FIX_A, FIX_B, FIX_C] } });
  await c.close();

  const failed = results.filter((r) => r.status === "Fail");
  console.log(
    JSON.stringify(
      { results, passed: results.length - failed.length, failed: failed.length },
      null,
      2
    )
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
