import { isRetailDvt, variantGroupKey, type ShopAttr } from "./keys.js";

export function scoreCanonical(doc: {
  dvt?: string;
  ton?: number;
  onHand?: number;
  kvTon?: number;
  gia?: number;
  ma?: string;
}): number {
  const ton = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0) || 0;
  const retail = isRetailDvt(String(doc.dvt || "")) ? 1_000_000 : 0;
  const inStock = ton > 0 ? 100_000 : 0;
  const gia = Number(doc.gia) || 0;
  const priceScore = gia > 0 ? Math.max(0, 50_000 - Math.min(gia / 1000, 50_000)) : 0;
  return retail + inStock + priceScore;
}

/** Dedupe list cards trong 1 batch (in-memory). */
export function dedupeCanonicalPublic<
  T extends { ma: string; dvt: string; ton: number; gia: number; ten: string }
>(
  items: T[],
  attrsByMa: Map<string, ShopAttr[]>,
  _nhomByMa?: Map<string, string>
): T[] {
  const groups = new Map<string, T[]>();
  const singles: T[] = [];
  for (const it of items) {
    const attrs = attrsByMa.get(it.ma.toUpperCase()) || [];
    if (!attrs.length) {
      singles.push(it);
      continue;
    }
    // Cùng khóa với variantGroupKey — không gắn nhom / baseName strip.
    const key = variantGroupKey({ ten: it.ten, attributes: attrs });
    if (!key) {
      singles.push(it);
      continue;
    }
    const arr = groups.get(key) || [];
    arr.push(it);
    groups.set(key, arr);
  }
  const out: T[] = [...singles];
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const sa = scoreCanonical(a);
      const sb = scoreCanonical(b);
      if (sb !== sa) return sb - sa;
      return a.ma.localeCompare(b.ma);
    });
    const pick = arr[0];
    // Tồn card = tổng nhóm cùng loại (giống dòng tổng KV) — chỉ khi đọc, không ghi Mongo.
    const familyTon = arr.reduce((s, x) => s + (Number(x.ton) || 0), 0);
    out.push(familyTon > (Number(pick.ton) || 0) ? { ...pick, ton: familyTon } : pick);
  }

  // Mongo có thể có 2 bản ghi cùng mã (đồng bộ KV) → 1 card / mã trên lưới shop.
  const byMa = new Map<string, T>();
  for (const it of out) {
    const k = String(it.ma || "")
      .trim()
      .toUpperCase();
    if (!k) continue;
    const prev = byMa.get(k);
    if (!prev) {
      byMa.set(k, it);
      continue;
    }
    const prefer =
      scoreCanonical(it) > scoreCanonical(prev)
        ? it
        : scoreCanonical(it) < scoreCanonical(prev)
          ? prev
          : (Number(it.ton) || 0) >= (Number(prev.ton) || 0)
            ? it
            : prev;
    byMa.set(k, prefer);
  }
  return [...byMa.values()];
}
