/**
 * Public product representation, slugging, sorting, filtering and deduplication.
 */
import type { Db } from "mongodb";
import { slugify, normalizeMa } from "./text.js";
import { COL } from "./types.js";
import { publicProductVideos } from "../productVideoUrl.js";
import { resolveShopPrice } from "../priceOverlay.js";
import { currentPriceMode } from "../../shopWholesale/priceContext.js";
import { normalizeTrongLuongGram } from "../../shopShipping/resolveWeight.js";
import {
  normalizeAttrs,
  dedupeCanonicalPublic,
} from "../../shopVariantGroup.js";
import { normalizeWebBadge } from "../webBadge.js";
import {
  arrangeByAbsolutePin,
  resolvePinBadgeScope,
} from "../pinArrange.js";
import { productCreatedMs as kvProductCreatedMs } from "../../utils/productCreatedAt.js";

export function publicImages(doc: Record<string, unknown>): string[] {
  const imgs = Array.isArray(doc.images)
    ? doc.images.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const anh = String(doc.anh || "").trim();
  if (anh && !imgs.includes(anh)) imgs.unshift(anh);
  return imgs.slice(0, 12);
}

/** SP public phải có ảnh — ẩn SKU test / thiếu media (vd. «T2»). */
export function hasPublicImage(p: {
  anh?: string | null;
  images?: string[] | null;
}): boolean {
  if (String(p.anh || "").trim()) return true;
  return Array.isArray(p.images) && p.images.some((u) => String(u || "").trim());
}

export function filterRequirePublicImage<
  T extends { anh?: string | null; images?: string[] | null }
>(items: T[]): T[] {
  return items.filter(hasPublicImage);
}

export function publicTon(doc: Record<string, unknown>): number {
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon);
  return Number.isFinite(ton) ? ton : 0;
}

export function categorySlug(doc: Record<string, unknown>): string {
  const path = String(
    deriveNhomPath(doc) || doc.categoryName || "san-pham"
  ).trim();
  const leaf = path.split(/\s*[▸>\/|]\s*/).filter(Boolean).pop() || path;
  return slugify(leaf) || "san-pham";
}

/** Map ảo nhom/nhomPath từ categoryName + ancestor (đã overlay từ cây categories khi đọc API). */
export function deriveNhomPath(doc: Record<string, unknown>): string {
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

export function deriveNhom(doc: Record<string, unknown>): string {
  const categoryName = String(doc.categoryName || "").trim();
  if (categoryName) return categoryName;
  const path = deriveNhomPath(doc);
  if (!path) return "";
  return path.split(/\s*[▸>\/|]\s*/).filter(Boolean).pop() || path;
}

export function productSlug(doc: Record<string, unknown>): string {
  const ma = String(doc.ma || doc._id || "").trim();
  const ten = String(doc.ten || ma).trim();
  const base = slugify(ten) || "sp";
  const code = slugify(ma) || "x";
  return `${base}--${code}`;
}

export function shopPath(doc: Record<string, unknown>): string {
  return `/c/${categorySlug(doc)}/p/${productSlug(doc)}`;
}

/** Field công khai — không giaVon / NCC / cost. Không ghi Mongo. */
export function toPublicProduct(doc: Record<string, unknown>) {
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

export type CatalogDealInfo = { salePrice: number; compareAtPrice: number; hasGift: boolean };

/** Tỉ lệ giảm của SP chiến dịch so với giá web (0 = chỉ quà); -1 = không thuộc chiến dịch. */
export function campaignDealOff(gia: number, deal: CatalogDealInfo | undefined): number {
  if (!deal) return -1;
  if (gia > 0 && deal.salePrice > 0 && deal.salePrice < gia) return (gia - deal.salePrice) / gia;
  if (gia > 0 && deal.compareAtPrice > gia) return (deal.compareAtPrice - gia) / deal.compareAtPrice;
  return 0;
}

/**
 * Ghim = vị trí tuyệt đối trong đúng nhãn (pinBadgeScope).
 * Scope rỗng → không áp ghim (tránh đụng chéo nhãn).
 * «Giảm giá»: SP chiến dịch (giảm sâu → quà) trước, rồi SP gắn nhãn giam_gia, rồi còn lại.
 */
export function sortPublicItems(
  items: ReturnType<typeof toPublicProduct>[],
  sort: string,
  createdMsByMa?: Map<string, number>,
  pinBadgeScope?: string | null,
  deals?: Map<string, CatalogDealInfo>
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
    const rank = new Map<string, { group: number; off: number; gift: number }>();
    for (const p of next) {
      const ma = normalizeMa(p.ma);
      const deal = deals?.get(ma);
      const off = campaignDealOff(p.gia, deal);
      const group = off >= 0 ? 2 : normalizeWebBadge(p.webBadge) === "giam_gia" ? 1 : 0;
      rank.set(ma, { group, off: Math.max(0, off), gift: deal?.hasGift ? 1 : 0 });
    }
    const none = { group: 0, off: 0, gift: 0 };
    return arrangeByAbsolutePin(
      next,
      (a, b) => {
        const ra = rank.get(normalizeMa(a.ma)) || none;
        const rb = rank.get(normalizeMa(b.ma)) || none;
        return (
          rb.group - ra.group ||
          rb.off - ra.off ||
          rb.gift - ra.gift ||
          a.ten.localeCompare(b.ten, "vi")
        );
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
export function productCreatedMs(doc: Record<string, unknown>): number {
  return kvProductCreatedMs(doc) || 0;
}

export function dedupeListItems(
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

export function shopFilterBase(): Record<string, unknown> {
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

export function parseMaFromProductSlug(slug: string): string | null {
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
export async function findByProductSlug(db: Db, slug: string) {
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
