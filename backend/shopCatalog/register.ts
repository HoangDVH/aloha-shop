import { catalogPriceContext, currentPriceMode } from "../shopWholesale/priceContext.js";
/**
 * Catalog API shop — đăng ký route + helper (tách từ shopApi.ts, hành vi giữ nguyên).
 * Entry public vẫn là server/shopApi.ts (re-export).
 */
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { redisGet, redisSet, redisReady, memoryCacheGet, memoryCacheSet, redisInvalidateShopCache } from "../redis.js";
import { syncBus } from "../syncBus.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import {
  buildCategoryPathIndex,
  buildCategoryTreeFromKv,
  flattenKvCategories,
  resolveCategoryIdsFromPathIndex,
  type CategoryNode,
} from "../utils/categoryTree.ts";
import { normalizeTrongLuongGram } from "../shopShipping/resolveWeight.js";
import { mongoLoaiFilter } from "../utils/kvProductLoai.ts";
import { normalizeWebBadge } from "./webBadge.js";
import {
  buildAxesAndModels,
  compactAttributeFacets,
  compactDvtFacetLabels,
  dedupeCanonicalPublic,
  findAttrSiblings,
  findUnitPairDocs,
  isComboOrFormulaProduct,
  mongoAttrFilter,
  mongoDvtFilter,
  normalizeAttrs,
  parseAttrQuery,
  parseDvtQuery,
  resolveShopDisplayTon,
  variantGroupKey,
} from "../shopVariantGroup.js";
import {
  applyPriceBookOverlay,
  loadPriceBooksByMa,
  overlayDocsWithPriceBooks,
  publicPrice,
  resolveShopPrice,
} from "./priceOverlay.js";
import { isShopTestBuyerEmail } from "../shopOrders/checkoutFlags.js";
import {
  availableTonAfterHold,
  subtractHeldFromPublicItems,
} from "../shopOrders/stockHold.js";
import {
  ACCESS_COOKIE,
  verifyShopAccessToken,
} from "../shopAuth/tokens.js";
import { publicProductVideos } from "./productVideoUrl.js";
import {
  loadCategoryMetaById,
  overlayProductCategoryFields,
  overlayProductCategoryFieldsMany,
} from "./categoryMeta.ts";
import {
  productCreatedMs as kvProductCreatedMs,
} from "../utils/productCreatedAt.js";
import {
  arrangeByAbsolutePin,
  resolvePinBadgeScope,
} from "./pinArrange.js";

type GetDb = () => Promise<Db>;

const COL = "aloha_products";
const INVOICES_COL = "aloha_sales_invoices";
const CTV_CLICKS_COL = "aloha_shop_ctv_clicks";
const TTL_SEC = Number(process.env.SHOP_CATALOG_TTL_SEC || 300); // 5 phút (fallback tự hết hạn kể cả khi lỡ event)
/** Cache xếp hạng bán chạy (chỉ key shop:* — không ghi aloha_products). */
const BESTSELLER_TTL_SEC = 60;
/** Cửa sổ doanh thu gần đây (ngày) — fallback toàn bộ nếu trống. */
const BESTSELLER_DAYS = 90;
/** Phạm vi facets/lọc trang chủ: Cây thành phẩm + top bán chạy. */
const HOME_CAY_THANH_PHAM_PATH = "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN";
const HOME_BESTSELLER_FACET_LIMIT = 200;
const SHOP_ORIGIN_ALLOW = [
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "https://alohathegioichaucay.com",
  "https://www.alohathegioichaucay.com",
  "http://alohathegioichaucay.com",
  "http://www.alohathegioichaucay.com",
  // Giữ subdomain cũ trong giai đoạn chuyển miền / redirect
  "https://shop.alohathegioichaucay.com",
  "http://shop.alohathegioichaucay.com",
];

function slugify(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}

/** Regex tìm không phân biệt dấu tiếng Việt (cay ≈ cây). */
function viLooseRegex(raw: string): RegExp {
  const folded = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
  const map: Record<string, string> = {
    a: "[aáàảãạăắằẳẵặâấầẩẫậ]",
    e: "[eéèẻẽẹêếềểễệ]",
    i: "[iíìỉĩị]",
    o: "[oóòỏõọôốồổỗộơớờởỡợ]",
    u: "[uúùủũụưứừửữự]",
    y: "[yýỳỷỹỵ]",
    d: "[dđ]",
  };
  let pat = "";
  for (const ch of folded) {
    if (map[ch]) pat += map[ch];
    else if (/[a-z0-9]/.test(ch)) pat += ch;
    else if (/\s/.test(ch)) pat += "\\s+";
    else pat += `\\${ch}`;
  }
  return new RegExp(pat || ".^", "i");
}

function regexEscapeLiteral(raw: string): string {
  return String(raw || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lọc nhóm hàng — ưu tiên categoryId; path chỉ dùng resolve id / ancestor / categoryName. */
function buildCategorySubtreeFilter(catList: string[]): Record<string, unknown> | null {
  const clauses: Record<string, unknown>[] = [];
  const numIds: number[] = [];

  for (const raw of catList) {
    let cat = String(raw || "").trim();
    if (!cat) continue;
    cat = cat.replace(/\s*(?:▸|>)\s*/g, " >> ");
    const num = Number(cat);
    if (Number.isFinite(num) && num > 0 && String(num) === cat.replace(/\s*>>\s*/g, "")) {
      numIds.push(num);
      continue;
    }

    const segments = cat
      .split(/\s*>>\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!segments.length) continue;

    if (segments.length === 1) {
      const seg = regexEscapeLiteral(segments[0]);
      clauses.push(
        { ancestor: { $regex: `^${seg}$`, $options: "i" } },
        { categoryName: { $regex: `^${seg}$`, $options: "i" } }
      );
    } else {
      clauses.push({
        $expr: {
          $and: segments.map((seg, i) => ({
            $eq: [
              { $toLower: { $ifNull: [{ $arrayElemAt: ["$ancestor", i] }, ""] } },
              seg.toLowerCase(),
            ],
          })),
        },
      });
      const leaf = segments[segments.length - 1];
      const leafEsc = regexEscapeLiteral(leaf);
      clauses.push({ categoryName: { $regex: `^${leafEsc}$`, $options: "i" } });
    }
  }

  if (numIds.length) {
    clauses.push({ categoryId: { $in: numIds } });
  }
  if (!clauses.length) return null;
  return { $or: clauses };
}

function parseNhomQuery(req: { query: Record<string, unknown> }): string[] {
  const raw = req.query.nhom ?? req.query.category;
  const out: string[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const s = String(x || "").trim();
      if (s) out.push(s);
    }
  } else if (raw != null && String(raw).trim()) {
    out.push(String(raw).trim());
  }
  return out;
}

/** Query categoryId (số) — khóa lọc nhóm trên DB shop mới. */
function parseCategoryIdQuery(req: { query: Record<string, unknown> }): number[] {
  const raw = req.query.categoryId ?? req.query.categoryIds;
  const out: number[] = [];
  const push = (x: unknown) => {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n));
  };
  if (Array.isArray(raw)) raw.forEach(push);
  else if (raw != null && String(raw).trim()) {
    String(raw)
      .split(/[,;\s]+/)
      .filter(Boolean)
      .forEach(push);
  }
  return [...new Set(out)];
}

/** categoryId đã chọn + mọi con trong cây categories. */
async function resolveCategoryIdsForRootIds(db: Db, rootIds: number[]): Promise<number[]> {
  if (!rootIds.length) return [];
  const { tree } = await buildShopKvCategoryTree(db);
  const idToAll = new Map<number, number[]>();
  const walk = (node: CategoryNode): number[] => {
    const self = node.categoryId ? [node.categoryId] : [];
    const childIds: number[] = [];
    for (const ch of node.children) childIds.push(...walk(ch));
    const all = [...self, ...childIds];
    if (node.categoryId) idToAll.set(node.categoryId, all);
    return all;
  };
  tree.forEach(walk);
  const out = new Set<number>();
  for (const id of rootIds) {
    const list = idToAll.get(id);
    if (list?.length) list.forEach((x) => out.add(x));
    else out.add(id);
  }
  return [...out];
}

