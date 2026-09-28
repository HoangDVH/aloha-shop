import { escapeRx, normKey, type ShopAttr } from "./keys.js";

export function parseAttrQuery(raw: unknown): ShopAttr[] {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  const out: ShopAttr[] = [];
  for (const item of list) {
    const s = String(item || "").trim();
    if (!s) continue;
    const i = s.indexOf(":");
    if (i <= 0) continue;
    const attributeName = s.slice(0, i).trim();
    const attributeValue = s.slice(i + 1).trim();
    if (attributeName && attributeValue) out.push({ attributeName, attributeValue });
  }
  return out;
}

export function parseDvtQuery(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  return [...new Set(list.map((x) => String(x || "").trim()).filter(Boolean))];
}

/**
 * Gom ĐVT lẻ tẻ (THÙNG 96…, CÁI/Cái) → nhãn chuẩn cho bộ lọc.
 * Chỉ dùng khi đọc/hiển thị — không ghi Mongo.
 */
export function canonicalizeDvt(raw: string): string | null {
  const k = normKey(raw).replace(/\s+/g, " ");
  if (!k) return null;
  if (k.includes("thung")) return "Thùng";
  if (k === "cay" || k === "cay.") return "Cây";
  if (k === "chau" || k === "chau.") return "Chậu";
  if (k === "cai" || k === "cai.") return "Cái";
  if (k === "goi" || k.startsWith("goi ")) return "Gói";
  if (k === "bao" || k.startsWith("bao ") || /^bao\d/.test(k)) return "Bao";
  if (k === "bich" || k.startsWith("bich ")) return "Bịch";
  if (k === "tui" || k.startsWith("tui ")) return "Túi";
  if (k === "bo" || k.startsWith("bo ")) return "Bộ";
  if (k === "set" || k.startsWith("set ")) return "Set";
  if (k === "hop" || k.startsWith("hop ") || k.includes("hop ")) return "Hộp";
  if (k.includes("loc ") || k.startsWith("loc") || k.includes("lốc")) return "Lốc";
  if (k === "kg" || k.includes(" kg") || k.endsWith("kg") || k.startsWith("1 kg") || k.includes("1kg"))
    return "Kg";
  if (k.includes("gram")) return "Gram";
  if (k === "chai" || k.startsWith("chai ")) return "Chai";
  if (k === "hu" || k.startsWith("hu ")) return "Hũ";
  if (k === "con" || k.startsWith("con ")) return "Con";
  if (k === "vi" || k.startsWith("vi ")) return "Vỉ";
  // Quá cụ thể / lạ → không đưa vào facet (tránh tường chip)
  return null;
}

/** Match lọc ĐVT theo nhãn đã gom (Thùng khớp mọi dvt chứa thùng…). */
export function mongoDvtFilter(selected: string[]): Record<string, unknown> | null {
  if (!selected.length) return null;
  const ors: Record<string, unknown>[] = [];
  for (const s of selected) {
    const bucket = canonicalizeDvt(s) || s.trim();
    const bk = normKey(bucket);
    if (bk === "thung") ors.push({ dvt: { $regex: /thùng|thung/i } });
    else if (bk === "cay") ors.push({ dvt: { $regex: /^cây$|^cay$/i } });
    else if (bk === "chau") ors.push({ dvt: { $regex: /^chậu$|^chau$/i } });
    else if (bk === "cai") ors.push({ dvt: { $regex: /^cái$|^cai$/i } });
    else if (bk === "goi") ors.push({ dvt: { $regex: /gói|goi/i } });
    else if (bk === "bao") ors.push({ dvt: { $regex: /^bao|\bbao/i } });
    else if (bk === "bich") ors.push({ dvt: { $regex: /bịch|bich/i } });
    else if (bk === "tui") ors.push({ dvt: { $regex: /túi|tui/i } });
    else if (bk === "bo") ors.push({ dvt: { $regex: /^bộ$|^bo$/i } });
    else if (bk === "set") ors.push({ dvt: { $regex: /^set/i } });
    else if (bk === "hop") ors.push({ dvt: { $regex: /hộp|hop/i } });
    else if (bk === "loc") ors.push({ dvt: { $regex: /lốc|loc/i } });
    else if (bk === "kg") ors.push({ dvt: { $regex: /kg/i } });
    else if (bk === "gram") ors.push({ dvt: { $regex: /gram/i } });
    else if (bk === "chai") ors.push({ dvt: { $regex: /chai/i } });
    else if (bk === "hu") ors.push({ dvt: { $regex: /^hũ$|^hu$/i } });
    else if (bk === "con") ors.push({ dvt: { $regex: /^con$/i } });
    else if (bk === "vi") ors.push({ dvt: { $regex: /^vỉ$|^vi$/i } });
    else ors.push({ dvt: new RegExp(`^${escapeRx(s)}$`, "i") });
  }
  return ors.length === 1 ? ors[0] : { $or: ors };
}

