/**
 * Gỡ 3 field backfill ngày KV khỏi shop (ngày tạo lấy từ aloha_thumua lúc xếp).
 */
const { MongoClient } = require("mongodb");
require("dotenv").config();

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("missing MONGODB_URI");
  const c = new MongoClient(uri);
  await c.connect();
  const col = c
    .db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db")
    .collection("aloha_products");

  const before = {
    createdDate: await col.countDocuments({ createdDate: { $exists: true } }),
    taoLuc: await col.countDocuments({ taoLuc: { $exists: true } }),
    kvCreatedDateSyncedAt: await col.countDocuments({
      kvCreatedDateSyncedAt: { $exists: true },
    }),
  };

  const r = await col.updateMany(
    {},
    {
      $unset: {
        createdDate: "",
        taoLuc: "",
        kvCreatedDateSyncedAt: "",
        CreatedDate: "",
      },
    }
  );

  const after = {
    createdDate: await col.countDocuments({ createdDate: { $exists: true } }),
    taoLuc: await col.countDocuments({ taoLuc: { $exists: true } }),
    kvCreatedDateSyncedAt: await col.countDocuments({
      kvCreatedDateSyncedAt: { $exists: true },
    }),
  };

  console.log(
    JSON.stringify(
      { before, modified: r.modifiedCount, matched: r.matchedCount, after },
      null,
      2
    )
  );
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
