/**
 * Fill-only: copy videoUrl → videos[] when videos is missing/empty.
 *
 * SAFETY (do not regress):
 * - NEVER $unset videoUrl (dual-read is the safety net after Sep 2026 incident).
 * - NEVER overwrite a non-empty videos[] with [].
 *
 *   node scripts/cleanup-video-url.cjs
 */
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  if (process.argv.includes("--unsafe-unset-videourl")) {
    console.error(
      "Refused: --unsafe-unset-videourl is permanently disabled (wiped shop videos in Sep 2026)."
    );
    process.exit(2);
  }

  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const col = client.db(dbName).collection("aloha_products");

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
      // Keep videoUrl; only fill videos[].
      await col.updateOne({ _id: d._id }, { $set: { videos: [url] } });
      migrated++;
    }

    console.log(`OK fill videoUrl -> videos: ${migrated} products (videoUrl preserved)`);
  } catch (err) {
    console.error("Error:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

run();
