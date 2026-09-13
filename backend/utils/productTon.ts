/**
 * Tồn kho theo chi nhánh/kho — giống KiotViet khi chọn «KHO TRUNG TÂM» / «KHU VỰC BÁN HÀNG».
 *
 * Lưu ý KiotViet Public API:
 * - Chỉ có 1 chi nhánh thật: Chi nhánh trung tâm (24862)
 * - KHU VỰC BÁN HÀNG (73531) / KHO TRUNG TÂM (73533) là kho con (master location)
 * - Lọc một kho: đúng inventories[].onHand của ID đó (73531 khu bán, 73533 kho trung tâm).
 * - «Tất cả kho»: số onHand cấp SP của KiotViet (kvTon / onHand / ton), không cộng lại inventories.
 */

/** Chi nhánh cha (API /branches thường chỉ trả về ID này) */
export const KV_PARENT_BRANCH_ID = 24862;
/** Kho / khu vực bán hàng */
export const KV_SALES_AREA_ID = 73531;
/** Kho trung tâm */
export const KV_CENTRAL_WAREHOUSE_ID = 73533;
/** Dropdown Hàng hóa — cùng tên/ID như KiotViet (API /branches không trả kho con) */
export const KV_WAREHOUSE_FILTER_OPTIONS: { id: number; name: string }[] = [
  { id: KV_SALES_AREA_ID, name: "Khu vực bán hàng" },
  { id: KV_CENTRAL_WAREHOUSE_ID, name: "Kho trung tâm" },
];

const KV_WAREHOUSE_ORDER = [KV_SALES_AREA_ID, KV_CENTRAL_WAREHOUSE_ID];

/** Đưa khu bán hàng + kho trung tâm lên đầu danh sách lọc. */
export function sortHangHoaWarehouseOptions<T extends { id: number; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ia = KV_WAREHOUSE_ORDER.indexOf(a.id);
    const ib = KV_WAREHOUSE_ORDER.indexOf(b.id);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.name.localeCompare(b.name, "vi");
  });
}

type Inv = {
  branchId?: number;
  onHand?: number | null;
  OnHand?: number | null;
  reserved?: number | null;
  Reserved?: number | null;
  masterLocationId?: number;
  locationId?: number;
  branchName?: string;
};

function invOnHand(inv: Inv | null | undefined): number {
  return Number(inv?.onHand ?? inv?.OnHand) || 0;
}

/**
 * ID kho KiotViet: ưu tiên kho con (masterLocationId 73531/73533).
 * API KV luôn gắn branchId = chi nhánh cha 24862 — nếu lấy branchId trước thì lọc kho ra 0.
 */