/** Gom + xếp ĐVT facet; bỏ giá trị lẻ không map được. */
export function compactDvtFacetLabels(
  rows: { label: string; count: number }[],
  max = 10
): string[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const b = canonicalizeDvt(r.label);
    if (!b) continue;
    map.set(b, (map.get(b) || 0) + (Number(r.count) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
    .slice(0, max)
    .map(([k]) => k);
}

/** Giới hạn section attr + số value (theo count). */
export function compactAttributeFacets(
  rows: { name: string; value: string; count: number }[],
  opts?: { maxAttrs?: number; maxValues?: number }
): Record<string, string[]> {
  const maxAttrs = opts?.maxAttrs ?? 6;
  const maxValues = opts?.maxValues ?? 16;
  const byName = new Map<string, { value: string; count: number }[]>();
  const nameCount = new Map<string, number>();
  for (const r of rows) {
    const n = String(r.name || "").trim();
    const v = String(r.value || "").trim();
    if (!n || !v) continue;
    if (!byName.has(n)) byName.set(n, []);
    const arr = byName.get(n)!;
    if (!arr.some((x) => normKey(x.value) === normKey(v))) {
      arr.push({ value: v, count: Number(r.count) || 0 });
    }
    nameCount.set(n, (nameCount.get(n) || 0) + (Number(r.count) || 0));
  }
  const names = [...nameCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxAttrs)
    .map(([n]) => n);
  const out: Record<string, string[]> = {};
  for (const n of names) {
    const vals = (byName.get(n) || [])
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "vi"))
      .slice(0, maxValues)
      .map((x) => x.value);
    if (vals.length) out[n] = vals;
  }
  return out;
}

/** Lọc Mongo theo loại hàng KV (chỉ đọc). */
export function mongoLoaiFilter(loaiRaw: string): Record<string, unknown> | null {
  const s = String(loaiRaw || "").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  let kind = "";
  if (s === "thuong" || low === "hàng hóa thường" || low === "hang hoa thuong") kind = "thuong";
  else if (
    s === "san_xuat" ||
    s === "sx" ||
    low.includes("sản xuất") ||
    low.includes("san xuat")
  )
    kind = "san_xuat";
  else if (s === "combo" || low.startsWith("combo")) kind = "combo";
  else if (s === "dich_vu" || low === "dịch vụ" || low === "dich vu") kind = "dich_vu";
  else if (s === "1") kind = "combo";
  else if (s === "3") kind = "dich_vu";
  else return null;

  const hasFormulaClause = {
    $or: [
      { productFormulas: { $exists: true, $type: "array", $ne: [] } },
      { ProductFormulas: { $exists: true, $type: "array", $ne: [] } },
      { isProcessedGoods: true },
    ],
  };
  const noFormulaClause = {
    $nor: [
      { productFormulas: { $exists: true, $type: "array", $ne: [] } },
      { ProductFormulas: { $exists: true, $type: "array", $ne: [] } },
      { isProcessedGoods: true },
    ],
  };
  const typeMatch = (n: number, labels: string[]) => ({
    $or: [
      { type: n },
      { productType: n },
      { loai: n },
      { loai: String(n) },
      ...labels.map((l) => ({ loai: l })),
    ],
  });

  if (kind === "combo") {
    return typeMatch(1, ["Combo - đóng gói", "Combo"]);
  }
  if (kind === "dich_vu") {
    return typeMatch(3, ["Dịch vụ"]);
  }
  if (kind === "san_xuat") {
    return {
      $and: [
        typeMatch(2, ["Hàng sản xuất", "Hàng hóa sản xuất", "Hàng hóa - sản xuất", "Hàng hóa thường", "Hàng hóa"]),
        hasFormulaClause,
      ],
    };
  }
  // thuong
  return {
    $and: [
      typeMatch(2, ["Hàng hóa thường", "Hàng hóa", "Hàng sản xuất"]),
      noFormulaClause,
    ],
  };
}

/** Match document có đủ các cặp attr (AND); name không phân biệt hoa thường. */
export function mongoAttrFilter(attrs: ShopAttr[]): Record<string, unknown> | null {
  if (!attrs.length) return null;
  const and: Record<string, unknown>[] = [];
  for (const a of attrs) {
    and.push({
      attributes: {
        $elemMatch: {
          $or: [
            { attributeName: a.attributeName, attributeValue: a.attributeValue },
            {
              attributeName: new RegExp(`^${escapeRx(a.attributeName)}$`, "i"),
              attributeValue: new RegExp(`^${escapeRx(a.attributeValue)}$`, "i"),
            },
            { name: a.attributeName, value: a.attributeValue },
          ],
        },
      },
    });
  }
  return and.length === 1 ? and[0] : { $and: and };
}
