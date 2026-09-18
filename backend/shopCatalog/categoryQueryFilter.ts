/**
 * Lọc nhóm hàng giống storefront (/api/shop/products):
 * chỉ categoryId (+ mọi con trong cây categories).
 * Path `nhom` được resolve → id qua cây; không regex nhom/nhomPath trên SP.
 */
import type { Db } from "mongodb";
import {
  buildCategoryPathIndex,
  buildCategoryTreeFromKv,
  flattenKvCategories,
  resolveCategoryIdsFromPathIndex,
  type CategoryNode,
} from "../utils/categoryTree.ts";

async function loadCategoryTree(db: Db): Promise<CategoryNode[]> {
  const cats = await db
    .collection("categories")
    .find({
      categoryId: { $exists: true, $ne: null },
      $expr: { $gt: [{ $toDouble: { $ifNull: ["$categoryId", 0] } }, 0] },
    })
    .sort({ rank: 1, categoryName: 1 })
    .toArray();
  const kvRows = flattenKvCategories(cats);
  return buildCategoryTreeFromKv(kvRows, []);
}

function collectDescendantIds(tree: CategoryNode[], rootIds: number[]): number[] {
  if (!rootIds.length) return [];
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

export function parseNhomList(query: Record<string, unknown>): string[] {
  const raw = query.nhom ?? query.category;
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

export function parseCategoryIdList(query: Record<string, unknown>): number[] {
  const raw = query.categoryId ?? query.categoryIds;
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

/** Mongo filter nhóm — chỉ categoryId (+ subtree). */
export async function buildShopCategoryMongoFilter(
  db: Db,
  opts: { nhomList?: string[]; categoryIdList?: number[] }
): Promise<Record<string, unknown> | null> {
  const nhomList = (opts.nhomList || []).map((s) => String(s || "").trim()).filter(Boolean);
  const categoryIdList = (opts.categoryIdList || []).filter((n) => n > 0);
  if (!nhomList.length && !categoryIdList.length) return null;

  const tree = await loadCategoryTree(db);
  const pathIndex = buildCategoryPathIndex(tree);
  const rootIds = new Set<number>();

  if (categoryIdList.length) {
    categoryIdList.forEach((id) => rootIds.add(id));
  }
  for (const path of nhomList) {
    resolveCategoryIdsFromPathIndex(pathIndex, path).forEach((id) => rootIds.add(id));
  }

  const ids = collectDescendantIds(tree, [...rootIds]);
  if (!ids.length) return null;
  return { categoryId: { $in: ids } };
}
