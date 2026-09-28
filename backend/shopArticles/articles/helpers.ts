import fs from "fs";
import path from "path";
import type { Db, ObjectId } from "mongodb";
import { ObjectId as MongoObjectId } from "mongodb";
import sharp from "sharp";
import { redisInvalidateShopCache } from "../../redis.js";
import { syncBus } from "../../syncBus.js";
import { slugifyVi } from "../sanitize.js";
import {
  ARTICLES_COL,
  PRODUCT_MAS_MAX,
  type ShopArticleDoc,
} from "../types.js";
import { normalizeWebBadge } from "../../shopCatalog/webBadge.js";

export { sharp };

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const MAX_DOCX_BYTES = 12 * 1024 * 1024;
export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/ogg"]);
export const PRODUCTS_COL = "aloha_products";

export function bumpArticles(source: string) {
  syncBus.publish([ARTICLES_COL, "aloha_shop_articles"], source);
  void redisInvalidateShopCache();
}

export function resolveUploadsDir() {
  const cwd = process.cwd();
  const prod = path.join(cwd, "..", "uploads");
  const dev = path.join(cwd, "uploads");
  const root = fs.existsSync(prod) ? prod : dev;
  const dir = path.join(root, "shop-articles");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function idStr(doc: { _id?: unknown }): string {
  return String(doc._id || "");
}

export function publicFilter(nowIso = new Date().toISOString()) {
  return {
    visible: { $ne: false },
    publishedAt: { $lte: nowIso },
  };
}

export function toAdmin(doc: ShopArticleDoc & { _id?: unknown }) {
  return {
    id: idStr(doc),
    title: doc.title || "",
    slug: doc.slug || "",
    previousSlugs: Array.isArray(doc.previousSlugs) ? doc.previousSlugs : [],
    category: doc.category || "",
    coverUrl: doc.coverUrl || "",
    videoUrl: doc.videoUrl || "",
    excerpt: doc.excerpt || "",
    bodyHtml: doc.bodyHtml || "",
    productMas: Array.isArray(doc.productMas) ? doc.productMas : [],
    publishedAt: doc.publishedAt || doc.createdAt || "",
    visible: doc.visible !== false,
    createdAt: doc.createdAt || "",
    updatedAt: doc.updatedAt || "",
    updatedBy: doc.updatedBy ?? null,
  };
}

export function toPublicList(doc: ShopArticleDoc & { _id?: unknown }) {
  return {
    id: idStr(doc),
    title: doc.title || "",
    slug: doc.slug || "",
    category: doc.category || "",
    coverUrl: doc.coverUrl || "",
    excerpt: doc.excerpt || "",
    publishedAt: doc.publishedAt || "",
    updatedAt: doc.updatedAt || "",
  };
}

export function toPublicDetail(doc: ShopArticleDoc & { _id?: unknown }) {
  return {
    ...toPublicList(doc),
    videoUrl: doc.videoUrl || "",
    bodyHtml: doc.bodyHtml || "",
    productMas: Array.isArray(doc.productMas) ? doc.productMas : [],
  };
}

export function normalizeProductMas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const ma = String(x || "").trim();
    if (!ma || seen.has(ma)) continue;
    seen.add(ma);
    out.push(ma);
    if (out.length >= PRODUCT_MAS_MAX) break;
  }
  return out;
}

export function parseId(raw: string): ObjectId | null {
  try {
    if (!MongoObjectId.isValid(raw)) return null;
    return new MongoObjectId(raw);
  } catch {
    return null;
  }
}

export async function ensureIndexes(db: Db) {
  const col = db.collection(ARTICLES_COL);
  await col.createIndex({ slug: 1 }, { unique: true });
  await col.createIndex({ previousSlugs: 1 });
  await col.createIndex({ publishedAt: -1, visible: 1 });
  await col.createIndex({ category: 1, publishedAt: -1 });
}

let indexesReady = false;

export async function ensureReady(db: Db) {
  if (indexesReady) return;
  await ensureIndexes(db);
  indexesReady = true;
}

/** Minimal public product shape — khớp shop ProductCard. */
export function toMiniProduct(doc: Record<string, unknown>) {
  const ma = String(doc.ma || doc._id || "").trim();
  const ten = String(doc.ten || "").trim();
  const anh =
    (typeof doc.anh === "string" && doc.anh) ||
    (Array.isArray(doc.images) && doc.images[0] ? String(doc.images[0]) : "") ||
    "";
  const gia = Number(doc.giaWeb ?? doc.giaBan ?? doc.giaChung ?? doc.basePrice ?? 0);
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0);
  const categoryName = String(doc.categoryName || "").trim();
  const nhom = String(doc.nhom || categoryName || "").trim();
  const nhomPath = String(doc.nhomPath || nhom || categoryName || "").trim();
  // Khớp shopCatalog.categorySlug — tránh rơi về /c/sp/ khi chỉ có categoryName
  const catLeaf =
    nhomPath.split(/\s*[▸>\/|]+\s*/).filter(Boolean).pop() ||
    nhom.split(/\s*[▸>\/|]+\s*/).filter(Boolean).pop() ||
    categoryName ||
    "san-pham";
  const catSlug = slugifyVi(catLeaf) || "san-pham";
  const pSlug = `${slugifyVi(ten) || "sp"}--${slugifyVi(ma) || "x"}`;
  const webBadge = normalizeWebBadge(doc.webBadge);
  return {
    ma,
    ten,
    dvt: String(doc.dvt || "Cái").trim() || "Cái",
    nhom,
    nhomPath,
    gia: Number.isFinite(gia) ? gia : 0,
    ton: Number.isFinite(ton) ? ton : 0,
    anh,
    images: anh ? [anh] : [],
    isActive: doc.isActive !== false,
    path: `/c/${catSlug}/p/${pSlug}`,
    categorySlug: catSlug,
    productSlug: pSlug,
    webBadge: webBadge || undefined,
  };
}

export async function resolveProductsByMas(mainDb: Db, mas: string[]) {
  if (!mas.length) return [];
  const rows = await mainDb
    .collection(PRODUCTS_COL)
    .find({
      ma: { $in: mas },
      $and: [
        { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
        {
          $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
        },
      ],
    } as any)
    .project({
      ma: 1,
      ten: 1,
      anh: 1,
      images: 1,
      dvt: 1,
      nhom: 1,
      nhomPath: 1,
      giaWeb: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      ton: 1,
      onHand: 1,
      kvTon: 1,
      isActive: 1,
      webBadge: 1,
    })
    .toArray();
  const map = new Map(rows.map((d) => [String(d.ma), toMiniProduct(d as any)]));
  return mas.map((m) => map.get(m)).filter(Boolean);
}
