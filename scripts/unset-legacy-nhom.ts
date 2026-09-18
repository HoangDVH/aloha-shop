/**
 * $unset nhom / nhomPath trên aloha_products (shop DB).
 * Không đụng categoryId / categoryName / ancestor.
 *
 *   npx tsx scripts/unset-legacy-nhom.ts
 *   npx tsx scripts/unset-legacy-nhom.ts --dry-run
 *   npx tsx scripts/unset-legacy-nhom.ts --db=aloha_shop_db
 *
 * Env: MONGO_URI (mặc định mongodb://127.0.0.1:27018)
 */
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dbArg = args.find((a) => a.startsWith("--db="));
const dbName = dbArg ? dbArg.slice(5) : process.env.SHOP_DB || "aloha_shop_db";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection("aloha_products");
  const filter = {
    $or: [{ nhom: { $exists: true } }, { nhomPath: { $exists: true } }],
  };
  const count = await col.countDocuments(filter);
  console.log({ db: dbName, dryRun, withLegacyNhom: count });
  if (!dryRun && count > 0) {
    const r = await col.updateMany(filter, { $unset: { nhom: "", nhomPath: "" } });
    console.log({ matched: r.matchedCount, modified: r.modifiedCount });
  }
  const left = await col.countDocuments(filter);
  console.log({ remaining: left });
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
