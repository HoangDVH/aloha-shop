import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const col = db.collection("aloha_products");

  const docs = await col
    .find({
      $or: [{ ma: /^T2$/i }, { ten: /^T2$/i }, { ma: "T2" }, { ten: "T2" }],
    })
    .project({
      ma: 1,
      ten: 1,
      anh: 1,
      images: 1,
      ton: 1,
      onHand: 1,
      kvTon: 1,
      gia: 1,
      banTrucTiep: 1,
      isActive: 1,
      hienThiWeb: 1,
      categoryName: 1,
      webBadge: 1,
    })
    .limit(20)
    .toArray();
  console.log("exact T2:", JSON.stringify(docs, null, 2));

  const byGia = await col
    .find({
      $or: [{ gia: 65987 }, { giaBan: 65987 }, { basePrice: 65987 }],
    })
    .project({ ma: 1, ten: 1, anh: 1, ton: 1, gia: 1, onHand: 1 })
    .limit(10)
    .toArray();
  console.log("byGia 65987:", JSON.stringify(byGia, null, 2));

  const noImg = await col
    .find({
      $and: [
        { $or: [{ anh: null }, { anh: "" }, { anh: { $exists: false } }] },
        {
          $or: [
            { ton: { $gt: 0, $lte: 8 } },
            { onHand: { $gt: 0, $lte: 8 } },
          ],
        },
      ],
    })
    .project({ ma: 1, ten: 1, anh: 1, ton: 1, onHand: 1, gia: 1 })
    .limit(20)
    .toArray();
  console.log(
    "noImg lowTon:",
    noImg.map((d) => `${d.ma}|${d.ten}|ton=${d.ton ?? d.onHand}|gia=${d.gia}`)
  );

  // revenue rank contains T2?
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const inv = await db
    .collection("aloha_sales_invoices")
    .find({
      $or: [
        { "invoiceDetails.productCode": "T2" },
        { "invoiceDetails.ma": "T2" },
        { "items.productCode": "T2" },
        { "items.ma": "T2" },
      ],
    })
    .project({ code: 1, purchaseDate: 1, createdDate: 1 })
    .limit(5)
    .toArray();
  console.log("invoices mentioning T2:", inv.length, JSON.stringify(inv));

  await c.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
