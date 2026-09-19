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
    const r = await col.updateMany(
      {
        videoUrl: { $exists: true, $nin: [null, ""] },
        $or: [
          { videos: { $exists: false } },
          { videos: { $size: 0 } },
          { videos: null },
        ],
      },
      [{ $set: { videos: ["$videoUrl"] } }]
    );
    console.log(`migrated videoUrl -> videos: ${r.modifiedCount}`);
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
