/**
 * Realign categoryName + ancestor trên shop SP theo cây categories (KV).
 * Không tạo nhom/nhomPath.
 *
 *   npx tsx scripts/realign-product-categories.ts
 *   npx tsx scripts/realign-product-categories.ts --dry-run
 */
import { MongoClient } from "mongodb";
import { syncCatalogFromOps } from "../backend/shopCatalog/syncCatalogFromOps.ts";

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
  const dryRun = process.argv.includes("--dry-run");
  const shopDbName = process.env.SHOP_DB || "aloha_shop_db";
  const sourceDbName = process.env.SHOP_CATEGORY_SOURCE_DB || "aloha_thumua";

  const client = new MongoClient(uri);
  await client.connect();
  const shopDb = client.db(shopDbName);
  const sourceDb = client.db(sourceDbName);
  const result = await syncCatalogFromOps(shopDb, sourceDb, {
    dryRun,
    syncProducts: true,
    removeStaleCategories: false,
    unsetLegacyNhomFields: true,
  });
  console.log(JSON.stringify(result, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
