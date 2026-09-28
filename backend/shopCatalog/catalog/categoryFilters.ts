/**
 * Category filtering, path resolution, and homepage scope builders.
 */
import type { Db } from "mongodb";
import { regexEscapeLiteral } from "./text.js";
import { buildShopKvCategoryTree } from "./categoryTree.js";
import {
  buildCategoryPathIndex,
  resolveCategoryIdsFromPathIndex,
  type CategoryNode,
} from "../../utils/categoryTree.js";
import {
  loadRevenueRankMap,
  HOME_BESTSELLER_FACET_LIMIT,
} from "./bestsellers.js";
import { HOME_CAY_THANH_PHAM_PATH } from "./types.js";

/** Lọc nhóm hàng — ưu tiên categoryId; path chỉ dùng resolve id / ancestor / categoryName. */
export function buildCategorySubtreeFilter(
  catList: string[]
): Record<string, unknown> | null {
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

export function parseNhomQuery(req: { query: Record<string, unknown> }): string[] {
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
export function parseCategoryIdQuery(req: {
  query: Record<string, unknown>;
}): number[] {
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
export async function resolveCategoryIdsForRootIds(
  db: Db,
  rootIds: number[]
): Promise<number[]> {
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

/** Gom categoryId nhánh đã chọn + mọi con — khớp tab Hàng hóa. */
export async function resolveCategoryIdsForPaths(
  db: Db,
  paths: string[]
): Promise<number[]> {
  if (!paths.length) return [];
  const { tree } = await buildShopKvCategoryTree(db);
  const pathToIds = buildCategoryPathIndex(tree);
  const ids = new Set<number>();
  for (const raw of paths) {
    resolveCategoryIdsFromPathIndex(pathToIds, raw).forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function mergeCategoryFilters(
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
export async function buildHomeScopeFilter(
  db: Db
): Promise<Record<string, unknown> | null> {
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
