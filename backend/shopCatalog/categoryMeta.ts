/**
 * Meta nhóm từ collection `categories` (cây KV: mẹ/con + fullPath).
 * Dùng overlay lúc đọc — giữ field categoryName/ancestor trên SP nhưng hiển thị khớp KV.
 * Không tạo nhom/nhomPath.
 */
import type { Db } from "mongodb";
import {
  buildCategoryTreeFromKv,
  flattenKvCategories,
  type CategoryNode,
} from "../utils/categoryTree.ts";

export type CategoryMeta = {
  name: string;
  path: string;
  /** Đoạn path root → lá (khớp fullPath KV) */
  ancestor: string[];
};

let memAt = 0;
let memMap: Map<number, CategoryMeta> | null = null;
const MEM_TTL_MS = 30_000;

function walkMeta(nodes: CategoryNode[], out: Map<number, CategoryMeta>) {
  for (const n of nodes) {
    const id = Number(n.categoryId) || 0;
    if (id > 0) {
      const path = String(n.fullPath || n.name || "").trim();
      const ancestor = path
        .split(/\s*>>\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      out.set(id, {
        name: String(n.name || "").trim(),
        path,
        ancestor: ancestor.length ? ancestor : [String(n.name || "").trim()].filter(Boolean),
      });
    }
    if (n.children?.length) walkMeta(n.children, out);
  }
}

/** Map categoryId → tên/path từ bảng categories (không đọc SP). */
export async function loadCategoryMetaById(
  db: Db,
  opts?: { bypassCache?: boolean }
): Promise<Map<number, CategoryMeta>> {
  const now = Date.now();
  if (!opts?.bypassCache && memMap && now - memAt < MEM_TTL_MS) {
    return memMap;
  }
  const cats = await db
    .collection("categories")
    .find({
      categoryId: { $exists: true, $ne: null },
      $expr: { $gt: [{ $toDouble: { $ifNull: ["$categoryId", 0] } }, 0] },
    })
    .sort({ rank: 1, categoryName: 1 })
    .toArray();
  const tree = buildCategoryTreeFromKv(flattenKvCategories(cats), []);
  const out = new Map<number, CategoryMeta>();
  walkMeta(tree, out);
  memMap = out;
  memAt = now;
  return out;
}

export function invalidateCategoryMetaCache() {
  memMap = null;
  memAt = 0;
}

/**
 * Overlay categoryName + ancestor từ cây categories theo categoryId.
 * Không ghi Mongo — chỉ object trong memory cho API.
 */
export function overlayProductCategoryFields(
  doc: Record<string, unknown>,
  metaById: Map<number, CategoryMeta>
): Record<string, unknown> {
  const id = Number(doc.categoryId) || 0;
  if (!(id > 0)) return doc;
  const meta = metaById.get(id);
  if (!meta?.name) return doc;
  return {
    ...doc,
    categoryName: meta.name,
    ancestor: meta.ancestor,
  };
}

export function overlayProductCategoryFieldsMany(
  docs: Record<string, unknown>[],
  metaById: Map<number, CategoryMeta>
): Record<string, unknown>[] {
  return docs.map((d) => overlayProductCategoryFields(d, metaById));
}
