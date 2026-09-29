/**
 * Category tree builder with image attachments and product counts.
 */
import type { Db } from "mongodb";
import { slugify } from "./text.js";
import { shopFilterBase } from "./publicProduct.js";
import { COL } from "./types.js";
import { CATEGORY_COL } from "../categoryCollection.js";
import {
  buildCategoryTreeFromKv,
  flattenKvCategories,
  type CategoryNode,
} from "../../utils/categoryTree.js";

export type ShopNavNode = {
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

export function kvNodeToShopNav(node: CategoryNode): ShopNavNode {
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
export async function loadCategoryImageMap(db: Db): Promise<Map<number, string>> {
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
export function attachLeafImages(
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
export async function buildShopKvCategoryTree(
  db: Db
): Promise<{ tree: CategoryNode[]; items: ShopNavNode[] }> {
  const cats = await db
    .collection(CATEGORY_COL)
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
