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

    // 1. Nếu có videoUrl mà chưa có videos: chuyển thành mảng videos
    const r1 = await col.updateMany(
      { videoUrl: { $exists: true, $ne: "" }, videos: { $exists: false } },
      [{ $set: { videos: ["$videoUrl"] } }]
    );

    // 2. Xóa vĩnh viễn trường videoUrl khỏi collection
    const r2 = await col.updateMany({}, { $unset: { videoUrl: "" } });

    console.log(`✅ Chuyển đổi videoUrl -> videos: ${r1.modifiedCount} SP`);
    console.log(`✅ Xóa sổ trường videoUrl trên: ${r2.modifiedCount} SP`);
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    await client.close();
  }
}

run();
