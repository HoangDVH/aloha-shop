// Gộp SP trùng mã chỉ khác hoa/thường trong aloha_shop_db.aloha_products.
// Doc giữ lại = doc KV (có id số KiotViet, đang được sync cập nhật). Doc cũ (_id = mã HOA) bị tắt, không xoá.
// Mặc định chạy thử (không ghi). Thêm --apply để ghi. Luôn sao lưu 2 doc trước khi ghi.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const APPLY = process.argv.includes("--apply");
const CARRY = [
  "webBadge", "webPin", "merchandisingUpdatedAt", "videos", "videoUrl", "seoTitle", "seoDescription",
  "barcode", "dvt", "qrToken", "qrTokenAt", "qrTokenPrev",
];
const empty = (v) => v == null || v === "" || v === 0 || (Array.isArray(v) && v.length === 0);

(async () => {
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const client = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
  await client.connect();
  try {
    const col = client.db(dbName).collection("aloha_products");
    const groups = await col
      .aggregate([
        { $match: { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] } },
        { $group: { _id: { $toUpper: { $trim: { input: { $ifNull: ["$ma", ""] } } } }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
        { $match: { n: 2 } },
      ])
      .toArray();

    const plan = [];
    for (const g of groups) {
      const docs = await col.find({ _id: { $in: g.ids } }).toArray();
      const legacy = docs.find((d) => typeof d._id === "string" && d.source !== "kiotviet");
      const kv = docs.find((d) => typeof d._id !== "string" && d.source === "kiotviet" && /^\d+$/.test(String(d.id || "")));
      if (!legacy || !kv) {
        console.log(`BỎ QUA ${g._id}: không đúng mẫu (doc cũ + doc KV)`);
        continue;
      }
      const carry = {};
      for (const k of CARRY) if (!empty(legacy[k]) && empty(kv[k])) carry[k] = legacy[k];
      plan.push({ key: g._id, legacy, kv, carry });
      console.log(
        `${JSON.stringify(legacy.ma)} -> ${JSON.stringify(kv.ma)} (KV id ${kv.id}) · chuyển: ${Object.keys(carry).join(", ") || "-"}` +
          (carry.webBadge ? ` · nhãn=${carry.webBadge} ghim=${carry.webPin || 0}` : "")
      );
    }
    console.log(`\n${plan.length} cặp sẽ gộp. Doc cũ: isActive=false, hienThiWeb=false, mergedInto=<_id doc KV>.`);

    if (!APPLY) {
      console.log("Chạy thử — chưa ghi gì. Thêm --apply để ghi.");
      return;
    }

    const dir = path.join(__dirname, "..", "artifacts", "dup-ma-merge");
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backup, JSON.stringify(plan.map((p) => ({ legacy: p.legacy, kv: p.kv })), null, 2));
    console.log("Đã sao lưu:", backup);

    const now = new Date().toISOString();
    for (const p of plan) {
      const unset = {};
      for (const k of ["qrToken", "qrTokenAt", "qrTokenPrev"]) if (k in p.carry) unset[k] = "";
      await col.updateOne(
        { _id: p.legacy._id },
        {
          $set: { isActive: false, hienThiWeb: false, webPin: 0, mergedInto: p.kv._id, mergedAt: now },
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        }
      );
      if (Object.keys(p.carry).length) {
        await col.updateOne({ _id: p.kv._id }, { $set: { ...p.carry, mergedFrom: p.legacy._id, mergedAt: now } });
      }
      console.log(`OK ${p.key}`);
    }
    console.log("Xong. Nhớ xoá cache shop (restart API hoặc đợi TTL).");
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
