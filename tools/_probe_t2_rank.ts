import { MongoClient } from "mongodb";
import { loadRevenueRankMap } from "../backend/shopCatalog/register.ts";

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const doc = await db.collection("aloha_products").findOne({ ma: "T2" });
  console.log(
    "T2 full keys:",
    Object.keys(doc || {}),
    "\n",
    JSON.stringify(
      {
        ma: doc?.ma,
        ten: doc?.ten,
        anh: doc?.anh,
        images: doc?.images,
        ton: doc?.ton,
        gia: doc?.gia,
        webPin: doc?.webPin,
        webBadge: doc?.webBadge,
        banTrucTiep: doc?.banTrucTiep,
        hienThiWeb: doc?.hienThiWeb,
        isActive: doc?.isActive,
        categoryName: doc?.categoryName,
        categoryId: doc?.categoryId,
      },
      null,
      2
    )
  );

  const rank = await loadRevenueRankMap(db);
  console.log("T2 in revenue rank?", rank.has("T2"), "score=", rank.get("T2"));

  // price book
  const pb = await db
    .collection("aloha_pricebook_items")
    .find({ $or: [{ productCode: "T2" }, { ma: "T2" }, { code: "T2" }] })
    .limit(5)
    .toArray();
  console.log(
    "pricebook:",
    pb.map((x) => ({ code: x.productCode || x.ma, price: x.price || x.gia }))
  );

  await c.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
