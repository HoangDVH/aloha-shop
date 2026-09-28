import type { Db, Document } from "mongodb";
import {
  attrKeySet,
  escapeRx,
  isRetailDvt,
  normKey,
  normProductTen,
  normalizeAttrs,
  shopActiveAnd,
  variantGroupKey,
  SIBLING_PROJ,
  type Publicizer,
  type VariantModel,
} from "./keys.js";

export function toVariantModel(
  doc: Record<string, unknown>,
  toPublic: Publicizer
): VariantModel {
  const p = toPublic(doc);
  return {
    ma: p.ma,
    ten: p.ten,
    dvt: p.dvt,
    gia: p.gia,
    webPrice: p.webPrice,
    priceKind: p.priceKind,
    allowBackorder: p.allowBackorder,
    ton: p.ton,
    anh: p.anh,
    images: p.images,
    videos: p.videos?.length ? p.videos : undefined,
    path: p.path,
    attributes: normalizeAttrs(doc.attributes),
    masterCode: doc.masterCode != null ? String(doc.masterCode).trim() || null : null,
  };
}

/** Siblings cùng nhóm biến thể (attr) — read-only. */
export async function findAttrSiblings(
  db: Db,
  colName: string,
  seed: Record<string, unknown>,
  limit = 40
): Promise<Record<string, unknown>[]> {
  const attrs = normalizeAttrs(seed.attributes);
  if (!attrs.length) return [seed];
  const gkey = variantGroupKey(seed);
  if (!gkey) return [seed];

  const tenRaw = String(seed.ten || "").trim();
  const tenNorm = normProductTen(tenRaw);
  if (!tenNorm) return [seed];

  const keySet = attrKeySet(attrs);
  const names = keySet.split("|").filter(Boolean);

  // Lọc theo tên hàng (không theo nhom) — khớp «Hàng hóa cùng loại» KV.
  const filter: Document = {
    $and: [
      ...shopActiveAnd(),
      { "attributes.0": { $exists: true } },
      {
        $or: [
          { ten: tenRaw },
          { ten: new RegExp(`^${escapeRx(tenRaw)}$`, "i") },
        ],
      },
    ],
  };

  const docs = await db
    .collection(colName)
    .find(filter)
    .project(SIBLING_PROJ)
    .limit(Math.min(200, limit * 5))
    .toArray();

  const matched = docs.filter((d) => {
    const a = normalizeAttrs((d as any).attributes);
    if (attrKeySet(a) !== keySet) return false;
    const have = new Set(a.map((x) => normKey(x.attributeName)));
    if (names.some((n) => !have.has(n))) return false;
    return variantGroupKey(d as any) === gkey;
  }) as Record<string, unknown>[];

  if (!matched.some((d) => String(d.ma) === String(seed.ma))) {
    matched.unshift(seed);
  }

  // dedupe ma
  const byMa = new Map<string, Record<string, unknown>>();
  for (const d of matched) {
    const ma = String(d.ma || "").trim().toUpperCase();
    if (!ma) continue;
    if (!byMa.has(ma)) byMa.set(ma, d);
  }
  return [...byMa.values()].slice(0, limit);
}

