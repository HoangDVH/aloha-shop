/**
 * Đồng bộ productType (và type / isProcessedGoods) shop ← ops.
 * Chỉ $set field phân loại — không rename, không đụng field khác.
 *
 * Dry-run:  node scripts/sync-shop-product-type-from-ops.cjs
 * Apply:    node scripts/sync-shop-product-type-from-ops.cjs --apply
 *
 * Env:
 *   MONGO_URI (default mongodb://127.0.0.1:27018)
 *   SHOP_DB   (default aloha_shop_db)
 *   OPS_DB    (default aloha_thumua)
 */
const { MongoClient } = require("mongodb");

const APPLY = process.argv.includes("--apply");
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27018";
const shopDbName = process.env.SHOP_DB || "aloha_shop_db";
const opsDbName = process.env.OPS_DB || "aloha_thumua";

function normMa(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function resolveOpsType(doc) {
  const n = Number(doc.productType ?? doc.type);
  if (n === 1 || n === 2 || n === 3) return n;
  const loaiHang = String(doc.loaiHang || "").toLowerCase();
  const loai = String(doc.loai || "").toLowerCase();
  if (loaiHang === "combo" || loai.includes("combo")) return 1;
  if (loaiHang === "dichvu" || loaiHang === "dich_vu" || loai.includes("dịch vụ"))
    return 3;
  return 2;
}

function resolveOpsIsSx(doc) {
  const loaiHang = String(doc.loaiHang || "").toLowerCase();
  const loai = String(doc.loai || "").toLowerCase();
  if (loaiHang === "hsx" || loaiHang === "san_xuat") return true;
  if (loai.includes("sản xuất") || loai.includes("san xuat")) return true;
  if (doc.isProcessedGoods === true) return true;
  if (Array.isArray(doc.productFormulas) && doc.productFormulas.length > 0)
    return true;
  if (Array.isArray(doc.ProductFormulas) && doc.ProductFormulas.length > 0)
    return true;
  return false;
}

async function main() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  const shop = client.db(shopDbName).collection("aloha_products");
  const ops = client.db(opsDbName).collection("aloha_products");

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`URI: ${uri}`);
  console.log(`Shop: ${shopDbName} ← Ops: ${opsDbName}`);

  const opsDocs = await ops
    .find(
      {},
      {
        projection: {
          ma: 1,
          productType: 1,
          type: 1,
          loai: 1,
          loaiHang: 1,
          isProcessedGoods: 1,
          productFormulas: 1,
          ProductFormulas: 1,
        },
      }
    )
    .toArray();

  const opsByMa = new Map();
  for (const d of opsDocs) {
    const ma = normMa(d.ma);
    if (!ma) continue;
    opsByMa.set(ma, d);
  }

  const shopDocs = await shop
    .find(
      {},
      {
        projection: {
          _id: 1,
          ma: 1,
          productType: 1,
          type: 1,
          isProcessedGoods: 1,
        },
      }
    )
    .toArray();

  const stats = {
    shopTotal: shopDocs.length,
    opsMapped: opsByMa.size,
    matched: 0,
    missingInOps: 0,
    unchanged: 0,
    wouldUpdate: 0,
    updated: 0,
    typeChanges: { "1→2": 0, "2→1": 0, "→1": 0, "→2": 0, "→3": 0, other: 0 },
    setIsProcessedTrue: 0,
    clearIsProcessed: 0,
  };

  const samples = [];
  const bulk = [];

  for (const s of shopDocs) {
    const ma = normMa(s.ma);
    if (!ma) continue;
    const o = opsByMa.get(ma);
    if (!o) {
      stats.missingInOps++;
      continue;
    }
    stats.matched++;

    const nextType = resolveOpsType(o);
    const nextSx = resolveOpsIsSx(o) && nextType === 2;
    const curType = Number(s.productType);
    const curTypeField = s.type == null ? null : Number(s.type);
    const curSx = s.isProcessedGoods === true;

    const patch = {};
    if (curType !== nextType) patch.productType = nextType;
    if (curTypeField !== nextType) patch.type = nextType;

    // Chỉ bật cờ SX khi ops là SX; tắt nếu đang true nhưng ops không phải SX (hiện shop = 0 true).
    if (nextSx && !curSx) {
      patch.isProcessedGoods = true;
      stats.setIsProcessedTrue++;
    } else if (!nextSx && curSx) {
      patch.isProcessedGoods = false;
      stats.clearIsProcessed++;
    }

    if (!Object.keys(patch).length) {
      stats.unchanged++;
      continue;
    }

    stats.wouldUpdate++;
    const key =
      Number.isFinite(curType) && curType > 0
        ? `${curType}→${nextType}`
        : `→${nextType}`;
    if (stats.typeChanges[key] != null) stats.typeChanges[key]++;
    else stats.typeChanges.other++;

    if (samples.length < 12) {
      samples.push({
        ma,
        from: { productType: s.productType, type: s.type, isProcessedGoods: s.isProcessedGoods },
        to: {
          productType: patch.productType ?? s.productType,
          type: patch.type ?? s.type,
          isProcessedGoods:
            patch.isProcessedGoods !== undefined
              ? patch.isProcessedGoods
              : s.isProcessedGoods,
        },
      });
    }

    if (APPLY) {
      bulk.push({
        updateOne: {
          filter: { _id: s._id },
          update: { $set: patch },
        },
      });
    }
  }

  if (APPLY && bulk.length) {
    const chunk = 500;
    for (let i = 0; i < bulk.length; i += chunk) {
      const slice = bulk.slice(i, i + chunk);
      const r = await shop.bulkWrite(slice, { ordered: false });
      stats.updated += r.modifiedCount + r.upsertedCount;
    }
  }

  // After counts
  const countBy = async (col) => {
    const rows = await col
      .aggregate([
        { $group: { _id: "$productType", n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
  };

  const shopPt = await countBy(shop);
  const opsPt = await countBy(ops);
  const shopSx = await shop.countDocuments({
    productType: 2,
    isProcessedGoods: true,
  });
  const shopThuong = await shop.countDocuments({
    productType: 2,
    $nor: [{ isProcessedGoods: true }],
  });
  const opsSx = await ops.countDocuments({
    $or: [{ loaiHang: "hsx" }, { loai: "Hàng sản xuất" }],
  });

  console.log("\nSamples:", JSON.stringify(samples, null, 2));
  console.log("\nStats:", JSON.stringify(stats, null, 2));
  console.log("\nCounts productType shop:", shopPt);
  console.log("Counts productType ops:", opsPt);
  console.log("Shop SX (pt2+isProcessedGoods):", shopSx, "| Ops hsx/SX:", opsSx);
  console.log("Shop thường (pt2 không SX flag):", shopThuong);

  if (!APPLY) {
    console.log("\nDry-run xong. Chạy lại với --apply để ghi.");
  } else {
    console.log("\nĐã apply.");
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
