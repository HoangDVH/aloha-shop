/**
 * One-shot sync categories + SP category fields: ops → shop.
 *
 *   npx tsx tools/sync_catalog_from_ops.ts --dry-run
 *   npx tsx tools/sync_catalog_from_ops.ts
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { syncCatalogFromOps } from "../backend/shopCatalog/syncCatalogFromOps.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const p = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] != null) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const uri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27018/?serverSelectionTimeoutMs=20000";
  const shopName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const sourceName =
    process.env.SHOP_CATEGORY_SOURCE_DB ||
    process.env.KV_CONFIG_DB ||
    "aloha_thumua";

  console.log(
    `[sync] ${dryRun ? "DRY-RUN" : "APPLY"} shop=${shopName} source=${sourceName}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const result = await syncCatalogFromOps(
      client.db(shopName),
      client.db(sourceName),
      {
        dryRun,
        syncProducts: true,
        removeStaleCategories: true,
      }
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
