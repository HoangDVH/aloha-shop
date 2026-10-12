import "dotenv/config";
import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import { mkdirSync, writeFileSync } from "node:fs";
import { planStockHoldRepair, applyStockHoldRepair } from "../backend/shopOrders/stockHoldRepair.js";

async function main() {
  const apply = process.argv.includes("--apply"), dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const client = await new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017", { serverSelectionTimeoutMS: 5000 }).connect();
  try {
    const db = client.db(dbName), plan = await planStockHoldRepair(db);
    const counts = { released: 0, consumed: 0, rebound: 0 };
    for (const change of plan.changes) counts[change.action]++;
    mkdirSync("artifacts/stock-hold-repair", { recursive: true });
    const backup = `artifacts/stock-hold-repair/${new Date().toISOString().replaceAll(":", "-")}.json`;
    // Save complete hold documents before any mutation, without customer personal data.
    writeFileSync(backup, EJSON.stringify({ database: dbName, apply, plan }, { relaxed: false }, 2));
    const result = apply ? await applyStockHoldRepair(db, plan.changes) : null;
    console.log(JSON.stringify({ database: dbName, apply, held: plan.held, planned: counts, unresolved: plan.unresolved, backup, result,
      remaining: apply ? (await planStockHoldRepair(db)).changes.length : undefined }, null, 2));
  } finally { await client.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Repair failed"); process.exitCode = 1; });
