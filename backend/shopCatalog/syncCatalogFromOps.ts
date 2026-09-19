/**
 * Sync cây nhóm + categoryId SP từ ops catalog DB (aloha_thumua) → shop DB.
 * Không ghi nhom/nhomPath (schema shop dùng categoryId / categoryName / ancestor).
 */
import type { Express, Response } from "express";
import type { Db } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { memoryCacheClear, redisInvalidateShopCache } from "../redis.js";
import { syncBus } from "../syncBus.js";
import { invalidateCategoryMetaCache } from "./categoryMeta.ts";
import { parseKvDate } from "../utils/productCreatedAt.js";

const CAT_COL = "categories";
const PROD_COL = "aloha_products";

function pickOpsCreatedRaw(p: Record<string, unknown> | undefined): unknown {
  if (!p) return null;
  return p.createdDate ?? p.CreatedDate ?? p.taoLuc ?? null;
}

function createdAtIso(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString();
  const d = parseKvDate(raw);
  return d ? d.toISOString() : "";
}

export type SyncCatalogFromOpsOptions = {
  dryRun?: boolean;
  /** Cập nhật categoryId/categoryName/ancestor trên SP shop theo mã */
  syncProducts?: boolean;
  /** Xóa nhóm trên shop không còn trên ops */
  removeStaleCategories?: boolean;
  /** $unset nhom/nhomPath trên SP shop (mặc định bật) */
  unsetLegacyNhomFields?: boolean;
};

export type SyncCatalogFromOpsResult = {
  ok: true;
  dryRun: boolean;
  sourceDb: string;
  shopDb: string;
  at: string;
  categories: {
    opsTotal: number;
    shopBefore: number;
    upserted: number;
    skippedSame: number;
    removed: number;
    sampleUpserts: Array<{ categoryId: number; name: string; action: string }>;
    sampleRemoved: Array<{ categoryId: number; name: string }>;
  };
  products: {
    enabled: boolean;
    scanned: number;
    updated: number;
    unchanged: number;
    missingOnOps: number;
    unsetNhom: number;
    sampleUpdates: Array<{
      ma: string;
      fromId: number;
      toId: number;
      fromName: string;
      toName: string;
    }>;
  };
};

