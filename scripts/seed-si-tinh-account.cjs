/**
 * Tạo hoặc cập nhật tài khoản shop khách sỉ tỉnh (đăng nhập email + mật khẩu).
 *
 *   SEED_SI_PASSWORD='...' node scripts/seed-si-tinh-account.cjs
 *
 * Không ghi mật khẩu vào repo. Chạy trên máy có Mongo của shop (VPS: /root/aloha-shop).
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const email = String(process.env.SEED_SI_EMAIL || "khach.si.tinh@alohathegioichaucay.com")
  .trim()
  .toLowerCase();
const password = String(process.env.SEED_SI_PASSWORD || "");
const fullName = String(process.env.SEED_SI_NAME || "Khách sỉ tỉnh Seed");
const phoneCandidates = ["0908800101", "0908800102", "0908800103"];

if (password.length < 6) {
  console.error("Thiếu SEED_SI_PASSWORD (tối thiểu 6 ký tự).");
  process.exit(1);
}

const uri = process.env.MONGO_URI || process.env.SHOP_MONGO_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.SHOP_STANDALONE_DB || process.env.OPS_DB_NAME || "aloha_shop_db";

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  try {
    const col = client.db(dbName).collection("aloha_shop_accounts");
    const existing = await col.findOne({ email });
    let phone = existing?.phoneNorm || existing?.phone || "";
    if (!phoneCandidates.includes(phone)) {
      for (const candidate of phoneCandidates) {
        const taken = await col.findOne({
          ...(existing ? { _id: { $ne: existing._id } } : {}),
          $or: [{ phone: candidate }, { phoneNorm: candidate }],
        });
        if (!taken) {
          phone = candidate;
          break;
        }
      }
    }
    if (!phone) throw new Error("Không còn số điện thoại seed trống");

    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 10);
    const patch = {
      email,
      fullName,
      phone,
      phoneNorm: phone,
      passwordHash,
      roles: ["customer", "si"],
      siStatus: "active",
      siRegion: "TINH",
      siIdentity: true,
      active: true,
      failedLoginCount: 0,
      lockUntil: null,
      updatedAt: now,
      siProfile: {
        shopName: "Cửa hàng seed khách sỉ tỉnh",
        businessType: "Seed test",
        note: "Tài khoản seed để kiểm tra nhãn Khách sỉ tỉnh",
      },
    };

    if (existing) {
      await col.updateOne({ _id: existing._id }, { $set: patch, $unset: { authInvalidBefore: "" } });
      console.log(JSON.stringify({ ok: true, action: "updated", email, phone, siRegion: "TINH", siStatus: "active" }));
    } else {
      await col.insertOne({ ...patch, createdAt: now, lastLoginAt: null });
      console.log(JSON.stringify({ ok: true, action: "created", email, phone, siRegion: "TINH", siStatus: "active" }));
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
