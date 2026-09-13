/**
 * Chuẩn hóa loại hàng theo KiotViet.
 *
 * Public API `productType` / field `type` trên SP:
 * - 1 = Combo - đóng gói
 * - 2 = Hàng hóa (thường hoặc sản xuất)
 * - 3 = Dịch vụ
 *
 * Hàng sản xuất = type 2 + có hàng thành phần (productFormulas / thanhPhan).
 * (Một số bản tài liệu cũ gộp combo+sản xuất vào type 1 — với kho ALOHA type 1 là combo.)
 */

export type KvLoaiKind = "thuong" | "san_xuat" | "combo" | "dich_vu" | "";

export const KV_LOAI_OPTIONS: { value: KvLoaiKind; label: string; typeNum: number }[] = [
  { value: "thuong", label: "Hàng hóa thường", typeNum: 2 },
  { value: "san_xuat", label: "Hàng sản xuất", typeNum: 2 },
  { value: "combo", label: "Combo - đóng gói", typeNum: 1 },
  { value: "dich_vu", label: "Dịch vụ", typeNum: 3 },
];

export function hasKvFormulas(p: any): boolean {
  if (!p) return false;
  // Chỉ công thức KV thật — không tin hasFormula flag / thanhPhan (sync từng tạo giả cho mã thùng).
  if (Array.isArray(p.productFormulas) && p.productFormulas.length > 0) return true;
  if (Array.isArray(p.ProductFormulas) && p.ProductFormulas.length > 0) return true;
  if (p.isProcessedGoods === true) return true;
  return false;
}

/** Lấy mã loại số KV (1/2/3) từ doc đã lưu hoặc raw API. */
export function resolveKvTypeNum(p: any): number | null {
  if (!p) return null;
  const candidates = [p.productType, p.ProductType, p.type, p.Type, p.loai];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    if (typeof c === "string") {
      const s = c.trim().toLowerCase();
      if (
        s === "combo" ||
        s === "combo - đóng gói" ||
        s.includes("combo")
      )
        return 1;
      if (s === "dịch vụ" || s === "dich vu" || s.includes("dịch vụ") || s.includes("dich vu"))
        return 3;
      if (
        s === "hàng hóa" ||
        s === "hang hoa" ||
        s === "hàng hóa thường" ||
        s === "hàng sản xuất" ||
        s === "hang san xuat" ||
        s.includes("hàng hóa") ||
        s.includes("hang hoa")
      )
        return 2;
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        if (n === 1 || n === 2 || n === 3) return n;
      }
      continue;
    }
    const n = Number(c);
    if (n === 1 || n === 2 || n === 3) return n;
  }
  return null;
}

export function kvLoaiLabel(kind: KvLoaiKind): string {
  return KV_LOAI_OPTIONS.find((o) => o.value === kind)?.label || "";
}

/** Phân loại chi tiết cho UI / lọc — khớp KiotViet: SX = type 2 + định mức thật. */
export function resolveKvLoaiKind(p: any): KvLoaiKind {
  const raw = String(p?.loai || "").trim().toLowerCase();
  if (raw.includes("combo")) return "combo";
  if (raw.includes("dịch vụ") || raw.includes("dich vu")) return "dich_vu";

  const n = resolveKvTypeNum(p);
  if (n === 3) return "dich_vu";
  if (n === 1) return "combo";
  if (n === 2) {
    // Type 2 + định mức → sản xuất (nhãn «Hàng sản xuất» không đủ nếu không có formulas)
    if (hasKvFormulas(p)) return "san_xuat";
    return "thuong";
  }

  // Fallback khi thiếu type số: tin nhãn + formulas
  if ((raw.includes("sản xuất") || raw.includes("san xuat")) && hasKvFormulas(p))
    return "san_xuat";
  if (raw.includes("thường") || raw.includes("thuong") || raw.includes("hàng hóa") || raw.includes("hang hoa"))
    return "thuong";
  return "";
}

/** Chuỗi lọc từ UI/query → kind. */
export function parseLoaiFilter(raw: string): KvLoaiKind | "" {
  const s = String(raw || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (s === "thuong" || low === "hàng hóa thường" || low === "hang hoa thuong" || s === "2t")
    return "thuong";
  if (
    s === "san_xuat" ||
    s === "sx" ||
    low === "hàng sản xuất" ||
    low === "hang san xuat" ||
    low === "hàng hóa - sản xuất" ||
    low === "hang hoa - san xuat" ||
    low.includes("sản xuất") ||
    low.includes("san xuat") ||
    s === "2s"
  )
    return "san_xuat";
  if (
    s === "combo" ||
    s === "1" ||
    low === "combo - đóng gói" ||
    low === "combo - dong goi" ||
    low.startsWith("combo")
  )
    return "combo";
  if (s === "dich_vu" || s === "3" || low === "dịch vụ" || low === "dich vu") return "dich_vu";
  // "2" / "Hàng hóa" = mọi hàng type 2 (thường + sản xuất) — giữ tương thích cũ
  if (s === "2" || low === "hàng hóa" || low === "hang hoa") return "thuong";
  return "";
}

/** Nhãn lưu Mongo `loai` (chuỗi tiếng Việt). */
export function loaiLabelFromProduct(p: any): string {
  const kind = resolveKvLoaiKind(p);
  return kvLoaiLabel(kind) || (resolveKvTypeNum(p) === 2 ? "Hàng hóa thường" : "");
}

/** Filter Mongo cho loại hàng — chỉ đọc, không ghi. */
export function mongoLoaiFilter(raw: string): Record<string, unknown> | null {
  const kind = parseLoaiFilter(raw);
  if (!kind) return null;

  // Công thức KV thật — không dùng hasFormula / thanhPhan (false positive với mã thùng).
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
    return {
      $or: [
        typeMatch(1, ["Combo - đóng gói", "Combo"]),
        { loaiHang: { $in: ["combo", "Combo"] } },
      ],
    };
  }
  if (kind === "dich_vu") {
    return {
      $or: [
        typeMatch(3, ["Dịch vụ"]),
        { loaiHang: { $in: ["dichvu", "dich_vu", "DichVu"] } },
      ],
    };
  }
  if (kind === "san_xuat") {
    // Khớp KiotViet: type 2 + định mức / công thức thật (không tin nhãn hay hasFormula flag).
    return {
      $and: [
        typeMatch(2, [
          "Hàng sản xuất",
          "Hàng hóa sản xuất",
          "Hàng hóa - sản xuất",
          "Hàng hóa thường",
          "Hàng hóa",
        ]),
        hasFormulaClause,
      ],
    };
  }
  if (kind === "thuong") {
    return {
      $and: [
        {
          $or: [
            typeMatch(2, ["Hàng hóa thường", "Hàng hóa", "Hàng sản xuất"]),
            { loaiHang: { $in: ["thuong", "hangthung"] } },
          ],
        },
        noFormulaClause,
        { loaiHang: { $nin: ["hsx", "san_xuat", "combo", "dichvu", "dich_vu"] } },
      ],
    };
  }
  return null;
}
