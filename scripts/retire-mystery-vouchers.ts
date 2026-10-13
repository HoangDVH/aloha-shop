import "dotenv/config";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { PROMOTIONS_COL, PROMOTION_AUDIT_COL } from "../backend/shopPromotions/types.js";
async function main() {
  const client = new MongoClient(process.env.MONGO_URI!);
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
    const rows = await db.collection(PROMOTIONS_COL).find({ "mystery.tiers.0": { $exists: true } }).toArray();
    for (const p of rows) {
      if (!(Number(p.discountValue) > 0)) throw new Error(`Invalid fixed discount for ${p.id}`);
      console.log(JSON.stringify({ id: p.id, title: p.title, fixedPercent: p.discountValue, claimedCount: p.claimedCount || 0 }));
      if (!process.argv.includes("--apply")) continue;
      const at = new Date().toISOString();
      const fixedTitle = String(p.title || p.name || "").replace(/\d+\s*[–-]\s*\d+\s*%/g, `${p.discountValue}%`);
      const audit = { id: randomUUID(), action: "retire_mystery", promotionId: p.id, actor: "codex:user-authorized", at,
        before: { mystery: p.mystery, title: p.title }, after: { mystery: null, discountValue: p.discountValue, title: fixedTitle } };
      const result = await db.collection(PROMOTIONS_COL).updateOne({ _id: p._id, revision: p.revision ?? null }, {
        $set: { title: fixedTitle, name: String(p.name || fixedTitle).replace(/\d+\s*[–-]\s*\d+\s*%/g, `${p.discountValue}%`), legacyMysteryConfig: p.mystery, preserveDrawnPercent: true, updatedAt: at, updatedBy: "codex:user-authorized" },
        $unset: { mystery: "" }, $inc: { revision: 1 }, $push: { featureAudit: audit } as any,
      });
      if (!result.modifiedCount) throw new Error("Voucher changed concurrently; stop and review");
      await db.collection(PROMOTION_AUDIT_COL).insertOne(audit);
      console.log(`Converted to fixed discount: ${p.id}`);
    }
    console.log(`Mystery vouchers found: ${rows.length}`);
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
