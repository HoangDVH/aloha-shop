/**
 * Dọn field tồn bản sao do stockApply cũ tạo (shopStockAt / tonSyncedAt + clone).
 * Giữ `ton` (và inventories).
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection("aloha_products");

  const filter = {
    $or: [
      { shopStockAt: { $exists: true } },
      { tonSyncedAt: { $exists: true } },
    ],
  };

  const before = await col.countDocuments(filter);
  const samples = await col
    .find(filter)
    .project({ ma: 1, ten: 1, ton: 1, onHand: 1, kvTon: 1, tonKho: 1, shopStockAt: 1 })
    .limit(20)
    .toArray();

  console.log("matched", before);
  console.log(
    "samples",
    samples.map((s) => ({
      ma: s.ma,
      ten: String(s.ten || "").slice(0, 40),
      ton: s.ton,
      onHand: s.onHand,
      kvTon: s.kvTon,
    }))
  );

  const r = await col.updateMany(filter, {
    $unset: {
      shopStockAt: "",
      tonSyncedAt: "",
      kvTon: "",
      onHand: "",
      tonKho: "",
    },
  });

  const after = await col.countDocuments(filter);
  console.log("modified", r.modifiedCount, "remaining_with_meta", after);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
