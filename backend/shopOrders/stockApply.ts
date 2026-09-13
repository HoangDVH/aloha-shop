/**
 * Trừ tồn aloha_products atomic theo dòng đơn shop (chống oversell 2 khách).
 * Assert dùng displayTon (combo) − soft-hold — không ghi reserved lên SP.
 */
import type { Db } from "mongodb";
import type { ShopOrderDetail } from "./models.js";
import {
  isComboOrFormulaProduct,
  resolveShopDisplayTon,
} from "../shopVariantGroup.js";
import { shopStockHoldEnabled, sumHeldQtyByMa } from "./stockHold.js";

export type StockDeductResult = {
  ok: boolean;
  shortfall: string[];
  updated: string[];
  errors: string[];
};

type Inv = {
  branchId?: number;
  branchName?: string;
  onHand?: number;
  reserved?: number;
  [k: string]: unknown;
};

const PRODUCTS_COL = "aloha_products";

function shopBranchId(): number {
  return Number(process.env.SHOP_KV_BRANCH_ID || 0) || 0;
}

function sumOnHand(inv: Inv[]): number {
  return inv.reduce((s, x) => s + (Number(x?.onHand) || 0), 0);
}

function productQuery(ma: string) {
  return {
    $or: [{ ma }, { ma: ma.toLowerCase() }, { code: ma }, { code: ma.toLowerCase() }],
    deletedAt: null,
  };
}

function readTon(doc: Record<string, unknown>): number {
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0);
  return Number.isFinite(ton) ? ton : 0;
}

/**
 * Kiểm tra tồn đủ trước khi tạo đơn.
 * shopDb: trừ soft-hold đang active (collection riêng).
 */
export async function assertStockAvailable(
  mainDb: Db,
  details: ShopOrderDetail[],
  shopDb?: Db,
  opts?: { excludeOrderId?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const col = mainDb.collection(PRODUCTS_COL);
  const mas = details
    .map((d) => String(d.productCode || "").trim().toUpperCase())
    .filter(Boolean);
  const heldByMa =
    shopDb && shopStockHoldEnabled()
      ? await sumHeldQtyByMa(shopDb, mas, opts?.excludeOrderId)
      : new Map<string, number>();

  for (const d of details) {
    const ma = String(d.productCode || "").trim().toUpperCase();
    const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
    if (!ma) continue;
    const product = await col.findOne(productQuery(ma));
    if (!product) {
      return { ok: false, error: `Không tìm thấy sản phẩm ${ma}` };
    }
    let displayTon = readTon(product as any);
    if (displayTon <= 0 && isComboOrFormulaProduct(product as any)) {
      displayTon = await resolveShopDisplayTon(
        mainDb,
        PRODUCTS_COL,
        product as any
      );
    }
    const held = heldByMa.get(ma) || 0;
    const available = Math.max(0, Math.floor(displayTon) - held);
    if (!(available >= qty)) {
      return {
        ok: false,
        error: `${ma} chỉ còn ${available} — không đủ ${qty}`,
      };
    }
  }
  return { ok: true };
}

/**
 * Trừ từng mã với điều kiện ton >= qty (atomic findOneAndUpdate + $inc).
 * Chỉ gọi khi đã thanh toán / xác nhận — luồng cũ.
 */
export async function applyShopOrderStockDeduct(
  mainDb: Db,
  details: ShopOrderDetail[]
): Promise<StockDeductResult> {
  const col = mainDb.collection(PRODUCTS_COL);
  const branchId = shopBranchId();
  const shortfall: string[] = [];
  const updated: string[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (const d of details) {
    const ma = String(d.productCode || "").trim().toUpperCase();
    const qty = Math.max(1, Math.floor(Number(d.quantity) || 1));
    if (!ma || !(qty > 0)) continue;

    try {
      const product = await col.findOne(productQuery(ma), {
        projection: { _id: 1, ton: 1, onHand: 1, kvTon: 1, inventories: 1 },
      });
      if (!product) {
        shortfall.push(ma);
        continue;
      }

      const r = await col.findOneAndUpdate(
        {
          _id: (product as any)._id,
          $or: [
            { ton: { $gte: qty } },
            { onHand: { $gte: qty } },
            { kvTon: { $gte: qty } },
          ],
        },
        {
          $inc: {
            ton: -qty,
            onHand: -qty,
            kvTon: -qty,
            tonKho: -qty,
          },
          $set: {
            tonSyncedAt: now,
            shopStockAt: now,
            updatedAt: now,
          },
        },
        { returnDocument: "after" }
      );

      const doc = (r as any)?.value ?? r;
      if (!doc || !(doc as any)._id) {
        shortfall.push(ma);
        continue;
      }

      if (branchId > 0 && Array.isArray((doc as any).inventories)) {
        const inv: Inv[] = ((doc as any).inventories as Inv[]).map((x) => ({
          ...x,
        }));
        const idx = inv.findIndex((x) => Number(x.branchId) === branchId);
        if (idx >= 0) {
          inv[idx] = {
            ...inv[idx],
            onHand: Math.max(0, (Number(inv[idx]!.onHand) || 0) - qty),
          };
          const ton = sumOnHand(inv);
          await col.updateOne(
            { _id: (doc as any)._id },
            {
              $set: {
                inventories: inv,
                ton,
                tonKho: ton,
                onHand: ton,
                updatedAt: now,
              },
            }
          );
        }
      }

      updated.push(ma);
    } catch (e: any) {
      errors.push(`${ma}:${e?.message || e}`);
      shortfall.push(ma);
    }
  }

  return {
    ok: shortfall.length === 0 && errors.length === 0,
    shortfall,
    updated,
    errors,
  };
}
