/**
 * Sửa index ctvCode an toàn — không xóa tài khoản / không đổi data nghiệp vụ.
 *
 * Việc làm:
 * 1) $unset field ctvCode khi null/"" (sparse mới bỏ qua đúng)
 * 2) drop index ctvCode_1 nếu đang unique không sparse
 * 3) tạo lại { unique: true, sparse: true }
 *
 * Chạy (qua tunnel Mongo VPS):
 *   node scripts/fix-ctvcode-sparse-index.js
 *   node scripts/fix-ctvcode-sparse-index.js --db=aloha_shop_db
 *   node scripts/fix-ctvcode-sparse-index.js --db=aloha_thumua_playground --dry-run
 *
 * Env: MONGO_URI (mặc định mongodb://127.0.0.1:27018)
 */
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dbArg = args.find((a) => a.startsWith("--db="));
const dbName = dbArg ? dbArg.slice(5) : process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
const COL = "aloha_shop_accounts";

async function fixDb(client, name) {
  const db = client.db(name);
  const col = db.collection(COL);
  const exists = await db.listCollections({ name: COL }).hasNext();
  if (!exists) {
    console.log(`[skip] ${name}.${COL} không tồn tại`);
    return;
  }

  const nullish = await col.countDocuments({
    $or: [{ ctvCode: null }, { ctvCode: "" }],
  });
  console.log(`[${name}] docs ctvCode null/"" = ${nullish}`);

  if (!dryRun && nullish > 0) {
    const r = await col.updateMany(
      { $or: [{ ctvCode: null }, { ctvCode: "" }] },
      { $unset: { ctvCode: "" } }
    );
    console.log(`[${name}] unset ctvCode: matched=${r.matchedCount} modified=${r.modifiedCount}`);
  } else if (dryRun) {
    console.log(`[${name}] dry-run: sẽ $unset ctvCode trên ${nullish} docs`);
  }

  const indexes = await col.indexes();
  const cur = indexes.find((i) => i.name === "ctvCode_1");
  console.log(
    `[${name}] index ctvCode_1 hiện tại:`,
    cur
      ? { unique: !!cur.unique, sparse: !!cur.sparse, key: cur.key }
      : "(chưa có)"
  );

  if (dryRun) {
    console.log(`[${name}] dry-run: sẽ drop + create unique+sparse ctvCode_1`);
    return;
  }

  if (cur) {
    await col.dropIndex("ctvCode_1");
    console.log(`[${name}] đã drop ctvCode_1`);
  }

  await col.createIndex({ ctvCode: 1 }, { unique: true, sparse: true, background: true });
  console.log(`[${name}] đã create ctvCode_1 unique+sparse`);
}

async function main() {
  console.log(`MONGO_URI=${uri.replace(/\/\/.*@/, "//***@")} db=${dbName} dryRun=${dryRun}`);
  const client = new MongoClient(uri);
  await client.connect();
  try {
    await fixDb(client, dbName);
  } finally {
    await client.close();
  }
  console.log("Xong. Data tài khoản giữ nguyên; chỉ bỏ field null + sửa index.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