function normMa(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

function asCatId(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function asParentId(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Tên nhóm KV trên ops: `_id` string thường là tên hiện tại (đúng SP.categoryName);
 * `categoryName`/`name` đôi khi còn tên cũ (vd. TRÊN 300K–DƯỚI 500K vs TỪ 300K–800K).
 */
function resolveOpsCategoryName(ops: Record<string, unknown>): string {
  const idRaw = ops._id;
  if (typeof idRaw === "string") {
    const idStr = idRaw.trim();
    if (idStr && !/^[a-f0-9]{24}$/i.test(idStr)) return idStr;
  }
  return String(ops.categoryName || ops.name || "").trim();
}

type CategoryMeta = {
  name: string;
  parentId: number | null;
  /** Đường dẫn KV root → lá (giống fullPath), không dùng nhom/nhomPath */
  ancestor: string[];
};

/** Tên + ancestor từ cây categories (parentId) — khớp nhánh mẹ/con KiotViet. */
function buildCategoryMetaMap(
  byId: Map<number, Record<string, unknown>>
): Map<number, CategoryMeta> {
  const out = new Map<number, CategoryMeta>();
  for (const [id, row] of byId) {
    const name = resolveOpsCategoryName(row);
    if (!name) continue;
    const parentId = asParentId(row.parentId);
    const chain: string[] = [];
    const seen = new Set<number>();
    let cur: number | null = id;
    while (cur && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      const n = resolveOpsCategoryName(byId.get(cur)!);
      if (n) chain.push(n);
      cur = asParentId(byId.get(cur)!.parentId);
    }
    chain.reverse();
    out.set(id, { name, parentId, ancestor: chain.length ? chain : [name] });
  }
  return out;
}

function sameAncestor(a: unknown, b: string[]): boolean {
  const left = Array.isArray(a)
    ? a.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  if (left.length !== b.length) return false;
  return left.every((v, i) => v === b[i]);
}

async function invalidateCategoryCaches() {
  invalidateCategoryMetaCache();
  memoryCacheClear("shop:category-tree");
  memoryCacheClear("shop:categories");
  memoryCacheClear("shop:products:");
  await redisInvalidateShopCache();
}

/**
 * @param shopDb aloha_shop_db
 * @param sourceDb aloha_thumua (hoặc SHOP_CATEGORY_SOURCE_DB)
 */
export async function syncCatalogFromOps(
  shopDb: Db,
  sourceDb: Db,
  opts: SyncCatalogFromOpsOptions = {}
): Promise<SyncCatalogFromOpsResult> {
  const dryRun = Boolean(opts.dryRun);
  const syncProducts = opts.syncProducts !== false;
  const removeStale = opts.removeStaleCategories !== false;
  const unsetLegacyNhom = opts.unsetLegacyNhomFields !== false;
  const now = new Date().toISOString();

  const opsCats = await sourceDb
    .collection(CAT_COL)
    .find({
      categoryId: { $exists: true, $ne: null },
    })
    .toArray();

  const opsById = new Map<number, Record<string, unknown>>();
  for (const c of opsCats) {
    const id = asCatId((c as any).categoryId);
    if (!id) continue;
    opsById.set(id, c as Record<string, unknown>);
  }

  const shopCats = await shopDb
    .collection(CAT_COL)
    .find({
      categoryId: { $exists: true, $ne: null },
    })
    .toArray();
  const shopById = new Map<number, Record<string, unknown>>();
  for (const c of shopCats) {
    const id = asCatId((c as any).categoryId);
    if (!id) continue;
    shopById.set(id, c as Record<string, unknown>);
  }

  let upserted = 0;
  let skippedSame = 0;
  const sampleUpserts: SyncCatalogFromOpsResult["categories"]["sampleUpserts"] =
    [];

  for (const [id, ops] of opsById) {
    const name = resolveOpsCategoryName(ops);
    if (!name) continue;
    const parentId = asParentId(ops.parentId);
    const rank = Number(ops.rank) || 0;
    const hasChild = Boolean(ops.hasChild);
    const shop = shopById.get(id);
    const same =
      shop &&
      String(shop.categoryName || "").trim() === name &&
      asParentId(shop.parentId) === parentId &&
      (Number(shop.rank) || 0) === rank;

    if (same) {
      skippedSame += 1;
      continue;
    }

    const action = shop ? "update" : "insert";
    upserted += 1;
    if (sampleUpserts.length < 25) {
      sampleUpserts.push({ categoryId: id, name, action });
    }

    if (!dryRun) {
      await shopDb.collection(CAT_COL).updateOne(
        { categoryId: id },
        {
          $set: {
            categoryId: id,
            categoryName: name,
            parentId,
            rank,
            hasChild,
            updatedAt: now,
            source: "ops_sync",
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }
  }

  let removed = 0;
  const sampleRemoved: SyncCatalogFromOpsResult["categories"]["sampleRemoved"] =
    [];
  if (removeStale) {
    for (const [id, shop] of shopById) {
      if (opsById.has(id)) continue;
      removed += 1;
      if (sampleRemoved.length < 25) {
        sampleRemoved.push({
          categoryId: id,
          name: String(shop.categoryName || ""),
        });
      }
      if (!dryRun) {
        await shopDb.collection(CAT_COL).deleteMany({ categoryId: id });
      }
    }
  }

  const productResult: SyncCatalogFromOpsResult["products"] = {
    enabled: syncProducts,
    scanned: 0,
    updated: 0,
    unchanged: 0,
    missingOnOps: 0,
    unsetNhom: 0,
    sampleUpdates: [],
  };

  // Sau sync categories: meta tên/nhánh lấy từ ops tree (khớp KV), không tin categoryName cũ trên SP.
  const catMeta = buildCategoryMetaMap(opsById);

  if (syncProducts) {
    const opsProds = await sourceDb
      .collection(PROD_COL)
      .find({})
      .project({
        ma: 1,
        categoryId: 1,
        createdDate: 1,
        CreatedDate: 1,
        taoLuc: 1,
      })
      .toArray();
    const opsByMa = new Map<string, Record<string, unknown>>();
    for (const p of opsProds) {
      const ma = normMa((p as any).ma);
      if (!ma) continue;
      opsByMa.set(ma, p as Record<string, unknown>);
    }

    const shopProds = await shopDb
      .collection(PROD_COL)
      .find({})
      .project({
        _id: 1,
        ma: 1,
        categoryId: 1,
        categoryName: 1,
        ancestor: 1,
        createdAt: 1,
      })
      .toArray();

    for (const sp of shopProds) {
      productResult.scanned += 1;
      const ma = normMa((sp as any).ma);
      if (!ma) {
        productResult.unchanged += 1;
        continue;
      }
      const op = opsByMa.get(ma);
      if (!op) {
        productResult.missingOnOps += 1;
        // Vẫn chỉnh tên theo categoryId đang gắn trên shop (cây KV).
      }

      const fromId = asCatId((sp as any).categoryId);
      const toId = op ? asCatId(op.categoryId) || fromId : fromId;
      const meta = toId ? catMeta.get(toId) : undefined;

      const fromName = String((sp as any).categoryName || "").trim();
      const toName = meta?.name || "";
      const toAncestor = meta?.ancestor;

      const setDoc: Record<string, unknown> = {};
      if (meta && toId) {
        if (toId !== fromId) setDoc.categoryId = toId;
        if (toName && toName !== fromName) setDoc.categoryName = toName;
        if (toAncestor && !sameAncestor((sp as any).ancestor, toAncestor)) {
          setDoc.ancestor = toAncestor;
        }
      }

      // Chỉ sync ngày tạo KV → createdAt (không thêm field mới).
      if (op) {
        const nextCreated = createdAtIso(pickOpsCreatedRaw(op));
        if (nextCreated) {
          const prevCreated = createdAtIso((sp as any).createdAt);
          if (prevCreated !== nextCreated) setDoc.createdAt = nextCreated;
        }
      }

      if (!Object.keys(setDoc).length) {
        productResult.unchanged += 1;
        continue;
      }

      productResult.updated += 1;
      if (productResult.sampleUpdates.length < 30) {
        productResult.sampleUpdates.push({
          ma,
          fromId,
          toId: toId || fromId,
          fromName,
          toName: toName || fromName,
        });
      }

      if (!dryRun) {
        // Không đụng updatedAt khi chỉ sửa createdAt — giữ mốc cập nhật khác nguyên.
        if (
          Object.keys(setDoc).some((k) => k !== "createdAt")
        ) {
          setDoc.updatedAt = now;
        }
        const update: Record<string, unknown> = { $set: setDoc };
        if (unsetLegacyNhom) {
          update.$unset = { nhom: "", nhomPath: "" };
        }
        await shopDb.collection(PROD_COL).updateOne({ _id: (sp as any)._id }, update);
      }
    }

    if (unsetLegacyNhom) {
      if (dryRun) {
        productResult.unsetNhom = await shopDb.collection(PROD_COL).countDocuments({
          $or: [{ nhom: { $exists: true } }, { nhomPath: { $exists: true } }],
        });
      } else {
        const unsetRes = await shopDb.collection(PROD_COL).updateMany(
          {
            $or: [{ nhom: { $exists: true } }, { nhomPath: { $exists: true } }],
          },
          { $unset: { nhom: "", nhomPath: "" } }
        );
        productResult.unsetNhom = unsetRes.modifiedCount;
      }
    }
  }

  if (!dryRun) {
    await invalidateCategoryCaches();
  }

  return {
    ok: true,
    dryRun,
    sourceDb: sourceDb.databaseName,
    shopDb: shopDb.databaseName,
    at: now,
    categories: {
      opsTotal: opsById.size,
      shopBefore: shopById.size,
      upserted,
      skippedSame,
      removed,
      sampleUpserts,
      sampleRemoved,
    },
    products: productResult,
  };
}

/** POST /api/shop/admin/catalog/sync-from-ops — manager only */
export function registerShopCatalogSyncFromOpsRoutes(
  app: Express,
  getAuthDb: GetDb,
  getShopDb: GetDb,
  getSourceDb: GetDb
) {
  const gate = [requireAuth(getAuthDb), requireActive, requireManager];

  app.post(
    "/api/shop/admin/catalog/sync-from-ops",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const dryRun =
          String(req.query.dryRun || req.body?.dryRun || "") === "1" ||
          req.body?.dryRun === true;
        const syncProducts =
          req.body?.syncProducts === false ||
          String(req.query.syncProducts || "") === "0"
            ? false
            : true;
        const removeStaleCategories =
          req.body?.removeStaleCategories === false ||
          String(req.query.removeStaleCategories || "") === "0"
            ? false
            : true;

        const [shopDb, sourceDb] = await Promise.all([
          getShopDb(),
          getSourceDb(),
        ]);
        const result = await syncCatalogFromOps(shopDb, sourceDb, {
          dryRun,
          syncProducts,
          removeStaleCategories,
        });
        if (!dryRun) {
          syncBus.publish(
            ["categories", "aloha_products"],
            "catalog-sync-from-ops",
            {
              ids: [
                `cats:${result.categories.upserted}`,
                `prods:${result.products.updated}`,
              ],
            }
          );
        }
        res.json(result);
      } catch (e: any) {
        res.status(500).json({
          error: e?.message || "sync_from_ops_failed",
        });
      }
    }
  );
}
