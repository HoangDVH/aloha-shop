/**
 * Nhóm vận chuyển (nhỏ/vừa/to/đất) gán theo danh mục KiotViet.
 * Lưu tại `config` { id: "shipping_category_size", byCategoryId: { "<categoryId>": "vua" } }.
 * Nhóm con kế thừa nhóm mẹ gần nhất; `shipSizeClass` trên từng SP vẫn ưu tiên hơn.
 * Quản lý bằng scripts/shipping-category-size.cjs (không có màn admin).
 */
import type { Db } from "mongodb";
import type { ShipSizeClass } from "./sizePresets.js";

export const SHIPPING_CATEGORY_SIZE_CONFIG_ID = "shipping_category_size";

const SIZE_CLASSES: readonly ShipSizeClass[] = ["nho", "vua", "to", "dat_giath"];
const MEM_TTL_MS = 30_000;

let memAt = 0;
let memMap: Map<number, ShipSizeClass> | null = null;

export function parseCategorySizeMap(raw: unknown): Map<number, ShipSizeClass> {
  const out = new Map<number, ShipSizeClass>();
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    const size = String(v || "").trim().toLowerCase() as ShipSizeClass;
    if (Number.isInteger(id) && id > 0 && SIZE_CLASSES.includes(size)) out.set(id, size);
  }
  return out;
}

export async function loadCategorySizeMap(db: Db): Promise<Map<number, ShipSizeClass>> {
  const now = Date.now();
  if (memMap && now - memAt < MEM_TTL_MS) return memMap;
  const doc = await db
    .collection("config")
    .findOne({ id: SHIPPING_CATEGORY_SIZE_CONFIG_ID }, { projection: { byCategoryId: 1 } });
  memMap = parseCategorySizeMap(doc?.byCategoryId);
  memAt = now;
  return memMap;
}

/** `ancestorIds` theo thứ tự root → lá; nhóm gần lá nhất có cấu hình sẽ được dùng. */
export function sizeClassForCategoryChain(
  ancestorIds: number[] | undefined,
  map: Map<number, ShipSizeClass>
): ShipSizeClass | null {
  if (!ancestorIds?.length || !map.size) return null;
  for (let i = ancestorIds.length - 1; i >= 0; i--) {
    const hit = map.get(ancestorIds[i]);
    if (hit) return hit;
  }
  return null;
}
