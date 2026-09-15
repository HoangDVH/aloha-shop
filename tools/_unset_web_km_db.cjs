/**
 * Xóa field webKm + giaWebLichSu trên aloha_products (production).
 * Chạy trên VPS: node tools/_unset_web_km_db.cjs
 */
const fs = require("fs");
const { MongoClient } = require("mongodb");

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] == null) process.env[m[1]] = v;
  }
}

loadEnv("/root/aloha-shop/.env");
loadEnv("/root/aloha-shop/backend/.env");
loadEnv(require("path").resolve(__dirname, "../.env"));

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.SHOP_MONGO_URI;
if (!uri) {
  console.error("NO_URI");
  process.exit(1);
}

const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
const filter = {
  $or: [{ webKm: { $exists: true } }, { giaWebLichSu: { $exists: true } }],
};

(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const col = c.db(dbName).collection("aloha_products");
  const before = await col.countDocuments(filter);
  console.log("db", dbName, "matched_before", before);
  const r = await col.updateMany(filter, {
    $unset: { webKm: "", giaWebLichSu: "" },
  });
  console.log("matched", r.matchedCount, "modified", r.modifiedCount);
  const after = await col.countDocuments(filter);
  console.log("matched_after", after);
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
