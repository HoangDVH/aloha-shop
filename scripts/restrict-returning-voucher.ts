import "dotenv/config";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { PROMOTIONS_COL, PROMOTION_AUDIT_COL } from "../backend/shopPromotions/types.js";
async function main() {
  const client = new MongoClient(process.env.MONGO_URI!);
  try {
    await client.connect();
    const db = client.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
    const col = db.collection(PROMOTIONS_COL);
    const p = await col.findOne({ id: "pro_1791793007961_mfpcsn" });
    if (!p || p.title !== "Ưu đãi khách cũ" || p.discountValue !== 7) throw new Error("Voucher identity changed");
    console.log(JSON.stringify({ title: p.title, targetCustomer: p.targetCustomer }));
    if (!process.argv.includes("--apply") || p.targetCustomer === "returning_web") return;
    if (p.targetCustomer !== "all") throw new Error("Unexpected audience");
    const at = new Date().toISOString();
    const audit = { id: randomUUID(), action: "restrict_returning_web", promotionId: p.id, actor: "codex:user-authorized", at,
      before: { targetCustomer: p.targetCustomer }, after: { targetCustomer: "returning_web" } };
    const result = await col.updateOne({ _id: p._id, revision: p.revision ?? null, targetCustomer: "all" }, {
      $set: { targetCustomer: "returning_web", updatedAt: at, updatedBy: "codex:user-authorized" },
      $inc: { revision: 1 }, $push: { audienceAudit: audit } as any,
    });
    if (!result.modifiedCount) throw new Error("Voucher changed concurrently");
    await db.collection(PROMOTION_AUDIT_COL).insertOne(audit);
    console.log("Restricted returning customer voucher");
  } finally { await client.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
