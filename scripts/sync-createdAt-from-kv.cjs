/**
 * Sync ngày tạo KV → shop.createdAt (không tạo field mới; field khác giữ nguyên).
 */
const { MongoClient } = require("mongodb");
require("dotenv").config();

function parseKvDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? raw : null;
  }
  let s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) s = s.replace(" ", "T");
  s = s.replace(/(\.\d{3})\d+/, "$1");
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = `${s}Z`;
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

function pickOpsCreated(p) {
  return p.createdDate || p.CreatedDate || p.taoLuc || null;
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("missing MONGODB_URI");
  const c = new MongoClient(uri);
  await c.connect();
  const shop = c.db(process.env.SHOP_STANDALONE_DB || "aloha_shop_db");
  const ops = c.db(
    process.env.SHOP_CATEGORY_SOURCE_DB ||
      process.env.KV_CONFIG_DB ||
      "aloha_thumua"
  );

  const opsProds = await ops
    .collection("aloha_products")
    .find({})
    .project({ ma: 1, createdDate: 1, CreatedDate: 1, taoLuc: 1 })
    .toArray();
  const byMa = new Map();
  for (const p of opsProds) {
    const ma = String(p.ma || "")
      .trim()
      .toUpperCase();
    if (!ma) continue;
    byMa.set(ma, p);
  }

  const shopProds = await shop
    .collection("aloha_products")
    .find({})
    .project({ _id: 1, ma: 1, createdAt: 1 })
    .toArray();

  const opsList = [];
  let missing = 0;
  let noDate = 0;
  let same = 0;
  for (const sp of shopProds) {
    const ma = String(sp.ma || "")
      .trim()
      .toUpperCase();
    const op = byMa.get(ma);
    if (!op) {
      missing++;
      continue;
    }
    const d = parseKvDate(pickOpsCreated(op));
    if (!d) {
      noDate++;
      continue;
    }
    const nextIso = d.toISOString();
    const prev =
      sp.createdAt instanceof Date
        ? sp.createdAt.toISOString()
        : String(sp.createdAt || "");
    if (prev === nextIso) {
      same++;
      continue;
    }
    opsList.push({
      updateOne: {
        filter: { _id: sp._id },
        update: { $set: { createdAt: nextIso } },
      },
    });
  }

  let modified = 0;
  const chunk = 400;
  for (let i = 0; i < opsList.length; i += chunk) {
    const r = await shop
      .collection("aloha_products")
      .bulkWrite(opsList.slice(i, i + chunk), { ordered: false });
    modified += r.modifiedCount;
  }

  const bkh = await shop.collection("aloha_products").findOne({ ma: /BKHDV1/i });
  console.log(
    JSON.stringify(
      {
        shop: shopProds.length,
        queued: opsList.length,
        modified,
        same,
        missing,
        noDate,
        BKHDV: { ma: bkh?.ma, createdAt: bkh?.createdAt },
      },
      null,
      2
    )
  );
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
