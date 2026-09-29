/**
 * Gán nhóm vận chuyển (nho / vua / to / dat_giath) theo danh mục KiotViet.
 * Ghi vào config { id: "shipping_category_size", byCategoryId } — backend đọc khi báo giá ship.
 * Nhóm con kế thừa nhóm mẹ gần nhất; để trống cột "nhom" = không gán (kế thừa/chờ báo phí).
 *
 * Xuất danh mục ra CSV để shop điền cột "nhom":
 *   node scripts/shipping-category-size.cjs export shipping-category-size.csv
 * Kiểm tra file (không ghi):
 *   node scripts/shipping-category-size.cjs import shipping-category-size.csv
 * Ghi thật:
 *   node scripts/shipping-category-size.cjs import shipping-category-size.csv --apply
 * Xem cấu hình hiện tại:
 *   node scripts/shipping-category-size.cjs list
 *
 * Env:
 *   MONGO_URI (default mongodb://127.0.0.1:27017)
 *   DB        (default OPS_DB_NAME || SHOP_STANDALONE_DB || aloha_shop_db — DB chứa categories + aloha_products)
 */
const fs = require("fs");
const { MongoClient } = require("mongodb");

const CONFIG_ID = "shipping_category_size";
const SIZES = ["nho", "vua", "to", "dat_giath"];
const SIZE_LABEL = { nho: "Nhỏ ~500g", vua: "Vừa ~3kg", to: "To ~12kg", dat_giath: "Đất/giá thể ~20kg" };

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB || process.env.OPS_DB_NAME || process.env.SHOP_STANDALONE_DB || "aloha_shop_db";

const [cmd, file] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");

const word = (w) => new RegExp(`(?<![\\p{L}\\d])(?:${w})(?![\\p{L}\\d])`, "iu");
const SUGGEST_RULES = [
  { re: word("đất sạch|đất trồng|giá thể|sỏi|đá trang trí|phân bón"), size: "dat_giath" },
  { re: word("lớn|cỡ lớn|size lớn|chậu 60|chậu 70|chậu 80"), size: "to" },
  { re: word("vừa|trung|cỡ vừa|size trung|chậu 40|chậu 50"), size: "vua" },
  { re: word("nhỏ|mini|để bàn|cỡ nhỏ|size nhỏ|hạt giống|phụ kiện"), size: "nho" },
];

function suggest(path) {
  for (const { re, size } of SUGGEST_RULES) if (re.test(path)) return size;
  return "";
}

