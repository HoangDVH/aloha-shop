/**
 * Snapshot sản phẩm có video (shop DB) — chạy để baseline / so sánh khi mất video.
 * Usage: node scripts/snapshot-product-videos.cjs
 * Optional: node scripts/snapshot-product-videos.cjs --compare
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "scripts", "snapshots");
const LATEST = path.join(OUT_DIR, "product-videos-latest.json");

function hasVideo(doc) {
  const url = String(doc.videoUrl || "").trim();
  if (url) return true;
  if (Array.isArray(doc.videos)) {
    return doc.videos.some((u) => String(u || "").trim());
  }
  return false;
}

function pick(doc) {
  const videos = Array.isArray(doc.videos)
    ? doc.videos.map((u) => String(u || "").trim()).filter(Boolean)
    : [];
  const videoUrl = String(doc.videoUrl || "").trim() || videos[0] || "";
  return {
    ma: String(doc.ma || "").trim().toUpperCase(),
    ten: String(doc.ten || "").slice(0, 80),
    webBadge: doc.webBadge || null,
    videoUrl,
    videos,
    updatedAt: doc.updatedAt || null,
  };
}

async function main() {
  const compare = process.argv.includes("--compare");
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
  const dbName = process.env.SHOP_STANDALONE_DB || "aloha_shop_db";
  const c = new MongoClient(uri);
  await c.connect();
  const col = c.db(dbName).collection("aloha_products");
  const docs = await col
    .find({})
    .project({ ma: 1, ten: 1, videos: 1, videoUrl: 1, webBadge: 1, updatedAt: 1 })
    .toArray();
  const withVideo = docs.filter(hasVideo).map(pick).sort((a, b) => a.ma.localeCompare(b.ma));

  const snap = {
    at: new Date().toISOString(),
    dayLocalHint: "Asia/Ho_Chi_Minh",
    db: dbName,
    mongoUriHost: uri.replace(/\/\/.*@/, "//***@"),
    totalProducts: docs.length,
    withVideoCount: withVideo.length,
    items: withVideo,
    diagnoseIfMissing: [
      "So sánh với scripts/snapshots/product-videos-latest.json (hoặc file dated cùng thư mục).",
      "Nếu mã mất video: check shop + ops aloha_products cùng ma — videos/videoUrl.",
      "KV stock poll / catalog sync KHÔNG được ghi đè video (đã delete field). Nếu null → do patch-videos rỗng hoặc ghi document khác.",
      "Garden patch-videos: POST /api/aloha/products/patch-videos — kiểm tra mirror VPS + SHOP_CATALOG_NOTIFY.",
      "Gắn lại video rồi chạy lại script này; count phải tăng.",
    ],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const day = snap.at.slice(0, 10);
  const dated = path.join(OUT_DIR, `product-videos-${day}.json`);
  fs.writeFileSync(dated, JSON.stringify(snap, null, 2), "utf8");
  fs.writeFileSync(LATEST, JSON.stringify(snap, null, 2), "utf8");

  console.log(`withVideoCount=${snap.withVideoCount} / total=${snap.totalProducts}`);
  console.log(`saved ${path.relative(ROOT, dated)}`);
  console.log(`saved ${path.relative(ROOT, LATEST)}`);
  for (const it of withVideo) {
    console.log(`- ${it.ma} | badge=${it.webBadge || "-"} | ${it.videoUrl.slice(0, 70)}`);
  }

  if (compare && fs.existsSync(LATEST)) {
    // compare already overwritten — load dated previous if any
  }

  // Compare against yesterday file if present
  const prevDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const prevPath = path.join(OUT_DIR, `product-videos-${prevDay}.json`);
  if (fs.existsSync(prevPath)) {
    const prev = JSON.parse(fs.readFileSync(prevPath, "utf8"));
    const prevSet = new Set((prev.items || []).map((x) => x.ma));
    const curSet = new Set(withVideo.map((x) => x.ma));
    const lost = [...prevSet].filter((m) => !curSet.has(m));
    const gained = [...curSet].filter((m) => !prevSet.has(m));
    console.log(`\n=== vs ${prevDay} === prev=${prev.withVideoCount} now=${snap.withVideoCount}`);
    if (lost.length) console.log("LOST:", lost.join(", "));
    if (gained.length) console.log("GAINED:", gained.join(", "));
    if (!lost.length && !gained.length) console.log("no change in ma set");
  }

  await c.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
