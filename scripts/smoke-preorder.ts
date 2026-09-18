/**
 * Smoke TC-PRE BE: annotate + assert preOrder.
 * Chạy: npx tsx scripts/smoke-preorder.ts
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import {
  annotatePreOrderDetails,
  assertStockAvailable,
} from "../backend/shopOrders/stockApply.js";

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27018";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const client = new MongoClient(uri);
  await client.connect();
  const dbs = await client.db("admin").admin().listDatabases();
  console.log(
    "dbs",
    dbs.databases.map((d: { name: string }) => d.name).join(",")
  );
  const mainDb = client.db(dbName);
  const shopDb = client.db(dbName);
  const col = mainDb.collection("aloha_products");
  const total = await col.estimatedDocumentCount();
  console.log("db", dbName, "products~", total);

  const oos =
    (await col.findOne(
      { ma: "BCCM" },
      { projection: { ma: 1, ten: 1, ton: 1, gia: 1 } }
    )) ||
    (await col.findOne(
      { $or: [{ ton: 0 }, { ton: { $lte: 0 } }] },
      { projection: { ma: 1, ten: 1, ton: 1, gia: 1 } }
    ));
  const instock =
    (await col.findOne(
      { ton: { $gt: 2 }, gia: { $gt: 0 } },
      { projection: { ma: 1, ten: 1, ton: 1, gia: 1 } }
    )) ||
    (await col.findOne(
      { ton: { $gt: 0 } },
      { projection: { ma: 1, ten: 1, ton: 1, gia: 1 } }
    ));
  if (!oos || !instock) {
    throw new Error(
      `Thiếu SP OOS hoặc còn hàng (oos=${!!oos} in=${!!instock} total=${total})`
    );
  }
  console.log("OOS", oos.ma, "ton=", oos.ton);
  console.log("IN", instock.ma, "ton=", instock.ton);

  const mixed = [
    {
      productCode: String(oos.ma),
      productName: String(oos.ten || oos.ma),
      quantity: 2,
      price: Math.max(1, Number(oos.gia) || 1),
    },
    {
      productCode: String(instock.ma),
      productName: String(instock.ten || instock.ma),
      quantity: 1,
      price: Math.max(1, Number(instock.gia) || 1),
    },
  ];

  const ann = await annotatePreOrderDetails(mainDb, mixed, shopDb);
  if (!ann.ok) throw new Error(ann.error);
  const oosLine = ann.details.find(
    (d) => d.productCode === String(oos.ma).toUpperCase()
  );
  const inLine = ann.details.find(
    (d) => d.productCode === String(instock.ma).toUpperCase()
  );
  if (!oosLine?.preOrder) throw new Error("OOS phải preOrder");
  if (inLine?.preOrder) throw new Error("Còn hàng không được preOrder");
  if (!String(oosLine.note || "").includes("DAT-TRUOC")) {
    throw new Error("Thiếu note [DAT-TRUOC]");
  }
  console.log("A07/A08 annotate OK");

  const stock = await assertStockAvailable(mainDb, ann.details, shopDb);
  if (!stock.ok) throw new Error(`assert mixed fail: ${stock.error}`);
  console.log("A08 assert skip preOrder OK");

  const over = await annotatePreOrderDetails(
    mainDb,
    [
      {
        productCode: String(instock.ma),
        productName: "x",
        quantity: 99999,
        price: 1,
      },
    ],
    shopDb
  );
  if (!over.ok) throw new Error(over.error);
  if (over.details[0]?.preOrder) {
    throw new Error("Thiếu tồn (SL vượt) không được coi preOrder");
  }
  const fail = await assertStockAvailable(mainDb, over.details, shopDb);
  if (fail.ok) throw new Error("Expect assert fail khi vượt tồn");
  console.log("C03 overstock assert fail OK:", fail.error);

  await client.close();
  console.log("SMOKE_OK");
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e?.message || e);
  process.exit(1);
});
