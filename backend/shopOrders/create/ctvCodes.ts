import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../../shopAuth/models.js";
import type { ShopOrderDetail } from "../models.js";

async function filterActiveCtvCodes(shopDb: Db, codes: string[]): Promise<Set<string>> {
  const uniq = [
    ...new Set(codes.map((c) => normalizeCtvCode(c)).filter((c) => c.length >= 3)),
  ];
  if (!uniq.length) return new Set();
  const rows = await shopDb
    .collection(SHOP_ACCOUNTS)
    .find({
      ctvCode: { $in: uniq },
      roles: "ctv",
      ctvStatus: "active",
      active: { $ne: false },
    })
    .project({ ctvCode: 1 })
    .toArray();
  return new Set(rows.map((r) => normalizeCtvCode(String((r as any).ctvCode || ""))));
}

/** Chỉ giữ ctvCode của CTV đang active (mã giả / khóa → bỏ). */
export async function keepActiveCtvCodes(
  shopDb: Db,
  details: ShopOrderDetail[]
): Promise<ShopOrderDetail[]> {
  const rawCodes = details.map((d) => d.ctvCode).filter(Boolean) as string[];
  const active = await filterActiveCtvCodes(shopDb, rawCodes);
  return details.map((d) => {
    const c = normalizeCtvCode(String(d.ctvCode || ""));
    if (!c || !active.has(c)) {
      const { ctvCode: _drop, ...rest } = d;
      return rest;
    }
    return { ...d, ctvCode: c };
  });
}
