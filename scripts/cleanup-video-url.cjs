const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const col = client.db("aloha_shop_db").collection("aloha_products");

    // 1. videoUrl có, videos thiếu hoặc rỗng → gộp vào videos
    const cursor = col.find({
      videoUrl: { $exists: true, $nin: [null, ""] },
      $or: [
        { videos: { $exists: false } },
        { videos: null },
        { videos: { $size: 0 } },
      ],
    });
    let migrated = 0;
    for await (const d of cursor) {
      const url = String(d.videoUrl || "").trim();
      if (!url) continue;
      await col.updateOne({ _id: d._id }, { $set: { videos: [url] } });
      migrated++;
    }

    // 2. (tuỳ chọn) giữ videoUrl để fallback API — không unset
    console.log(`✅ Gộp videoUrl -> videos: ${migrated} SP`);
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    await client.close();
  }
}

run();
