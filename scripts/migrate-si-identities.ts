/** Dry-run by default. Never merges accounts or modifies KiotViet. */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { normalizeWholesalePhone } from "../backend/shopWholesale/policy.js";
import { SHOP_ACCOUNTS } from "../backend/shopAuth/models.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const database = process.argv.find(arg => arg.startsWith("--db="))?.slice(5);
  if (!database) throw new Error("Specify --db=<shop database>. Omit --apply for a read-only report.");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGO_URI / MONGODB_URI");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const accounts = client.db(database).collection(SHOP_ACCOUNTS);
    const rows = await accounts.find({}, { projection: { phone: 1, phoneNorm: 1, zaloId: 1, kvCustomerId: 1, kvRetailer: 1, roles: 1, siStatus: 1 } }).toArray();
    const groups = new Map<string, string[]>();
    const invalid: string[] = [];
    const patches: Array<{ id: any; phoneNorm: string; siIdentity: boolean }> = [];
    for (const row of rows) {
      const phoneNorm = normalizeWholesalePhone(row.phoneNorm || row.phone);
      const id = String(row._id);
      if (phoneNorm && !/^0[35789]\d{8}$/.test(phoneNorm)) invalid.push(id);
      const keys = [phoneNorm && `phone:${phoneNorm}`, row.zaloId && `zalo:${row.zaloId}`, row.kvCustomerId && `kv:${row.kvRetailer}:${row.kvCustomerId}`].filter(Boolean) as string[];
      for (const key of keys) groups.set(key, [...(groups.get(key) || []), id]);
      if (phoneNorm) patches.push({ id: row._id, phoneNorm, siIdentity: Array.isArray(row.roles) && row.roles.includes("si") && Boolean(row.siStatus) });
      if (row.zaloId === "") invalid.push(id);
    }
    const duplicates = [...groups].filter(([, ids]) => ids.length > 1).map(([key, accountIds]) => ({ field: key.split(":")[0], accountIds }));
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", scanned: rows.length, plannedUpdates: patches.length, duplicates, invalidAccountIds: [...new Set(invalid)] }, null, 2));
    if (!apply) return;
    if (duplicates.length || invalid.length) throw new Error("Resolve duplicate/invalid identities manually before applying. No writes performed.");
    for (const patch of patches) await accounts.updateOne({ _id: patch.id }, { $set: { phoneNorm: patch.phoneNorm, siIdentity: patch.siIdentity } });
    await accounts.createIndex({ phoneNorm: 1 }, { unique: true, partialFilterExpression: { siIdentity: true, phoneNorm: { $type: "string" } } });
    await accounts.createIndex({ zaloId: 1 }, { unique: true, partialFilterExpression: { zaloId: { $type: "string" } } });
    await accounts.createIndex({ kvRetailer: 1, kvCustomerId: 1 }, { unique: true, partialFilterExpression: { siIdentity: true, kvCustomerId: { $type: "number" } } });
    console.log("Identity backfill and indexes complete. No accounts merged.");
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