function normName(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function flatten(raw) {
  const out = [];
  const seen = new Set();
  const push = (n, parentFallback) => {
    const categoryId = Number(n?.categoryId ?? n?.id) || 0;
    const categoryName = normName(n?.categoryName || n?.name);
    if (!categoryId || !categoryName || seen.has(categoryId)) return;
    seen.add(categoryId);
    const parentId =
      n?.parentId != null && n.parentId !== "" ? Number(n.parentId) || null : parentFallback ?? null;
    out.push({ categoryId, categoryName, parentId });
    for (const ch of n?.children || n?.Children || []) push(ch, categoryId);
  };
  for (const n of raw || []) push(n, null);
  return out;
}

function withPaths(rows) {
  const byId = new Map(rows.map((r) => [r.categoryId, r]));
  return rows.map((r) => {
    const names = [];
    const ids = [];
    let cur = r;
    const guard = new Set();
    while (cur && !guard.has(cur.categoryId)) {
      guard.add(cur.categoryId);
      names.unshift(cur.categoryName);
      ids.unshift(cur.categoryId);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
    return { ...r, path: names.join(" >> "), ancestorIds: ids };
  });
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

async function loadCategories(db) {
  const raw = await db.collection("aloha_category").find({}).toArray();
  return withPaths(flatten(raw)).sort((a, b) => a.path.localeCompare(b.path, "vi"));
}

async function loadConfigMap(db) {
  const doc = await db.collection("config").findOne({ id: CONFIG_ID });
  const map = new Map();
  for (const [k, v] of Object.entries(doc?.byCategoryId || {})) {
    if (SIZES.includes(v)) map.set(Number(k), v);
  }
  return map;
}

function effectiveSize(cat, map) {
  for (let i = cat.ancestorIds.length - 1; i >= 0; i--) {
    const hit = map.get(cat.ancestorIds[i]);
    if (hit) return hit;
  }
  return "";
}

async function productCounts(db) {
  const rows = await db
    .collection("aloha_products")
    .aggregate([
      { $match: { categoryId: { $ne: null } } },
      {
        $group: {
          _id: { $toDouble: "$categoryId" },
          total: { $sum: 1 },
          noWeight: {
            $sum: { $cond: [{ $gt: [{ $toDouble: { $ifNull: ["$trongLuong", 0] } }, 0] }, 0, 1] },
          },
        },
      },
    ])
    .toArray();
  return new Map(rows.map((r) => [Number(r._id), r]));
}

async function doExport(db) {
  if (!file) throw new Error("Thiếu tên file CSV: export <file.csv>");
  const [cats, map, counts] = await Promise.all([loadCategories(db), loadConfigMap(db), productCounts(db)]);
  const header = ["categoryId", "danhMuc", "soSP", "soSPChuaCoCan", "nhomDangApDung", "goiY", "nhom"];
  const lines = [header.join(",")];
  for (const c of cats) {
    const n = counts.get(c.categoryId);
    lines.push(
      [
        c.categoryId,
        c.path,
        n?.total || 0,
        n?.noWeight || 0,
        effectiveSize(c, map),
        suggest(c.path),
        map.get(c.categoryId) || "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  fs.writeFileSync(file, "\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");
  console.log(`Đã xuất ${cats.length} danh mục → ${file}`);
  console.log(`Điền cột "nhom" bằng một trong: ${SIZES.join(", ")} (để trống = kế thừa nhóm mẹ / chờ báo phí).`);
}

async function doImport(db) {
  if (!file) throw new Error("Thiếu tên file CSV: import <file.csv> [--apply]");
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = rows.shift()?.map((h) => h.trim()) || [];
  const idCol = header.indexOf("categoryId");
  const sizeCol = header.indexOf("nhom");
  if (idCol < 0 || sizeCol < 0) throw new Error('CSV cần có cột "categoryId" và "nhom"');

  const cats = await loadCategories(db);
  const catById = new Map(cats.map((c) => [c.categoryId, c]));
  const before = await loadConfigMap(db);
  const next = new Map();
  const errors = [];

  rows.forEach((r, i) => {
    const line = i + 2;
    const id = Number(String(r[idCol] || "").trim());
    const size = String(r[sizeCol] || "").trim().toLowerCase();
    if (!size) return;
    if (!Number.isInteger(id) || id <= 0) return errors.push(`Dòng ${line}: categoryId không hợp lệ`);
    if (!catById.has(id)) return errors.push(`Dòng ${line}: không có danh mục ${id}`);
    if (!SIZES.includes(size)) return errors.push(`Dòng ${line}: nhom "${size}" không hợp lệ (${SIZES.join("/")})`);
    next.set(id, size);
  });

  if (errors.length) {
    errors.forEach((e) => console.error(e));
    throw new Error(`${errors.length} lỗi — chưa ghi gì`);
  }

  const changes = [];
  for (const id of new Set([...before.keys(), ...next.keys()])) {
    const a = before.get(id) || "";
    const b = next.get(id) || "";
    if (a !== b) changes.push({ id, path: catById.get(id)?.path || `(đã xoá) ${id}`, from: a, to: b });
  }

  const counts = await productCounts(db);
  const bySize = Object.fromEntries(SIZES.map((s) => [s, 0]));
  let uncovered = 0;
  for (const c of cats) {
    const n = counts.get(c.categoryId)?.total || 0;
    const s = effectiveSize(c, next);
    if (s) bySize[s] += n;
    else uncovered += n;
  }

  console.log(`Danh mục được gán trực tiếp: ${next.size}. Thay đổi so với hiện tại: ${changes.length}`);
  changes.slice(0, 200).forEach((c) => console.log(`  ${c.from || "—"} → ${c.to || "—"}  ${c.path}`));
  if (changes.length > 200) console.log(`  … và ${changes.length - 200} thay đổi khác`);
  console.log("Số SP theo nhóm sau khi áp dụng (tính cả kế thừa):");
  for (const s of SIZES) console.log(`  ${SIZE_LABEL[s].padEnd(20)} ${bySize[s]}`);
  console.log(`  ${"Chưa có nhóm".padEnd(20)} ${uncovered}  (vẫn dùng cân nặng/đoán theo tên, không có thì chờ báo phí)`);

  if (!APPLY) {
    console.log("\nChạy thử — chưa ghi. Thêm --apply để ghi.");
    return;
  }
  await db.collection("config").updateOne(
    { id: CONFIG_ID },
    {
      $set: {
        id: CONFIG_ID,
        // config có unique index trên "key" (không sparse) — thiếu key sẽ đụng doc khác cũng thiếu key.
        key: CONFIG_ID,
        byCategoryId: Object.fromEntries([...next].map(([k, v]) => [String(k), v])),
        updatedAt: new Date().toISOString(),
        updatedBy: "scripts/shipping-category-size.cjs",
      },
    },
    { upsert: true }
  );
  console.log("\nĐã ghi. Backend nhận cấu hình mới trong tối đa 30 giây.");
}

async function doList(db) {
  const [cats, map] = await Promise.all([loadCategories(db), loadConfigMap(db)]);
  const catById = new Map(cats.map((c) => [c.categoryId, c]));
  if (!map.size) return console.log("Chưa gán nhóm cho danh mục nào.");
  for (const [id, s] of map) console.log(`${s.padEnd(10)} ${catById.get(id)?.path || `(không còn danh mục ${id})`}`);
}

async function main() {
  if (!["export", "import", "list"].includes(cmd)) {
    console.log("Dùng: export <file.csv> | import <file.csv> [--apply] | list");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    console.log(`DB: ${dbName}`);
    if (cmd === "export") await doExport(db);
    else if (cmd === "import") await doImport(db);
    else await doList(db);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
