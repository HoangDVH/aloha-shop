/**
 * Safe one-shot fill: ops videos → shop when shop empty.
 * Never $unset videoUrl. Never overwrite non-empty shop videos.
 *
 * VPS:
 *   cd /root/aloha-shop && node ./node_modules/tsx/dist/cli.mjs scripts/restore-product-videos-from-ops.cjs
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { MongoClient } = require("mongodb");

async function main() {
  const { reconcileProductVideosFromOps } = await import(
    "../backend/shopCatalog/videoReconcile.ts"
  );
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const shopName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const opsName = process.env.OPS_DB_NAME || process.env.KV_CONFIG_DB || "aloha_thumua";
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const result = await reconcileProductVideosFromOps(
      client.db(shopName),
      client.db(opsName)
    );
    console.log(JSON.stringify(result));
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