/** Cặp ĐVT Thùng/Cây — read-only (masterCode / cùng tên / mã T…). */
export async function findUnitPairDocs(
  db: Db,
  colName: string,
  seed: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const ma = String(seed.ma || "").trim();
  if (!ma) return [seed];
  const maUpper = ma.toUpperCase();
  const masterCode = seed.masterCode != null ? String(seed.masterCode).trim() : "";
  const masterProductId =
    seed.masterProductId != null && seed.masterProductId !== ""
      ? Number(seed.masterProductId)
      : null;

  const or: Document[] = [{ ma }, { ma: maUpper }, { ma: ma.toLowerCase() }];
  if (masterCode) {
    or.push({ ma: masterCode }, { ma: masterCode.toUpperCase() }, { masterCode: ma });
    or.push({ masterCode: maUpper });
  }
  if (masterProductId && Number.isFinite(masterProductId)) {
    or.push({ masterProductId });
    or.push({ id: masterProductId });
  }
  // Quy ước ALOHA: mã thùng = T + mã lẻ (TNGBMNT40 ↔ NGBMNT40)
  if (maUpper.startsWith("T") && maUpper.length > 2) {
    const base = maUpper.slice(1);
    or.push({ ma: base }, { ma: base.toLowerCase() }, { masterCode: base });
  } else {
    or.push({ ma: `T${maUpper}` }, { ma: `t${ma.toLowerCase()}` });
    or.push({ masterCode: maUpper }, { masterCode: `T${maUpper}` });
  }

  const docs = await db
    .collection(colName)
    .find({ $and: [...shopActiveAnd(), { $or: or }] } as any)
    .project(SIBLING_PROJ)
    .limit(12)
    .toArray();

  const byMa = new Map<string, Record<string, unknown>>();
  for (const d of [seed, ...docs]) {
    const k = String(d.ma || "").trim().toUpperCase();
    if (k) byMa.set(k, d as Record<string, unknown>);
  }
  let list = [...byMa.values()];
  let dvts = new Set(list.map((d) => normKey(String(d.dvt || ""))));
  if (dvts.size >= 2) return list;

  // Fallback: cùng tên hàng, một mã Cây/Cái và một mã Thùng (không cần masterCode).
  const tenRaw = String(seed.ten || "").trim();
  if (tenRaw) {
    const byTen = await db
      .collection(colName)
      .find({
        $and: [
          ...shopActiveAnd(),
          {
            $or: [
              { ten: tenRaw },
              { ten: new RegExp(`^${escapeRx(tenRaw)}$`, "i") },
            ],
          },
        ],
      } as any)
      .project(SIBLING_PROJ)
      .limit(24)
      .toArray();

    for (const d of byTen) {
      const k = String(d.ma || "").trim().toUpperCase();
      if (k) byMa.set(k, d as Record<string, unknown>);
    }
    list = [...byMa.values()].filter((d) => {
      const dvt = String(d.dvt || "");
      const k = normKey(dvt);
      return isRetailDvt(dvt) || k.includes("thung");
    });
    const hasRetail = list.some((d) => isRetailDvt(String(d.dvt || "")));
    const hasThung = list.some((d) => normKey(String(d.dvt || "")).includes("thung"));
    if (hasRetail && hasThung) return list.slice(0, 12);
  }

  return [seed];
}

export function buildAxesAndModels(
  docs: Record<string, unknown>[],
  toPublic: Publicizer,
  currentMa: string
): {
  axes: {
    name: string;
    kind: "attr" | "unit";
    values: { value: string; image?: string; available: boolean }[];
  }[];
  models: VariantModel[];
  current: VariantModel | null;
} {
  const models = docs.map((d) => toVariantModel(d, toPublic));
  // dedupe by ma
  const byMa = new Map<string, VariantModel>();
  for (const m of models) {
    const k = m.ma.toUpperCase();
    if (!byMa.has(k)) byMa.set(k, m);
  }
  const uniq = [...byMa.values()];
  const current =
    uniq.find((m) => m.ma.toUpperCase() === currentMa.toUpperCase()) || uniq[0] || null;

  const attrNames: string[] = [];
  const nameCanon = new Map<string, string>();
  for (const m of uniq) {
    for (const a of m.attributes) {
      const nk = normKey(a.attributeName);
      if (!nk) continue;
      if (!nameCanon.has(nk)) {
        nameCanon.set(nk, a.attributeName);
        attrNames.push(a.attributeName);
      }
    }
  }

  const axes: {
    name: string;
    kind: "attr" | "unit";
    values: { value: string; image?: string; available: boolean }[];
  }[] = [];

  for (const name of attrNames) {
    const nk = normKey(name);
    const vals = new Map<string, { value: string; image?: string; available: boolean }>();
    for (const m of uniq) {
      const hit = m.attributes.find((a) => normKey(a.attributeName) === nk);
      if (!hit) continue;
      const vk = normKey(hit.attributeValue);
      const prev = vals.get(vk);
      const available = m.ton > 0;
      if (!prev) {
        vals.set(vk, {
          value: hit.attributeValue,
          image: m.anh || undefined,
          available,
        });
      } else {
        prev.available = prev.available || available;
        if (!prev.image && m.anh) prev.image = m.anh;
      }
    }
    axes.push({
      name: nameCanon.get(nk) || name,
      kind: "attr",
      values: [...vals.values()],
    });
  }

  const unitVals = new Map<string, { value: string; available: boolean }>();
  for (const m of uniq) {
    const d = (m.dvt || "Cái").trim() || "Cái";
    const vk = normKey(d);
    const prev = unitVals.get(vk);
    if (!prev) unitVals.set(vk, { value: d, available: m.ton > 0 });
    else prev.available = prev.available || m.ton > 0;
  }
  if (unitVals.size >= 2) {
    axes.push({
      name: "Đơn vị",
      kind: "unit",
      values: [...unitVals.values()].map((v) => ({
        value: v.value,
        available: v.available,
      })),
    });
  }

  return { axes, models: uniq, current };
}
