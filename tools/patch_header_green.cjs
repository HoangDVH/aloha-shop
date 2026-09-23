"use strict";
require("dotenv").config();
const { MongoClient } = require("mongodb");
const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
const DB = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
const HEADER = "#0C8048";

async function main() {
  const client = new MongoClient(MONGO, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const col = client.db(DB).collection("aloha_shop_appearance");
  const r = await col.updateOne(
    { _id: "storefront" },
    {
      $set: {
        "published.theme.headerBg": HEADER,
        "draft.theme.headerBg": HEADER,
        updatedAt: new Date(),
      },
    }
  );
  const after = await col.findOne({ _id: "storefront" });
  console.log({
    modified: r.modifiedCount,
    headerBg: after?.published?.theme?.headerBg,
    primary: after?.published?.theme?.primaryColor,
  });
  await client.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