function pathKey(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s*(?:▸|>)\s*/g, " >> ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Gom categoryId nhánh đã chọn + mọi con — khớp tab Hàng hóa. */
async function resolveCategoryIdsForPaths(db: Db, paths: string[]): Promise<number[]> {
  if (!paths.length) return [];
  const { tree } = await buildShopKvCategoryTree(db);
  const pathToIds = buildCategoryPathIndex(tree);
  const ids = new Set<number>();
  for (const raw of paths) {
    resolveCategoryIdsFromPathIndex(pathToIds, raw).forEach((id) => ids.add(id));
  }
  return [...ids];
}

type ShopNavNode = {
  id: number;
  name: string;
  path: string;
  slug: string;
  count: number;
  hasChild: boolean;
  rank: number;
  /** Ảnh SP đại diện — chỉ gắn cho node lá (đúng categoryId) */
  image?: string;
  subs: ShopNavNode[];
};

function kvNodeToShopNav(node: CategoryNode): ShopNavNode {
  return {
    id: Number(node.categoryId) || 0,
    name: node.name,
    path: node.fullPath,
    slug: slugify(node.name) || "danh-muc",
    count: node.count,
    hasChild: node.children.length > 0,
    rank: Number(node.sortOrder) || 0,
    subs: node.children.map(kvNodeToShopNav),
  };
}

/** Map categoryId → ảnh SP đầu tiên (batch, không N+1). */
async function loadCategoryImageMap(db: Db): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const rows = await db
      .collection(COL)
      .aggregate(
        [
          {
            $match: {
              $and: [
                ...((shopFilterBase().$and as object[]) || []),
                { categoryId: { $exists: true, $ne: null } },
              ],
            },
          },
          {
            $project: {
              categoryId: 1,
              anh: 1,
              img0: { $arrayElemAt: ["$images", 0] },
            },
          },
          {
            $addFields: {
              image: {
                $let: {
                  vars: {
                    a: { $trim: { input: { $ifNull: ["$anh", ""] } } },
                    b: { $trim: { input: { $ifNull: ["$img0", ""] } } },
                  },
                  in: {
                    $cond: [{ $ne: ["$$a", ""] }, "$$a", "$$b"],
                  },
                },
              },
            },
          },
          { $match: { image: { $type: "string", $ne: "" } } },
          {
            $group: {
              _id: "$categoryId",
              image: { $first: "$image" },
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray();

    for (const row of rows) {
      const id = Number((row as { _id?: unknown })._id) || 0;
      const image = String((row as { image?: unknown }).image || "").trim();
      if (id && image) map.set(id, image);
    }
  } catch {
    /* tree vẫn trả về — không ảnh hơn là 500 */
  }
  return map;
}

/** Gắn ảnh SP: lá theo categoryId; nhóm cha lấy ảnh lá con đầu tiên (chip L2). */
function attachLeafImages(
  nodes: ShopNavNode[],
  imageByCat: Map<number, string>
): ShopNavNode[] {
  return nodes.map((n) => {
    const subs = attachLeafImages(n.subs || [], imageByCat);
    const isLeaf = subs.length === 0;
    let image = isLeaf ? imageByCat.get(n.id) : undefined;
    if (!image) {
      for (const c of subs) {
        const img = String(c.image || "").trim();
        if (img) {
          image = img;
          break;
        }
      }
    }
    if (!image) image = imageByCat.get(n.id);
    return {
      ...n,
      hasChild: subs.length > 0,
      subs,
      ...(image ? { image } : {}),
    };
  });
}

/**
 * Cây nhóm + đếm SP cho shop.
 * Dùng cùng buildCategoryTreeFromKv như tab Hàng hóa, nhưng chỉ đếm SP
 * đang hiện trên shop (shopFilterBase) — khớp số "X sản phẩm" khi lọc nhóm.
 */
async function buildShopKvCategoryTree(db: Db): Promise<{ tree: CategoryNode[]; items: ShopNavNode[] }> {
  const cats = await db
    .collection("categories")
    .find({
      categoryId: { $exists: true, $ne: null },
      $expr: { $gt: [{ $toDouble: { $ifNull: ["$categoryId", 0] } }, 0] },
    })
    .sort({ rank: 1, categoryName: 1 })
    .toArray();

  const kvRows = flattenKvCategories(cats);
  const productRows = await db
    .collection(COL)
    .find({
      $and: [
        { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
        ...((shopFilterBase().$and as object[]) || []),
        { categoryId: { $exists: true, $ne: null } },
        { $expr: { $gt: [{ $toDouble: { $ifNull: ["$categoryId", 0] } }, 0] } },
      ],
    })
    .project({ ma: 1, categoryId: 1, code: 1, deletedAt: 1 })
    .toArray();

  const tree = buildCategoryTreeFromKv(kvRows, productRows);
  let imageByCat = new Map<number, string>();
  try {
    imageByCat = await loadCategoryImageMap(db);
  } catch {
    imageByCat = new Map();
  }
  const items = attachLeafImages(tree.map(kvNodeToShopNav), imageByCat);
  return { tree, items };
}

function mergeCategoryFilters(
  pathList: string[],
  categoryIds: number[]
): Record<string, unknown> | null {
  // Chỉ lọc theo categoryId (+ đã expand subtree). Path chỉ dùng để resolve id.
  if (categoryIds.length) {
    return { categoryId: { $in: categoryIds } };
  }
  // Fallback hiếm: resolve path thất bại → khớp ancestor/categoryName
  return buildCategorySubtreeFilter(pathList);
}

/**
 * Phạm vi trang chủ: Cây thành phẩm ∪ top bán chạy — chỉ đọc, không ghi Mongo.
 */
async function buildHomeScopeFilter(db: Db): Promise<Record<string, unknown> | null> {
  const ors: Record<string, unknown>[] = [];
  const catIds = await resolveCategoryIdsForPaths(db, [HOME_CAY_THANH_PHAM_PATH]);
  const allIds = catIds.length
    ? await resolveCategoryIdsForRootIds(db, catIds)
    : [];
  const catFilter = mergeCategoryFilters([HOME_CAY_THANH_PHAM_PATH], allIds);
  if (catFilter) ors.push(catFilter);

  try {
    const rank = await loadRevenueRankMap(db);
    const topMas = [...rank.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, HOME_BESTSELLER_FACET_LIMIT)
      .map(([ma]) => String(ma || "").trim().toUpperCase())
      .filter(Boolean);
    if (topMas.length) {
      const lower = topMas.map((m) => m.toLowerCase());
      ors.push({ ma: { $in: [...new Set([...topMas, ...lower])] } });
    }
  } catch {
    /* thiếu HĐ bán → vẫn lọc theo Cây thành phẩm */
  }

  if (!ors.length) return null;
  if (ors.length === 1) return ors[0];
  return { $or: ors };
}

async function mapDocsToPublicWithPriceBooks(
  db: Db,
  docs: Record<string, unknown>[]
): Promise<{
  docs: Record<string, unknown>[];
  items: ReturnType<typeof toPublicProduct>[];
}> {
  const metaById = await loadCategoryMetaById(db);
  const withCat = overlayProductCategoryFieldsMany(docs, metaById);
  const mas = withCat.map((d) => String(d.ma || "").trim()).filter(Boolean);
  const pbByMa = await loadPriceBooksByMa(db, mas);
  const overlaid = overlayDocsWithPriceBooks(withCat, pbByMa);
  const items = overlaid.map((d) => toPublicProduct(d));
  const enriched = await enrichListDisplayTons(db, overlaid, items);
  return { docs: overlaid, items: enriched };
}

/** Listing: combo/công thức thường ton=0 trên Mongo — resolve tồn bán được như PDP. */
async function enrichListDisplayTons(
  db: Db,
  docs: Record<string, unknown>[],
  items: ReturnType<typeof toPublicProduct>[]
): Promise<ReturnType<typeof toPublicProduct>[]> {
  const byMa = new Map<string, Record<string, unknown>>();
  for (const d of docs) {
    const ma = String(d.ma || "")
      .trim()
      .toUpperCase();
    if (ma) byMa.set(ma, d);
  }
  const out = items.slice();
  await Promise.all(
    out.map(async (p, i) => {
      const doc = byMa.get(String(p.ma || "").trim().toUpperCase());
      if (!doc || !isComboOrFormulaProduct(doc)) return;
      if (p.ton > 0) return;
      try {
        const ton = await resolveShopDisplayTon(db, COL, doc);
        if (ton !== p.ton) out[i] = { ...p, ton };
      } catch {
        /* giữ ton thô */
      }
    })
  );
  // Có thể bán = ton − soft-hold (giống sàn TMĐT).
  return subtractHeldFromPublicItems(db, out);
}

function publicImages(doc: Record<string, unknown>): string[] {
  const imgs = Array.isArray(doc.images)
    ? doc.images.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const anh = String(doc.anh || "").trim();
  if (anh && !imgs.includes(anh)) imgs.unshift(anh);
  return imgs.slice(0, 12);
}

/** SP public phải có ảnh — ẩn SKU test / thiếu media (vd. «T2»). */
function hasPublicImage(p: {
  anh?: string | null;
  images?: string[] | null;
}): boolean {
  if (String(p.anh || "").trim()) return true;
  return Array.isArray(p.images) && p.images.some((u) => String(u || "").trim());
}

function filterRequirePublicImage<T extends { anh?: string | null; images?: string[] | null }>(
  items: T[]
): T[] {
  return items.filter(hasPublicImage);
}

function publicTon(doc: Record<string, unknown>): number {
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon);
  return Number.isFinite(ton) ? ton : 0;
}

function categorySlug(doc: Record<string, unknown>): string {
  const path = String(
    deriveNhomPath(doc) || doc.categoryName || "san-pham"
  ).trim();
  const leaf = path.split(/\s*[▸>\/|]\s*/).filter(Boolean).pop() || path;
  return slugify(leaf) || "san-pham";
}

/** Map ảo nhom/nhomPath từ categoryName + ancestor (đã overlay từ cây categories khi đọc API). */
function deriveNhomPath(doc: Record<string, unknown>): string {
  const leaf = String(doc.categoryName || "").trim();
  const ancestor = Array.isArray(doc.ancestor)
    ? doc.ancestor.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  if (ancestor.length) {
    const last = ancestor[ancestor.length - 1] || "";
    if (leaf && last !== leaf) return [...ancestor, leaf].join(" >> ");
    return ancestor.join(" >> ");
  }
  return leaf || String(doc.nhomPath || doc.nhom || "").trim();
}

function deriveNhom(doc: Record<string, unknown>): string {
  const categoryName = String(doc.categoryName || "").trim();
  if (categoryName) return categoryName;
  const path = deriveNhomPath(doc);
  if (!path) return "";
  return path.split(/\s*[▸>\/|]\s*/).filter(Boolean).pop() || path;
}

function productSlug(doc: Record<string, unknown>): string {
  const ma = String(doc.ma || doc._id || "").trim();
  const ten = String(doc.ten || ma).trim();
  const base = slugify(ten) || "sp";
  const code = slugify(ma) || "x";
  return `${base}--${code}`;
}

function shopPath(doc: Record<string, unknown>): string {
  return `/c/${categorySlug(doc)}/p/${productSlug(doc)}`;
}

/** Field công khai — không giaVon / NCC / cost. Không ghi Mongo. */
function toPublicProduct(doc: Record<string, unknown>) {
  const ma = String(doc.ma || doc._id || "").trim();
  const ten = String(doc.ten || "").trim();
  const images = publicImages(doc);
  const videos = publicProductVideos(doc);
  const { gia, priceKind } = resolveShopPrice(doc, currentPriceMode());
  const ton = publicTon(doc);
  const trongLuongRaw = normalizeTrongLuongGram(Number(doc.trongLuong) || 0);
  const trongLuong = trongLuongRaw > 0 ? trongLuongRaw : 0;
  const attributes = normalizeAttrs(doc.attributes);
  const webPin = Number(doc.webPin);
  const webBadge = normalizeWebBadge(doc.webBadge);
  const categoryId = Number(doc.categoryId) || 0;
  const categoryName = String(doc.categoryName || "").trim();
  const nhom = deriveNhom(doc);
  const nhomPath = deriveNhomPath(doc) || nhom;
  return {
    ma,
    ten,
    dvt: String(doc.dvt || "Cái").trim() || "Cái",
    nhom,
    nhomPath,
    categoryId: categoryId > 0 ? categoryId : undefined,
    categoryName: categoryName || nhom || undefined,
    gia,
    priceKind,
    webPrice: resolveShopPrice(doc, "web").gia,
    allowBackorder: doc.allowBackorder !== false,
    ton,
    trongLuong: trongLuong > 0 ? trongLuong : undefined,
    anh: images[0] || "",
    images,
    videos: videos.length ? videos : undefined,
    barcode: String(doc.barcode || "").trim() || undefined,
    description: String(doc.description || "").trim() || undefined,
    isActive: doc.isActive !== false,
    path: shopPath(doc),
    categorySlug: categorySlug(doc),
    productSlug: productSlug(doc),
    attributes: attributes.length ? attributes : undefined,
    hasVariants: attributes.length > 0 ? true : undefined,
    webPin: Number.isFinite(webPin) && webPin > 0 ? Math.round(webPin) : undefined,
    webBadge: webBadge || undefined,
    seoTitle: String(doc.seoTitle || "").trim() || undefined,
    seoDescription: String(doc.seoDescription || "").trim() || undefined,
  };
}

/**
 * Ghim = vị trí tuyệt đối trong đúng nhãn (pinBadgeScope).
 * Scope rỗng → không áp ghim (tránh đụng chéo nhãn).
 */
function sortPublicItems(
  items: ReturnType<typeof toPublicProduct>[],
  sort: string,
  createdMsByMa?: Map<string, number>,
  pinBadgeScope?: string | null
) {
  const scope =
    pinBadgeScope !== undefined
      ? pinBadgeScope
      : resolvePinBadgeScope({ sort });
  const next = [...items];
  if (sort === "price_asc") {
    return arrangeByAbsolutePin(next, (a, b) => a.gia - b.gia, scope);
  } else if (sort === "price_desc") {
    return arrangeByAbsolutePin(next, (a, b) => b.gia - a.gia, scope);
  } else if (sort === "ton_desc") {
    return arrangeByAbsolutePin(
      next,
      (a, b) => b.ton - a.ton || a.ten.localeCompare(b.ten, "vi"),
      scope
    );
  } else if (sort === "ban_chay") {
    return arrangeByAbsolutePin(
      next,
      (a, b) => a.ten.localeCompare(b.ten, "vi"),
      scope || "ban_chay_sap_het"
    );
  } else if (sort === "giam_gia") {
    return arrangeByAbsolutePin(
      next,
      (a, b) => {
        const ga = normalizeWebBadge(a.webBadge) === "giam_gia" ? 1 : 0;
        const gb = normalizeWebBadge(b.webBadge) === "giam_gia" ? 1 : 0;
        if (gb !== ga) return gb - ga;
        return a.ten.localeCompare(b.ten, "vi");
      },
      scope || "giam_gia"
    );
  } else if (sort === "moi" || sort === "newest") {
    // «Mới» theo ngày, ưu tiên ghim nhãn moi lên các vị trí đầu
    const ts = (p: { ma?: string }) =>
      createdMsByMa?.get(normalizeMa(p.ma)) || 0;
    return arrangeByAbsolutePin(
      next,
      (a, b) => {
        const hb = ts(b) > 0 ? 1 : 0;
        const ha = ts(a) > 0 ? 1 : 0;
        if (hb !== ha) return hb - ha;
        const tb = ts(b);
        const ta = ts(a);
        if (tb !== ta) return tb - ta;
        return a.ten.localeCompare(b.ten, "vi");
      },
      scope || "moi"
    );
  }
  return arrangeByAbsolutePin(
    next,
    (a, b) => a.ten.localeCompare(b.ten, "vi"),
    scope
  );
}

/** ms ngày tạo từ shop.createdAt (đã sync KV). */
function productCreatedMs(doc: Record<string, unknown>): number {
  return kvProductCreatedMs(doc) || 0;
}

function dedupeListItems(
  docs: Record<string, unknown>[],
  items: ReturnType<typeof toPublicProduct>[]
) {
  const attrsByMa = new Map<string, ReturnType<typeof normalizeAttrs>>();
  const nhomByMa = new Map<string, string>();
  for (const d of docs) {
    const ma = String(d.ma || "").trim().toUpperCase();
    if (!ma) continue;
    attrsByMa.set(ma, normalizeAttrs(d.attributes));
    nhomByMa.set(ma, deriveNhomPath(d) || deriveNhom(d));
  }
  return dedupeCanonicalPublic(items, attrsByMa, nhomByMa);
}

function shopFilterBase(): Record<string, unknown> {
  return {
    $and: [
      { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
      {
        $or: [
          { banTrucTiep: { $ne: false } },
          { banTrucTiep: { $exists: false } },
        ],
      },
      // hienThiWeb: thiếu field = hiện (parity); chỉ ẩn khi false
      {
        $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
      },
      // Bắt buộc có ảnh (anh hoặc images[]) — tránh SKU test kiểu «T2»
      {
        $or: [
          { anh: { $type: "string", $regex: "\\S" } },
          { "images.0": { $exists: true, $nin: [null, ""] } },
        ],
      },
    ],
  };
}

/** Email từ cookie phiên shop — dùng ẩn/hiện SP giá 0đ (test). */
function requestShopBuyerEmail(req: Request): string {
  try {
    const token = String(req.cookies?.[ACCESS_COOKIE] || "").trim();
    if (!token) return "";
    return String(verifyShopAccessToken(token).email || "").trim();
  } catch {
    return "";
  }
}

function filterZeroPriceUnlessTestBuyer<T extends { gia: number; priceKind?: string }>(
  items: T[],
  buyerEmail: string
): T[] {
  if (isShopTestBuyerEmail(buyerEmail)) return items;
  return items.filter((p) => Number(p.gia) > 0 || p.priceKind === "si_missing");
}

/** Singleflight / Request coalescing cho cachedJson để triệt tiêu cache stampede khi cache miss */
const inflightProducers = new Map<string, Promise<unknown>>();

async function cachedJson(
  key: string,
  producer: () => Promise<unknown>,
  ttlSec: number = TTL_SEC
): Promise<{ body: unknown; cache: "HIT" | "MISS" | "SKIP" | "BYPASS" }> {
  key += `|pm=${currentPriceMode()}`;
  if (ttlSec <= 0) {
    return { body: await producer(), cache: "BYPASS" };
  }
  const ok = await redisReady();
  if (ok) {
    const hit = await redisGet(key);
    if (hit) {
      try {
        return { body: JSON.parse(hit), cache: "HIT" };
      } catch {
        /* fall through */
      }
    }
  } else {
    // RAM Memory Cache Fallback khi Redis không khả dụng
    const memHit = memoryCacheGet(key);
    if (memHit) {
      try {
        return { body: JSON.parse(memHit), cache: "HIT" };
      } catch {
        /* fall through */
      }
    }
  }

  // Request coalescing: Nếu đang có request cùng key chạy producer, các request đến sau chờ chung 1 Promise
  let p = inflightProducers.get(key);
  if (!p) {
    p = (async () => {
      try {
        const res = await producer();
        const strVal = JSON.stringify(res);
        if (ok) {
          await redisSet(key, strVal, ttlSec);
        } else {
          memoryCacheSet(key, strVal, ttlSec);
        }
        return res;
      } finally {
        inflightProducers.delete(key);
      }
    })();
    inflightProducers.set(key, p);
  }

  const body = await p;
  return { body, cache: "MISS" };
}

function normalizeMa(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

function normalizeCtvCode(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

function isValidCtvCode(code: string): boolean {
  const c = normalizeCtvCode(code);
  return c.length >= 3 && c.length <= 20;
}

/** Tránh lưu IP thô: chỉ lưu hash nhẹ. */
function hashIpFvn1a32(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Xếp hạng SP theo doanh thu HĐ bán (qty × giá − CK dòng).
 * CHỈ ĐỌC aloha_sales_invoices — không update sản phẩm / store nội bộ.
 */
export async function loadRevenueRankMap(db: Db): Promise<Map<string, number>> {
  const cacheKey = `shop:bestsellers:revenue:v1:d${BESTSELLER_DAYS}`;
  const { body } = await cachedJson(
    cacheKey,
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - BESTSELLER_DAYS);
      const sinceIso = since.toISOString();

      const cancelRx = /cancel|void|huy|hủy|đã hủy|da huy/i;
      const pipeline = (withDate: boolean) => {
        const match: Record<string, unknown> = {
          isDraft: { $ne: true },
          $and: [
            {
              $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            },
            {
              $or: [
                { statusValue: { $exists: false } },
                { statusValue: null },
                { statusValue: { $not: cancelRx } },
              ],
            },
            {
              $or: [
                { status: { $exists: false } },
                { status: null },
                { status: { $nin: [3, "3", "Cancelled", "Void"] } },
              ],
            },
          ],
        };
        if (withDate) {
          (match.$and as unknown[]).push({
            $or: [
              { purchaseDate: { $gte: sinceIso } },
              { createdDate: { $gte: sinceIso } },
              { createdAt: { $gte: sinceIso } },
            ],
          });
        }
        return [
          { $match: match },
          {
            $project: {
              lines: {
                $cond: [
                  {
                    $gt: [
                      { $size: { $ifNull: ["$invoiceDetails", []] } },
                      0,
                    ],
                  },
                  "$invoiceDetails",
                  { $ifNull: ["$items", []] },
                ],
              },
            },
          },
          { $unwind: "$lines" },
          {
            $project: {
              ma: {
                $toUpper: {
                  $trim: {
                    input: {
                      $toString: {
                        $ifNull: [
                          "$lines.productCode",
                          { $ifNull: ["$lines.ma", "$lines.code"] },
                        ],
                      },
                    },
                  },
                },
              },
              qty: {
                $convert: {
                  input: { $ifNull: ["$lines.quantity", { $ifNull: ["$lines.sl", 0] }] },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
              price: {
                $convert: {
                  input: {
                    $ifNull: [
                      "$lines.price",
                      { $ifNull: ["$lines.gia", { $ifNull: ["$lines.giaBan", 0] }] },
                    ],
                  },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
              discount: {
                $convert: {
                  input: { $ifNull: ["$lines.discount", 0] },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
          { $match: { ma: { $nin: ["", "NULL", "UNDEFINED"] } } },
          {
            $group: {
              _id: "$ma",
              revenue: {
                $sum: {
                  $max: [
                    0,
                    {
                      $subtract: [{ $multiply: ["$qty", "$price"] }, "$discount"],
                    },
                  ],
                },
              },
            },
          },
          { $match: { revenue: { $gt: 0 } } },
          { $sort: { revenue: -1 } },
          { $limit: 3000 },
        ];
      };

      const col = db.collection(INVOICES_COL);
      let rows = await col
        .aggregate(pipeline(true), { allowDiskUse: true, maxTimeMS: 25000 })
        .toArray();
      if (!rows.length) {
        rows = await col
          .aggregate(pipeline(false), { allowDiskUse: true, maxTimeMS: 25000 })
          .toArray();
      }
      return {
        items: rows.map((r) => ({
          ma: String((r as { _id?: string })._id || ""),
          revenue: Number((r as { revenue?: number }).revenue) || 0,
        })),
        at: Date.now(),
        days: BESTSELLER_DAYS,
      };
    },
    BESTSELLER_TTL_SEC
  );

  const map = new Map<string, number>();
  const items = (body as { items?: { ma: string; revenue: number }[] })?.items || [];
  for (const it of items) {
    const ma = normalizeMa(it.ma);
    if (ma && it.revenue > 0) map.set(ma, it.revenue);
  }
  return map;
}

function setCors(req: Request, res: Response) {
  const origin = String(req.headers.origin || "");
  if (origin && SHOP_ORIGIN_ALLOW.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    /* same-origin / server fetch */
  } else if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (origin && (SHOP_ORIGIN_ALLOW.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

function parseMaFromProductSlug(slug: string): string | null {
  const s = String(slug || "").trim();
  if (!s) return null;
  const idx = s.lastIndexOf("--");
  if (idx >= 0) {
    const code = s.slice(idx + 2).trim();
    return code || null;
  }
  return null;
}

/** Heuristic: slugify(ma) may keep hyphens — recover by matching DB. */
async function findByProductSlug(db: Db, slug: string) {
  const raw = String(slug || "").trim();
  const codePart = parseMaFromProductSlug(raw);
  const col = db.collection(COL);
  const active = shopFilterBase();

  if (codePart) {
    const variants = [
      codePart,
      codePart.toUpperCase(),
      codePart.toLowerCase(),
      codePart.replace(/-/g, "").toUpperCase(),
      codePart.replace(/-/g, "").toLowerCase(),
    ];
    for (const ma of [...new Set(variants)]) {
      if (!ma) continue;
      const doc = await col.findOne({
        $and: [
          ...(active.$and as object[]),
          { $or: [{ ma }, { _id: ma }] },
        ],
      } as any);
      if (doc) return doc;
    }
  }

  const want = (codePart || raw).toLowerCase();
  const docs = await col
    .find(active as any)
    .project({
      ma: 1,
      ten: 1,
      categoryId: 1,
      categoryName: 1,
      ancestor: 1,
      giaWeb: 1, giaSi: 1, allowBackorder: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      anh: 1,
      images: 1,
      videos: 1,
      videoUrl: 1,
      ton: 1,
      onHand: 1,
      kvTon: 1,
      dvt: 1,
      barcode: 1,
      description: 1,
      isActive: 1,
      banTrucTiep: 1,
    })
    .limit(5000)
    .toArray();
  for (const d of docs) {
    const pub = toPublicProduct(d as any);
    if (pub.productSlug === raw || slugify(String((d as any).ma || "")) === want) {
      return d;
    }
  }
  return null;
}

export function registerShopApi(
  app: Express,
  getDb: GetDb,
  getShopDb?: GetDb,
  _getCatalogSourceDb?: GetDb
) {
  /** Catalog/SP shop ưu tiên shop DB khi có getShopDb. */
  const catalogDb = getShopDb || getDb;
  app.use(["/api/shop/products", "/api/shop/facets", "/api/shop/resolve"], catalogPriceContext(catalogDb));
  app.options("/api/shop/*", (req, res) => {
    setCors(req, res);
    res.status(204).end();
  });

  app.get("/api/shop/health", async (req, res) => {
    setCors(req, res);
    const redis = await redisReady();
    res.json({ ok: true, redis, at: Date.now() });
  });

  app.get("/api/shop/categories", async (req, res) => {
    setCors(req, res);
    try {
      const { body, cache } = await cachedJson("shop:categories:v4", async () => {
        const db = await catalogDb();
        const { tree } = await buildShopKvCategoryTree(db);
        const items: Array<{
          name: string;
          path: string;
          slug: string;
          count: number;
        }> = [];
        const walk = (nodes: CategoryNode[], prefix: string[]) => {
          for (const n of nodes) {
            const name = String(n.name || "").trim() || "Khác";
            const pathSegs = [...prefix, name];
            const path = pathSegs.join(" >> ");
            const leaf = name;
            items.push({
              name,
              path,
              slug: slugify(leaf) || "khac",
              count: Number((n as typeof n & { productCount?: number }).productCount ?? n.count ?? 0) || 0,
            });
            if (n.children?.length) walk(n.children, pathSegs);
          }
        };
        walk(tree, []);
        items.sort((a, b) => b.count - a.count);
        return { items: items.slice(0, 200) };
      });
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "categories_failed" });
    }
  });

  app.get("/api/shop/category-tree", async (req, res) => {
    setCors(req, res);
    try {
      const { body, cache } = await cachedJson("shop:category-tree:v12", async () => {
        const db = await catalogDb();
        const { items } = await buildShopKvCategoryTree(db);
        return { items };
      });
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "category_tree_failed" });
    }
  });

  app.get("/api/shop/products", async (req, res) => {
    setCors(req, res);
    try {
      const q = String(req.query.q || "").trim();
      const nhomList = parseNhomQuery(req);
      const categoryIdList = parseCategoryIdQuery(req);
      const homeScope = String(req.query.home || "") === "1";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 24));
      const minPrice = Math.max(0, Number(req.query.minPrice) || 0);
      const maxPrice = Math.max(0, Number(req.query.maxPrice) || 0);
      const inStock = String(req.query.inStock || "") === "1";
      const maxTon = Math.max(0, Math.min(999, Number(req.query.maxTon) || 0));
      const attrFilters = parseAttrQuery(req.query.attr);
      const dvtFilters = parseDvtQuery(req.query.dvt);
      const loai = String(req.query.loai || "").trim();
      const badgeRaw = String(req.query.badge || req.query.webBadge || "").trim();
      const badge = normalizeWebBadge(badgeRaw);
      const sortRaw = String(req.query.sort || "ban_chay").trim();
      const sort =
        sortRaw === "bestsellers" || sortRaw === "ban-chay"
          ? "ban_chay"
          : sortRaw === "newest"
            ? "moi"
            : sortRaw === "ten" || sortRaw === "ton_desc"
              ? "ban_chay"
              : sortRaw;
      const skip = (page - 1) * limit;
      const buyerEmail = requestShopBuyerEmail(req);
      const showZeroPrice = isShopTestBuyerEmail(buyerEmail);
      const needPostFilter =
        minPrice > 0 ||
        maxPrice > 0 ||
        inStock ||
        maxTon > 0 ||
        sort !== "ten" ||
        attrFilters.length > 0 ||
        dvtFilters.length > 0 ||
        Boolean(loai);
      const cacheKey = `shop:products:v37:${q}|cid=${categoryIdList.join(",")}|${nhomList.join("||")}|home=${homeScope ? 1 : 0}|badge=${badge}|${page}|${limit}|${minPrice}|${maxPrice}|${inStock}|maxTon=${maxTon}|${sort}|${attrFilters.map((a) => `${a.attributeName}:${a.attributeValue}`).join(";")}|${dvtFilters.join(",")}|${loai}|z=${showZeroPrice ? 1 : 0}`;
      const pinScope = resolvePinBadgeScope({ sort, badge, maxTon });

      const { body, cache } = await cachedJson(cacheKey, async () => {
        const db = await catalogDb();
        const filter: Record<string, unknown> = { ...shopFilterBase() };
        const and = [...((filter.$and as unknown[]) || [])];
        if (q) {
          const rx = viLooseRegex(q);
          and.push({
            $or: [
              { ma: rx },
              { ten: rx },
              { barcode: rx },
              { categoryName: rx },
              { ancestor: rx },
            ],
          });
        }
        if (categoryIdList.length) {
          const catIds = await resolveCategoryIdsForRootIds(db, categoryIdList);
          if (catIds.length) and.push({ categoryId: { $in: catIds } });
        } else if (nhomList.length) {
          const catIds = await resolveCategoryIdsForPaths(db, nhomList);
          const catFilter = mergeCategoryFilters(nhomList, catIds);
          if (catFilter) and.push(catFilter);
        } else if (homeScope) {
          const homeFilter = await buildHomeScopeFilter(db);
          if (homeFilter) and.push(homeFilter);
        }
        if (maxTon > 0) {
          and.push({
            $or: [
              { ton: { $gt: 0, $lte: maxTon } },
              { onHand: { $gt: 0, $lte: maxTon } },
              { kvTon: { $gt: 0, $lte: maxTon } },
            ],
          });
        } else if (inStock) {
          and.push({
            $or: [{ ton: { $gt: 0 } }, { onHand: { $gt: 0 } }, { kvTon: { $gt: 0 } }],
          });
        }
        const attrMongo = mongoAttrFilter(attrFilters);
        if (attrMongo) and.push(attrMongo);
        const dvtMongo = mongoDvtFilter(dvtFilters);
        if (dvtMongo) and.push(dvtMongo);
        const loaiMongo = mongoLoaiFilter(loai);
        if (loaiMongo) and.push(loaiMongo);
        if (badge === "ban_chay_sap_het") {
          and.push({ webBadge: { $in: ["ban_chay_sap_het", "ban_chay"] } });
        } else if (badge) {
          and.push({ webBadge: badge });
        }
        filter.$and = and;

        const col = db.collection(COL);
        const projection = {
          ma: 1,
          ten: 1,
          dvt: 1,
          categoryId: 1,
          categoryName: 1,
          ancestor: 1,
          attributes: 1,
          giaWeb: 1, giaSi: 1, allowBackorder: 1,
          giaBan: 1,
          giaChung: 1,
          basePrice: 1,
          anh: 1,
          images: 1,
          videos: 1,
          videoUrl: 1,
          ton: 1,
          onHand: 1,
          kvTon: 1,
          barcode: 1,
          description: 1,
          isActive: 1,
          banTrucTiep: 1,
          trongLuong: 1,
          webPin: 1,
          webBadge: 1,
          kvId: 1,
          id: 1,
          createdAt: 1,
        };

        /** Bán chạy = xếp theo doanh thu HĐ (chỉ đọc). Không ghi aloha_products.
         *  Có lọc giá/ĐVT/attr/loại → đi path post-filter.
         *  inStock / maxTon vẫn dùng fast path (đã lọc sau khi rank doanh thu). */
        const banChayFastPath =
          sort === "ban_chay" &&
          !(
            minPrice > 0 ||
            maxPrice > 0 ||
            attrFilters.length > 0 ||
            dvtFilters.length > 0 ||
            Boolean(loai)
          );
        if (banChayFastPath) {
          const rank = await loadRevenueRankMap(db);
          const rankedMas = [...rank.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([ma]) => ma);

          if (rankedMas.length) {
            // Pins are absolute within the eligible list, including products
            // without revenue. Never paginate either group before applying pins.
            // Preserve the low-stock rule: only revenue-ranked products qualify.
            const eligibleFilter = maxTon > 0
              ? {
                  $and: [
                    ...and,
                    { $expr: { $in: [{ $toUpper: { $ifNull: ["$ma", ""] } }, rankedMas] } },
                  ],
                }
              : filter;
            const eligibleDocs = await col
              .find(eligibleFilter as any)
              .project(projection)
              .toArray();
            const mapped = await mapDocsToPublicWithPriceBooks(db, eligibleDocs as any[]);
            let items = dedupeListItems(mapped.docs, mapped.items);
            if (minPrice > 0) items = items.filter((p) => p.gia >= minPrice);
            if (maxPrice > 0) items = items.filter((p) => p.gia <= maxPrice);
            if (inStock) items = items.filter((p) => p.ton > 0);
            if (maxTon > 0) items = items.filter((p) => p.ton > 0 && p.ton <= maxTon);
            items = filterRequirePublicImage(items);
            const ranked = items.filter((p) => rank.has(normalizeMa(p.ma))).length;
            items = arrangeByAbsolutePin(
              items,
              (a, b) => {
                const ma = normalizeMa(a.ma);
                const mb = normalizeMa(b.ma);
                // Keep ranked products ahead of unranked products, even if a
                // revenue entry is zero/negative (e.g. after returns).
                const group = Number(rank.has(mb)) - Number(rank.has(ma));
                if (group) return group;
                const revenue = (rank.get(mb) || 0) - (rank.get(ma) || 0);
                return revenue || a.ten.localeCompare(b.ten, "vi") || ma.localeCompare(mb);
              },
              badge || "ban_chay_sap_het"
            );
            const total = items.length;
            return {
              items: items.slice(skip, skip + limit),
              total,
              page,
              limit,
              pages: Math.max(1, Math.ceil(total / limit)),
              sortMode: "ban_chay",
              ranked,
            };
          }
          // Chưa có HĐ doanh thu → xếp theo tên (không dùng tồn)
        }

        if (!needPostFilter) {
          // Khi limit === 1 (ví dụ preview đếm), nếu không có post-filter phức tạp, chỉ count và lấy 1 item
          if (limit === 1 && page === 1) {
            const [total, sampleDocs] = await Promise.all([
              col.countDocuments(filter as any),
              col.find(filter as any).project(projection).limit(1).toArray(),
            ]);
            const sampleMapped = await mapDocsToPublicWithPriceBooks(db, sampleDocs as any[]);
            const sampleItems = filterRequirePublicImage(
              filterZeroPriceUnlessTestBuyer(
                dedupeListItems(sampleMapped.docs, sampleMapped.items),
                buyerEmail
              )
            );
            return {
              items: sampleItems.slice(0, 1),
              total,
              page: 1,
              limit: 1,
              pages: Math.max(1, total),
            };
          }

          // Quét đủ rồi dedupe → total/pages khớp số card (shop ~3k SP)
          const docs = await col
            .find(filter as any)
            .project(projection)
            .sort({ ten: 1 })
            .limit(5000)
            .toArray();
          const mapped = await mapDocsToPublicWithPriceBooks(db, docs as any[]);
          const createdMsByMa = new Map<string, number>();
          for (const d of mapped.docs as Record<string, unknown>[]) {
            const ma = normalizeMa(d.ma);
            if (!ma) continue;
            const ms = productCreatedMs(d);
            const prev = createdMsByMa.get(ma) || 0;
            if (ms >= prev) createdMsByMa.set(ma, ms);
          }
          const all = filterRequirePublicImage(
            filterZeroPriceUnlessTestBuyer(
              sortPublicItems(
                dedupeListItems(mapped.docs, mapped.items),
                sort,
                createdMsByMa,
                pinScope
              ),
              buyerEmail
            )
          );
          const total = all.length;
          return {
            items: all.slice(skip, skip + limit),
            total,
            page,
            limit,
            pages: Math.max(1, Math.ceil(total / limit)),
          };
        }

        // Lọc giá / sort phức tạp trên bản công khai (sau khi map giá web + price books)
        // Tối ưu: Khi chỉ preview đếm kết quả (limit: 1 và page: 1), chỉ cần project các trường tối thiểu cần thiết để lọc
        const docs = await col
          .find(filter as any)
          .project(limit === 1 && page === 1 ? { ma: 1, ten: 1, giaWeb: 1, giaBan: 1, basePrice: 1, ton: 1, onHand: 1, kvTon: 1, anh: 1, images: 1, categoryId: 1, createdAt: 1 } : projection)
          .limit(5000)
          .toArray();
        const mapped = await mapDocsToPublicWithPriceBooks(db, docs as any[]);
        let items = filterZeroPriceUnlessTestBuyer(
          dedupeListItems(mapped.docs, mapped.items),
          buyerEmail
        );
        if (minPrice > 0) items = items.filter((p) => p.gia >= minPrice);
        if (maxPrice > 0) items = items.filter((p) => p.gia <= maxPrice);
        if (inStock) items = items.filter((p) => p.ton > 0);
        if (maxTon > 0) {
          items = items.filter((p) => p.ton > 0 && p.ton <= maxTon);
        }
        items = filterRequirePublicImage(items);

        // Khi preview đếm (limit: 1), bỏ qua sắp xếp tốn kém
        if (limit === 1 && page === 1) {
          const total = items.length;
          return {
            items: items.slice(0, 1),
            total,
            page: 1,
            limit: 1,
            pages: Math.max(1, total),
            sortMode: sort,
          };
        }

        const createdMsByMa = new Map<string, number>();
        for (const d of mapped.docs as Record<string, unknown>[]) {
          const ma = normalizeMa(d.ma);
          if (!ma) continue;
          const ms = productCreatedMs(d);
          const prev = createdMsByMa.get(ma) || 0;
          if (ms >= prev) createdMsByMa.set(ma, ms);
        }
        items = sortPublicItems(items, sort, createdMsByMa, pinScope);

        const total = items.length;
        const pageItems = items.slice(skip, skip + limit);
        return {
          items: pageItems,
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
          sortMode: sort,
        };
      }, TTL_SEC);
      if (cache === "BYPASS") {
        res.setHeader("Cache-Control", "no-store");
      } else {
        res.setHeader(
          "Cache-Control",
          `public, max-age=0, s-maxage=${TTL_SEC}, stale-while-revalidate=60, must-revalidate`
        );
      }
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "products_failed" });
    }
  });

  /** Giá hiện tại theo mã — không cache (dùng làm mới giỏ/checkout). */
  app.options("/api/shop/products/prices", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.post("/api/shop/products/prices", async (req, res) => {
    setCors(req, res);
    try {
      const raw: unknown[] = Array.isArray(req.body?.mas) ? req.body.mas : [];
      const mas = [
        ...new Set(
          raw
            .map((x: unknown) => String(x || "").trim().toUpperCase())
            .filter(Boolean)
            .slice(0, 80)
        ),
      ];
      if (!mas.length) {
        res.json({ items: [] });
        return;
      }
      const db = await catalogDb();
      const docs = await db
        .collection(COL)
        .find({
          $and: [
            ...(shopFilterBase().$and as object[]),
            {
              $or: [
                { ma: { $in: mas } },
                { ma: { $in: mas.map((m) => m.toLowerCase()) } },
              ],
            },
          ],
        } as any)
        .project({
          ma: 1,
          ten: 1,
          dvt: 1,
          anh: 1,
          images: 1,
          videos: 1,
          videoUrl: 1,
          giaWeb: 1, giaSi: 1, allowBackorder: 1,
          giaBan: 1,
          giaChung: 1,
          basePrice: 1,
          trongLuong: 1,
          ton: 1,
          onHand: 1,
          kvTon: 1,
          categoryId: 1,
          categoryName: 1,
          ancestor: 1,
          isActive: 1,
          type: 1,
          productType: 1,
          loai: 1,
          hasFormula: 1,
          productFormulas: 1,
          formulas: 1,
          hangThanhPhan: 1,
          attributes: 1,
        })
        .toArray();

      const byMa = new Map<string, Record<string, unknown>>();
      for (const d of docs) {
        const key = String((d as any).ma || "").trim().toUpperCase();
        if (key) byMa.set(key, d as any);
      }

      const pbByMa = await loadPriceBooksByMa(db, mas);
      const metaById = await loadCategoryMetaById(db);
      const items: Array<ReturnType<typeof toPublicProduct>> = [];
      for (const ma of mas) {
        const raw = byMa.get(ma);
        if (!raw) continue;
        const doc = applyPriceBookOverlay(
          overlayProductCategoryFields(raw, metaById),
          pbByMa.get(ma)
        );
        const p = toPublicProduct(doc);
        let ton = p.ton;
        if (ton <= 0 && isComboOrFormulaProduct(doc)) {
          ton = await resolveShopDisplayTon(db, COL, doc);
        }
        items.push({
          ...p,
          ma: p.ma,
          gia: p.gia,
          priceKind: p.priceKind,
          allowBackorder: p.allowBackorder,
          ton,
          ten: p.ten,
          anh: p.anh,
          path: p.path,
          dvt: p.dvt,
          trongLuong: p.trongLuong,
          attributes: p.attributes,
          isActive: p.isActive,
        });
      }

      res.setHeader("Cache-Control", "no-store");
      res.json({ items: await subtractHeldFromPublicItems(db, items) });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "prices_failed" });
    }
  });

  app.get("/api/shop/facets", async (req, res) => {
    setCors(req, res);
    try {
      const q = String(req.query.q || "").trim();
      const nhomList = parseNhomQuery(req);
      const categoryIdList = parseCategoryIdQuery(req);
      const homeScope = String(req.query.home || "") === "1";
      /** Trang «Tất cả sản phẩm» (/tim) — facets toàn catalog. */
      const allCatalog = String(req.query.all || "") === "1";
      const badgeRaw = String(req.query.badge || req.query.webBadge || "").trim();
      const badge = normalizeWebBadge(badgeRaw);
      // Không có mục/từ khóa → không dump cả shop; trang chủ dùng home=1; /tim dùng all=1
      const scoped =
        categoryIdList.length > 0 ||
        nhomList.length > 0 ||
        Boolean(q) ||
        homeScope ||
        allCatalog ||
        Boolean(badge);
      const cacheKey = `shop:facets:v7:${q}|cid=${categoryIdList.join(",")}|${nhomList.join("||")}|home=${homeScope ? 1 : 0}|all=${allCatalog ? 1 : 0}|badge=${badge}|${scoped ? "1" : "0"}`;
      const { body, cache } = await cachedJson(cacheKey, async () => {
        if (!scoped) {
          return { attributes: {}, dvt: ["Cái", "Cây", "Thùng", "Gói", "Bao"] };
        }
        const db = await catalogDb();
        const and = [...((shopFilterBase().$and as unknown[]) || [])];
        if (q) {
          const rx = viLooseRegex(q);
          and.push({
            $or: [
              { ma: rx },
              { ten: rx },
              { barcode: rx },
              { categoryName: rx },
              { ancestor: rx },
            ],
          });
        }
        if (badge === "ban_chay_sap_het") {
          and.push({ webBadge: { $in: ["ban_chay_sap_het", "ban_chay"] } });
        } else if (badge) {
          and.push({ webBadge: badge });
        }
        if (categoryIdList.length) {
          const catIds = await resolveCategoryIdsForRootIds(db, categoryIdList);
          if (catIds.length) and.push({ categoryId: { $in: catIds } });
        } else if (nhomList.length) {
          const catIds = await resolveCategoryIdsForPaths(db, nhomList);
          const catFilter = mergeCategoryFilters(nhomList, catIds);
          if (catFilter) and.push(catFilter);
        } else if (homeScope) {
          const homeFilter = await buildHomeScopeFilter(db);
          if (homeFilter) and.push(homeFilter);
        }
        // allCatalog: chỉ shopFilterBase — toàn bộ SP đang bán
        const match = { $and: and };
        const attrLimit = allCatalog ? 1200 : 500;
        const dvtLimit = allCatalog ? 120 : 80;
        const [attrRows, dvtRows] = await Promise.all([
          db
            .collection(COL)
            .aggregate([
              { $match: match },
              { $unwind: { path: "$attributes", preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: {
                    n: {
                      $ifNull: ["$attributes.attributeName", { $ifNull: ["$attributes.name", ""] }],
                    },
                    v: {
                      $ifNull: [
                        "$attributes.attributeValue",
                        { $ifNull: ["$attributes.value", ""] },
                      ],
                    },
                  },
                  c: { $sum: 1 },
                },
              },
              { $match: { "_id.n": { $nin: [null, ""] }, "_id.v": { $nin: [null, ""] } } },
              { $sort: { c: -1 } },
              { $limit: attrLimit },
            ])
            .toArray(),
          db
            .collection(COL)
            .aggregate([
              { $match: match },
              { $group: { _id: { $ifNull: ["$dvt", "Cái"] }, c: { $sum: 1 } } },
              { $match: { _id: { $nin: [null, ""] } } },
              { $sort: { c: -1 } },
              { $limit: dvtLimit },
            ])
            .toArray(),
        ]);
        const attributes = compactAttributeFacets(
          attrRows.map((row) => ({
            name: String((row as any)?._id?.n || "").trim(),
            value: String((row as any)?._id?.v || "").trim(),
            count: Number((row as any)?.c) || 0,
          })),
          allCatalog
            ? { maxAttrs: 18, maxValues: 36 }
            : { maxAttrs: 10, maxValues: 24 }
        );
        const dvt = compactDvtFacetLabels(
          dvtRows.map((r) => ({
            label: String((r as any)._id || "").trim(),
            count: Number((r as any).c) || 0,
          })),
          allCatalog ? 24 : 10
        );
        return { attributes, dvt };
      }, 30);
      res.setHeader("X-Shop-Cache", cache);
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "facets_failed" });
    }
  });

  /** Biến thể + ĐVT — chỉ đọc Mongo. */
  app.get("/api/shop/products/:ma/variants", async (req, res) => {
    setCors(req, res);
    try {
      const ma = String(req.params.ma || "").trim();
      if (!ma) {
        res.status(400).json({ error: "missing_ma" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      const db = await catalogDb();
      const seed = await db.collection(COL).findOne({
        $and: [
          ...(shopFilterBase().$and as object[]),
          {
            $or: [
              { ma },
              { ma: ma.toUpperCase() },
              { ma: ma.toLowerCase() },
              { _id: ma },
            ],
          },
        ],
      } as any);
      if (!seed) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const attrSiblings = await findAttrSiblings(db, COL, seed as any, 40);
      const unitPair = await findUnitPairDocs(db, COL, seed as any);
      const byMa = new Map<string, Record<string, unknown>>();
      for (const d of [...attrSiblings, ...unitPair]) {
        const k = String(d.ma || "").trim().toUpperCase();
        if (k) byMa.set(k, d);
      }
      const rawDocs = [...byMa.values()];
      const metaById = await loadCategoryMetaById(db);
      const alignedDocs = overlayProductCategoryFieldsMany(rawDocs, metaById);
      const pbByMa = await loadPriceBooksByMa(
        db,
        alignedDocs.map((d) => String(d.ma || "").trim())
      );
      const docs = overlayDocsWithPriceBooks(alignedDocs, pbByMa);
      byMa.clear();
      for (const d of docs) {
        const k = String(d.ma || "").trim().toUpperCase();
        if (k) byMa.set(k, d);
      }
      const packed = buildAxesAndModels(docs, toPublicProduct as any, String((seed as any).ma || ma));
      // Chỉ combo/công thức (ton=0): gắn tồn hiển thị — không đụng mã thường hết hàng.
      const models: typeof packed.models = [];
      for (const m of packed.models) {
        const src = byMa.get(m.ma.toUpperCase());
        if (!src || !isComboOrFormulaProduct(src) || m.ton > 0) {
          models.push(m);
          continue;
        }
        const ton = await resolveShopDisplayTon(db, COL, src, docs);
        models.push(ton !== m.ton ? { ...m, ton } : m);
      }
      const modelsAvail = await subtractHeldFromPublicItems(db, models);
      const currentMa = String(packed.current?.ma || (seed as any).ma || ma).toUpperCase();
      const current =
        modelsAvail.find((m) => m.ma.toUpperCase() === currentMa) ||
        (packed.current
          ? (await subtractHeldFromPublicItems(db, [packed.current]))[0]
          : null);
      // Chỉ trả khi có gì để chọn
      const useful =
        packed.axes.length > 0 &&
        (modelsAvail.length > 1 ||
          packed.axes.some((a) => a.values.length > 1) ||
          (normalizeAttrs((seed as any).attributes).length > 0 && packed.axes.length > 0));
      res.json({
        ok: true,
        current: current || null,
        axes: useful ? packed.axes : [],
        models: useful ? modelsAvail : current ? [current] : [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "variants_failed" });
    }
  });

  app.get("/api/shop/products/:ma", async (req, res) => {
    setCors(req, res);
    try {
      const ma = String(req.params.ma || "").trim();
      if (!ma) {
        res.status(400).json({ error: "missing_ma" });
        return;
      }
      // Không Redis — giá/tồn phải khớp Mongo ngay (giỏ/search đã no-cache).
      res.setHeader("Cache-Control", "no-store");
      const db = await catalogDb();
      const doc = await db.collection(COL).findOne({
        $and: [
          ...(shopFilterBase().$and as object[]),
          {
            $or: [
              { ma },
              { ma: ma.toUpperCase() },
              { ma: ma.toLowerCase() },
              { _id: ma },
              { _id: ma.toUpperCase() },
            ],
          },
        ],
      } as any);
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const maKey = String((doc as any).ma || ma).trim().toUpperCase();
      const pbByMa = await loadPriceBooksByMa(db, [maKey]);
      const metaById = await loadCategoryMetaById(db);
      const overlaid = applyPriceBookOverlay(
        overlayProductCategoryFields(doc as any, metaById),
        pbByMa.get(maKey)
      );
      const item = toPublicProduct(overlaid);
      if (
        !(Number(item.gia) > 0) && item.priceKind !== "si_missing" &&
        !isShopTestBuyerEmail(requestShopBuyerEmail(req))
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      let ton = item.ton;
      if (ton <= 0 && isComboOrFormulaProduct(overlaid)) {
        ton = await resolveShopDisplayTon(db, COL, overlaid);
      }
      ton = await availableTonAfterHold(db, item.ma, ton);
      res.setHeader("X-Shop-Cache", "BYPASS");
      res.json({ item: ton !== item.ton ? { ...item, ton } : item });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "product_failed" });
    }
  });

  /** Resolve /c/.../p/... → mã SP công khai */
  app.get("/api/shop/resolve", async (req, res) => {
    setCors(req, res);
    try {
      const pathRaw = String(req.query.path || "").trim();
      const productSlugQ = String(req.query.productSlug || "").trim();
      let slug = productSlugQ;
      if (!slug && pathRaw) {
        const m = pathRaw.match(/\/p\/([^/?#]+)/i);
        if (m) slug = decodeURIComponent(m[1]);
      }
      if (!slug) {
        res.status(400).json({ error: "missing_path" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      const db = await catalogDb();
      const doc = await findByProductSlug(db, slug);
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const maKey = String((doc as any).ma || "").trim().toUpperCase();
      const pbByMa = await loadPriceBooksByMa(db, [maKey]);
      const metaById = await loadCategoryMetaById(db);
      const overlaid = applyPriceBookOverlay(
        overlayProductCategoryFields(doc as any, metaById),
        pbByMa.get(maKey)
      );
      const item = toPublicProduct(overlaid);
      if (
        !(Number(item.gia) > 0) && item.priceKind !== "si_missing" &&
        !isShopTestBuyerEmail(requestShopBuyerEmail(req))
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const ton = await availableTonAfterHold(db, item.ma, item.ton);
      res.setHeader("X-Shop-Cache", "BYPASS");
      res.json({ item: ton !== item.ton ? { ...item, ton } : item });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "resolve_failed" });
    }
  });

  /** Ghi nhận click mở link CTV — ghi shop DB (cùng nơi engine HH đọc). */
  app.post("/api/shop/ctv/click", async (req, res) => {
    setCors(req, res);
    try {
      if (!(await shopRateLimitOrReject(req, res, "shop_ctv_click", 30, 60_000))) {
        return;
      }
      const body = (req.body || {}) as { ctv?: unknown; ma?: unknown; path?: unknown };
      const ctv = normalizeCtvCode(body.ctv);
      if (!isValidCtvCode(ctv)) {
        // Mã giả: không lộ danh sách — coi như OK nhưng không ghi
        res.json({ ok: true, ignored: true });
        return;
      }

      const shopDb = getShopDb ? await getShopDb() : await getDb();
      const acc = await shopDb.collection("aloha_shop_accounts").findOne({
        ctvCode: ctv,
        roles: "ctv",
        ctvStatus: "active",
        active: { $ne: false },
      });
      if (!acc) {
        res.json({ ok: true, ignored: true });
        return;
      }

      const ma = body.ma ? String(body.ma).trim() : "";
      const path = body.path ? String(body.path).trim() : "";
      const safePath = path && path.startsWith("/") ? path : "";

      const ua = String(req.headers["user-agent"] || "").slice(0, 200);
      const xff = String(req.headers["x-forwarded-for"] || "");
      const ipRaw = xff || req.ip || "";
      const ipHash = hashIpFvn1a32(ipRaw);

      const col = shopDb.collection(CTV_CLICKS_COL);
      const now = new Date();
      await col.insertOne({
        ctv,
        ma: ma || undefined,
        path: safePath || undefined,
        ua: ua || undefined,
        ipHash: ipHash || undefined,
        createdAt: now,
        createdAtIso: now.toISOString(),
      });

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "ctv_click_failed" });
    }
  });

  /**
   * SSE công khai — khi aloha_products / tồn / giá đổi (app nội bộ → shop realtime).
   * Không JWT (giống xem catalog).
   */
  app.options("/api/shop/catalog/stream", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.get("/api/shop/catalog/stream", (req, res) => {
    setCors(req, res);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    const writeEvent = (event: string, data: unknown) => {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        /* closed */
      }
    };
    writeEvent("hello", { at: Date.now() });

    const onChange = (payload: { collections?: string[]; ids?: string[]; source?: string }) => {
      const cols = payload?.collections || [];
      const appearanceHit = cols.some(
        (c) =>
          c === "aloha_shop_appearance" ||
          c.includes("appearance") ||
          c.includes("shop_appearance")
      );
      if (appearanceHit) {
        writeEvent("appearance", {
          collections: cols,
          source: payload.source || "",
          at: Date.now(),
        });
      }
      const hit = cols.some(
        (c) =>
          c === "aloha_products" ||
          c === "noibo_products_kv" ||
          c.includes("product")
      );
      if (!hit) return;
      writeEvent("catalog", {
        collections: cols,
        ids: payload.ids || [],
        source: payload.source || "",
        at: Date.now(),
      });
    };
    syncBus.on("change", onChange);

    const ping = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* closed */
      }
    }, 25000);

    const cleanup = () => {
      clearInterval(ping);
      syncBus.off("change", onChange);
    };
    req.on("close", cleanup);
    req.on("aborted", cleanup);
  });

  /**
   * Endpoint nội bộ nhận lệnh xóa Cache (Cấp độ 1):
   * Bên project nội bộ gọi khi lưu sản phẩm / sửa giá / đổi tên.
   * Header: x-internal-key: <token> hoặc query ?token=<token>
   */
  app.options("/api/shop/cache/clear", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.post("/api/shop/cache/clear", async (req, res) => {
    setCors(req, res);
    const keyHeader = String(req.headers["x-internal-key"] || "");
    const keyQuery = String(req.query.token || "");
    const keyBody = String(req.body?.token || "");
    const token = keyHeader || keyQuery || keyBody;
    const expected = (process.env.INTERNAL_SYNC_SECRET || "aloha-secret-token-2026").trim();

    if (token !== expected) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body || {};
    const targetMa = body.ma ? String(body.ma).trim() : undefined;
    const collection = String(body.collection || "aloha_products").trim();

    // 1. Phát event syncBus để các luồng realtime (SSE) cập nhật
    syncBus.publish(collection, "internal_http", { ids: targetMa ? [targetMa] : [] });

    // 2. Xóa Cache Cấp độ 1 (xóa list shop:products:* và chi tiết mã nếu có)
    await redisInvalidateShopCache(targetMa);

    res.json({
      ok: true,
      cleared: true,
      level: 1,
      targetMa: targetMa || "all_products",
      at: Date.now(),
    });
  });
}
