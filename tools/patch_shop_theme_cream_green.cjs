/**
 * Patch appearance → palette mock cream/green (ảnh brand).
 *   $env:SHOP_MONGO_URI="mongodb://127.0.0.1:27018"; node tools/patch_shop_theme_cream_green.cjs
 */
"use strict";
require("dotenv").config({ quiet: true });
const { MongoClient } = require("mongodb");

const MONGO =
  process.env.SHOP_MONGO_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27018";
const DB = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
const PRIMARY = "#5F7D4E";
const HEADER = "#FFFDD0";

async function main() {
  const client = new MongoClient(MONGO, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const col = client.db(DB).collection("aloha_shop_appearance");
  const before = await col.findOne({ _id: "storefront" });
  if (!before) {
    console.log("no storefront appearance doc");
    await client.close();
    return;
  }
  const r = await col.updateOne(
    { _id: "storefront" },
    {
      $set: {
        "published.theme.primaryColor": PRIMARY,
        "published.theme.headerBg": HEADER,
        "draft.theme.primaryColor": PRIMARY,
        "draft.theme.headerBg": HEADER,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    }
  );
  const after = await col.findOne({ _id: "storefront" });
  console.log(
    JSON.stringify(
      {
        matched: r.matchedCount,
        modified: r.modifiedCount,
        before: {
          p: before.published?.theme?.primaryColor,
          h: before.published?.theme?.headerBg,
        },
        after: {
          p: after.published?.theme?.primaryColor,
          h: after.published?.theme?.headerBg,
          version: after.version,
        },
      },
      null,
      2
    )
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
