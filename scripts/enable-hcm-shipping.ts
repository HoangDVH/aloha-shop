import "dotenv/config";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { PROMOTIONS_COL, PROMOTION_AUDIT_COL } from "../backend/shopPromotions/types.js";
async function main() {
  const client = new MongoClient(process.env.MONGO_URI!);
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
    const promos = await db.collection(PROMOTIONS_COL).find({ status: "active", benefitType: "shipping", discountType: "fixed",
      $or: [{ discountValue: 30000, minOrderThreshold: 1000000 }, { discountValue: 50000, minOrderThreshold: 2000000 }] }).toArray();
    if (promos.length !== 2) throw new Error("Expected exactly the two approved 30k/50k shipping promotions");
    for (const promo of promos) {
      console.log(JSON.stringify({ id: promo.id, title: promo.title, claimRequired: promo.claimRequired, allowWholesaleHcm: promo.allowWholesaleHcm === true }));
      if (!process.argv.includes("--apply") || promo.allowWholesaleHcm === true) continue;
      const at = new Date().toISOString();
      const audit = { id: randomUUID(), action: "allow_wholesale_hcm_shipping", promotionId: promo.id, actor: "codex:user-authorized", at,
        before: { allowWholesaleHcm: promo.allowWholesaleHcm ?? false }, after: { allowWholesaleHcm: true } };
      const result = await db.collection(PROMOTIONS_COL).updateOne({ _id: promo._id, revision: promo.revision ?? null }, {
        $set: { allowWholesaleHcm: true, updatedAt: at, updatedBy: "codex:user-authorized" }, $inc: { revision: 1 },
        $push: { audienceAudit: audit } as any,
      });
      if (!result.modifiedCount) throw new Error("Promotion changed concurrently; stop and review");
      await db.collection(PROMOTION_AUDIT_COL).insertOne(audit);
      console.log(`Enabled approved HCM shipping audience: ${promo.id}`);
    }
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
