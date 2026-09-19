/**
 * Backfill createdDate / taoLuc từ aloha_thumua → aloha_shop_db
 * (shop đang chỉ có createdAt = ngày import Mongo → mục «SP mới» sai).
 */
const { MongoClient } = require("mongodb");
require("dotenv").config();

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("missing MONGODB_URI");
  const c = new MongoClient(uri);
  await c.connect();
  const shop = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const ops = c.db(process.env.OPS_SOURCE_DB || "aloha_thumua");

  const opsProds = await ops
    .collection("aloha_products")
    .find({})
    .project({ ma: 1, createdDate: 1, CreatedDate: 1, taoLuc: 1, id: 1, kvId: 1 })
    .toArray();

  const byMa = new Map();
  for (const p of opsProds) {
    const ma = String(p.ma || "")
      .trim()
      .toUpperCase();
    if (!ma) continue;
    byMa.set(ma, p);
  }

  const shopProds = await shop
    .collection("aloha_products")
    .find({})
    .project({ _id: 1, ma: 1 })
    .toArray();

  let updated = 0;
  let missing = 0;
  const opsList = [];
  for (const sp of shopProds) {
    const ma = String(sp.ma || "")
      .trim()
      .toUpperCase();
    const op = byMa.get(ma);
    if (!op) {
      missing++;
      continue;
    }
    const createdDate = op.createdDate || op.CreatedDate || op.taoLuc || null;
    const taoLuc = op.taoLuc || op.createdDate || op.CreatedDate || null;
    if (!createdDate && !taoLuc) continue;
    opsList.push({
      updateOne: {
        filter: { _id: sp._id },
        update: {
          $set: {
            ...(createdDate ? { createdDate: String(createdDate) } : {}),
            ...(taoLuc ? { taoLuc: String(taoLuc) } : {}),
            kvCreatedDateSyncedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  const chunk = 400;
  for (let i = 0; i < opsList.length; i += chunk) {
    const slice = opsList.slice(i, i + chunk);
    const r = await shop.collection("aloha_products").bulkWrite(slice, {
      ordered: false,
    });
    updated += r.modifiedCount + r.upsertedCount;
  }

  console.log(
    JSON.stringify({
      shop: shopProds.length,
      ops: opsProds.length,
      queued: opsList.length,
      updated,
      missing,
    })
  );

  const check = await shop.collection("aloha_products").findOne({ ma: /BKHDV1/i });
  console.log("BKHDV1.1KG", {
    createdDate: check?.createdDate,
    taoLuc: check?.taoLuc,
    createdAt: check?.createdAt,
  });

  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
