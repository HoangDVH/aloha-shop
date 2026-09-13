/**
 * Tạo/copy tài khoản staff (aloha_users) vào DB shop (aloha_shop_db).
 * Không đụng DB Garden (aloha_thumua*).
 *
 * Mặc định: copy user từ Garden local → shop local.
 *   node scripts/seed-shop-admin.cjs
 *
 * Seed thẳng lên VPS shop (cần tunnel :27018):
 *   $env:SHOP_MONGO_URI="mongodb://127.0.0.1:27018"; node scripts/seed-shop-admin.cjs
 *
 * Chỉ tạo user mới (không copy hash Garden):
 *   $env:SEED_PASSWORD="2026"; $env:RESET_AUTH="1"; node scripts/seed-shop-admin.cjs
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const sourceUri =
  process.env.GARDEN_MONGO_URI ||
  process.env.SOURCE_MONGO_URI ||
  "mongodb://127.0.0.1:27017";
const sourceDbName =
  process.env.GARDEN_DB_NAME ||
  process.env.SOURCE_DB_NAME ||
  "aloha_thumua_playground";

const shopUri =
  process.env.SHOP_MONGO_URI ||
  process.env.MONGO_URI_OPS ||
  "mongodb://127.0.0.1:27017";
const shopDbName =
  process.env.OPS_DB_NAME ||
  process.env.SHOP_STANDALONE_DB ||
  "aloha_shop_db";

const username = (process.env.SEED_USERNAME || "aloha").trim().toLowerCase();
const password = process.env.SEED_PASSWORD || "2026";
const reset = process.env.RESET_AUTH === "1" || process.env.RESET_AUTH === "true";
const copyOnly =
  process.env.COPY_ONLY === "1" || process.env.COPY_ONLY === "true" || !process.env.SEED_PASSWORD;

async function connect(uri, label) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  try {
    await client.connect();
    return client;
  } catch (e) {
    console.error(`Không kết nối được Mongo (${label}):`, uri);
    throw e;
  }
}

async function main() {
  const shopClient = await connect(shopUri, "shop");
  const shopDb = shopClient.db(shopDbName);
  const col = shopDb.collection("aloha_users");
  await col.createIndex({ username: 1 }, { unique: true });

  let docFromGarden = null;
  try {
    const srcClient = await connect(sourceUri, "garden-source");
    try {
      docFromGarden = await srcClient
        .db(sourceDbName)
        .collection("aloha_users")
        .findOne({ username });
      if (docFromGarden) {
        console.log(
          `Nguồn Garden: ${sourceDbName}.${username} (role=${docFromGarden.role})`
        );
      } else {
        console.log(`Garden không có user ${username} — sẽ seed mới.`);
      }
    } finally {
      await srcClient.close();
    }
  } catch {
    console.log("Bỏ qua copy Garden (không kết nối được) — seed mới nếu cần.");
  }

  const existing = await col.findOne({ username });
  const now = new Date();

  let passwordHash =
    docFromGarden && docFromGarden.passwordHash && copyOnly && !reset
      ? String(docFromGarden.passwordHash)
      : await bcrypt.hash(password, 10);

  if (existing && !reset && copyOnly && docFromGarden?.passwordHash) {
    // Đồng bộ hash/role từ Garden nếu shop đã có user nhưng muốn refresh nhẹ
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordHash: String(docFromGarden.passwordHash),
          fullName: docFromGarden.fullName || existing.fullName || "ALOHA",
          role: docFromGarden.role || existing.role || "manager",
          permissions: Array.isArray(docFromGarden.permissions)
            ? docFromGarden.permissions
            : existing.permissions || [],
          active: true,
          approvalStatus: "approved",
          failedLoginCount: 0,
          lockUntil: null,
          updatedAt: now,
        },
      }
    );
    console.log(`Đã đồng bộ manager "${username}" → ${shopDbName} @ ${shopUri}`);
    await shopClient.close();
    return;
  }

  if (existing && !reset) {
    console.log(`Đã có user "${username}" trên ${shopDbName} — không ghi đè.`);
    console.log('Muốn reset mật khẩu: $env:RESET_AUTH="1"; node scripts/seed-shop-admin.cjs');
    await shopClient.close();
    return;
  }

  if (existing && reset) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordHash,
          active: true,
          approvalStatus: "approved",
          failedLoginCount: 0,
          lockUntil: null,
          role: existing.role || "manager",
          fullName: existing.fullName || docFromGarden?.fullName || "ALOHA",
          updatedAt: now,
        },
      }
    );
    console.log(`Đã RESET manager "${username}" | DB ${shopDbName} | pass=${password}`);
    await shopClient.close();
    return;
  }

  const { _id, ...fromRest } = docFromGarden || {};
  await col.insertOne({
    username,
    passwordHash,
    fullName: fromRest.fullName || "ALOHA",
    role: fromRest.role || "manager",
    permissions: Array.isArray(fromRest.permissions) ? fromRest.permissions : [],
    zaloId: fromRest.zaloId ?? null,
    active: true,
    approvalStatus: "approved",
    failedLoginCount: 0,
    lockUntil: null,
    accountKind: fromRest.accountKind,
    sharedAccount: fromRest.sharedAccount,
    employeeId: fromRest.employeeId,
    createdAt: now,
    updatedAt: now,
  });
  console.log(
    `Đã tạo manager "${username}" trên ${shopDbName} @ ${shopUri}` +
      (docFromGarden ? " (copy từ Garden)" : ` (pass=${password})`)
  );
  await shopClient.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