export function kvWarehouseId(inv: Inv | null | undefined): number {
  const x = inv as Inv & Record<string, unknown>;
  if (!x) return 0;
  const loc = Number(
    x.masterLocationId ?? x.MasterLocationId ?? x.locationId ?? x.LocationId
  );
  if (Number.isFinite(loc) && loc > 0 && loc !== KV_PARENT_BRANCH_ID) return loc;
  const bid = Number(x.branchId ?? x.BranchId);
  if (bid === KV_SALES_AREA_ID || bid === KV_CENTRAL_WAREHOUSE_ID) return bid;
  const name = String(x.branchName ?? x.BranchName ?? x.name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (name.includes("khu vuc ban")) return KV_SALES_AREA_ID;
  if (name.includes("kho trung tam")) return KV_CENTRAL_WAREHOUSE_ID;
  if (Number.isFinite(loc) && loc > 0) return loc;
  return Number.isFinite(bid) && bid > 0 ? bid : 0;
}

function invBranchId(x: Inv | null | undefined): number {
  return kvWarehouseId(x);
}

/** Gộp theo kho: cùng branchId thì cộng onHand (HD1: 140+29). Trùng số y hệt thì bỏ bản sao API. */
function uniqueByBranch(inventories: Inv[]): Inv[] {
  const map = new Map<number, Inv & { onHand: number }>();
  for (const x of inventories) {
    const bid = invBranchId(x);
    if (!Number.isFinite(bid) || bid <= 0) continue;
    const n = invOnHand(x);
    const prev = map.get(bid);
    if (!prev) {
      map.set(bid, { ...x, branchId: bid, onHand: n });
      continue;
    }
    if (n === prev.onHand) continue;
    prev.onHand = (Number(prev.onHand) || 0) + n;
  }
  return [...map.values()];
}

function onHandAt(inv: Inv[], branchId: number): number {
  for (let i = inv.length - 1; i >= 0; i--) {
    if (invBranchId(inv[i]) === branchId) return invOnHand(inv[i]);
  }
  return 0;
}

/** Tồn khu bán hàng: ưu tiên kho con; chỉ lấy cha khi kho con = 0 */
export function salesAreaOnHand(inv: Inv[]): number {
  const rows = uniqueByBranch(inv);
  const sales = onHandAt(rows, KV_SALES_AREA_ID);
  if (sales !== 0) return sales;
  return onHandAt(rows, KV_PARENT_BRANCH_ID);
}

/**
 * Tổng tồn khi không có số KiotViet cấp SP — cộng từng kho (mỗi branchId một lần).
 */
export function sumInventoriesOnHand(inventories: Inv[] | null | undefined): number {
  const inv = uniqueByBranch(Array.isArray(inventories) ? inventories : []);
  let n = 0;
  for (const x of inv) n += invOnHand(x);
  return n;
}

/**
 * Tồn hiển thị theo kho đang chọn.
 * @param branchId kho/chi nhánh đang lọc; bỏ trống = tổng
 */
export function resolveProductTon(
  p: {
    kvTon?: number | null;
    ton?: number | null;
    tonKho?: number | null;
    onHand?: number | null;
    inventories?: Inv[] | null;
  } | null | undefined,
  branchId?: number | string | null
): number {
  if (!p) return 0;
  const bid = Number(branchId);
  const inv = Array.isArray(p.inventories) ? p.inventories : [];

  if (Number.isFinite(bid) && bid > 0) {
    // Một kho: chỉ inventories của kho đó. Không lấy kvTon (tổng tất cả kho, vd HD1 = 169).
    return tonFromInventories(inv, bid);
  }

  // Tất cả kho = số KiotViet trên thẻ SP (không cộng lại inventories).
  if (p.kvTon != null && p.kvTon !== ("" as any)) {
    const kv = Number(p.kvTon);
    if (Number.isFinite(kv)) return kv;
  }
  const direct = Number(p.onHand ?? p.ton ?? p.tonKho);
  if (Number.isFinite(direct) && (p.onHand != null || p.ton != null || p.tonKho != null)) {
    return direct;
  }
  if (inv.length > 0) return sumInventoriesOnHand(inv);
  return 0;
}

/** Tồn hiện tại từ catalog — danh sách đã lưu. Không đổi cách tính tồn. */
export function liveTonFromCatalog(
  ma: string | undefined,
  catalog:
    | Map<string, Parameters<typeof resolveProductTon>[0]>
    | Array<{ ma?: string } & Parameters<typeof resolveProductTon>[0]>
    | null
    | undefined,
  fallback?: number
): number {
  const key = String(ma || "").trim().toUpperCase();
  if (!key) return Number(fallback) || 0;
  let p: Parameters<typeof resolveProductTon>[0] | undefined;
  if (catalog instanceof Map) p = catalog.get(key);
  else if (Array.isArray(catalog)) {
    p = catalog.find((x) => String(x?.ma || "").trim().toUpperCase() === key);
  }
  if (p) return resolveProductTon(p);
  return Number(fallback) || 0;
}

/** Mongo: còn hàng đúng kho đang lọc (không lấy tồn chi nhánh cha). */
export function mongoBranchTonConFilter(branchId: number): Record<string, unknown> {
  return { inventories: { $elemMatch: { branchId, onHand: { $gt: 0 } } } };
}

/** Mongo: hết hàng đúng kho đang lọc. */
export function mongoBranchTonHetFilter(branchId: number): Record<string, unknown> {
  return {
    inventories: { $elemMatch: { branchId, onHand: { $not: { $gt: 0 } } } },
  };
}

/** Tồn theo kho từ inventories. Không đụng số «Tất cả kho» (kvTon). */
export function tonFromInventories(inventories: Inv[] | null | undefined, branchId: number): number {
  const raw = Array.isArray(inventories) ? inventories : [];
  const tagged = uniqueByBranch(raw);
  const exact = onHandAt(tagged, branchId);
  const hasExactId = raw.some((x) => kvWarehouseId(x) === branchId);
  if (hasExactId) return exact;

  if (branchId !== KV_SALES_AREA_ID && branchId !== KV_CENTRAL_WAREHOUSE_ID) {
    return exact;
  }

  // API KV thường chỉ ghi chi nhánh cha 24862, 2 dòng tồn (vd HD1: 8 và 161).
  const parentOnHands: number[] = [];
  for (const x of raw) {
    const id = kvWarehouseId(x);
    if (id === KV_SALES_AREA_ID || id === KV_CENTRAL_WAREHOUSE_ID) continue;
    if (id === KV_PARENT_BRANCH_ID || id === 0) parentOnHands.push(invOnHand(x));
  }
  const uniq: number[] = [];
  for (const n of parentOnHands) {
    if (!uniq.includes(n)) uniq.push(n);
  }
  if (uniq.length === 2) {
    const lo = Math.min(uniq[0], uniq[1]);
    const hi = Math.max(uniq[0], uniq[1]);
    return branchId === KV_SALES_AREA_ID ? lo : hi;
  }
  return exact;
}

/** SP có dòng tồn kho đang lọc (kể cả kho con ghi nhầm ID cha). */
export function mongoHasWarehouseFilter(branchId: number): Record<string, unknown> {
  if (branchId === KV_SALES_AREA_ID || branchId === KV_CENTRAL_WAREHOUSE_ID) {
    return {
      inventories: {
        $elemMatch: {
          $or: [
            { branchId },
            { masterLocationId: branchId },
            { branchId: KV_PARENT_BRANCH_ID },
          ],
        },
      },
    };
  }
  return { inventories: { $elemMatch: { branchId } } };
}
