/**
 * Trạng thái bán trên shop theo KiotViet: SP bị xoá hoặc ngừng kinh doanh trên KV → isActive=false,
 * KV bán lại → isActive=true. Ẩn/hiện tay trên shop dùng hienThiWeb, không dùng isActive.
 */

export type KvActiveDoc = { _id: unknown; ma?: unknown; isActive?: unknown };

export type KvActiveReason = "kv_deleted" | "kv_inactive" | "kv_active";

export type KvActiveChange = {
  _id: unknown;
  ma: string;
  isActive: boolean;
  reason: KvActiveReason;
};

export type KvActivePlan = {
  changes: KvActiveChange[];
  /** Số mã vắng trên KV nhưng không ẩn vì danh sách KV nghi thiếu (an toàn). */
  blockedDeletes: number;
};

/** Danh sách KV full ít hơn mức này → coi là trả thiếu, không ẩn SP vắng mặt. */
export const MIN_FULL_KV_PRODUCTS = 1000;
/** Ẩn vì vắng trên KV quá nhiều trong một lần → nghi lỗi API, không ẩn. */
export const MAX_DELETE_RATIO = 0.1;
const MIN_DELETE_CAP = 50;

function normMa(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

/**
 * @param shopDocs SP shop chưa gộp (mergedInto). Full sync: toàn bộ; delta: các mã KV vừa trả.
 * @param kvProducts SP KV (field code, isActive).
 * @param full true khi kvProducts là danh sách đầy đủ — chỉ khi đó mới ẩn SP vắng trên KV.
 */
export function planKvActiveChanges(
  shopDocs: KvActiveDoc[],
  kvProducts: Array<Record<string, unknown>>,
  opts: { full: boolean }
): KvActivePlan {
  const kvByMa = new Map<string, Record<string, unknown>>();
  for (const p of kvProducts) {
    const ma = normMa(p.code ?? p.Code ?? p.ma);
    if (ma) kvByMa.set(ma, p);
  }

  const changes: KvActiveChange[] = [];
  const deletes: KvActiveChange[] = [];
  for (const doc of shopDocs) {
    const ma = normMa(doc.ma);
    if (!ma) continue;
    const kv = kvByMa.get(ma);
    if (kv) {
      const sellable = kv.isActive !== false;
      if (!sellable && doc.isActive !== false) {
        changes.push({ _id: doc._id, ma, isActive: false, reason: "kv_inactive" });
      } else if (sellable && doc.isActive === false) {
        changes.push({ _id: doc._id, ma, isActive: true, reason: "kv_active" });
      }
    } else if (opts.full && doc.isActive !== false) {
      deletes.push({ _id: doc._id, ma, isActive: false, reason: "kv_deleted" });
    }
  }

  const cap = Math.max(MIN_DELETE_CAP, Math.floor(shopDocs.length * MAX_DELETE_RATIO));
  if (deletes.length && (kvProducts.length < MIN_FULL_KV_PRODUCTS || deletes.length > cap)) {
    return { changes, blockedDeletes: deletes.length };
  }
  return { changes: [...changes, ...deletes], blockedDeletes: 0 };
}
