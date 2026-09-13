/**
 * Đọc file Excel/CSV xuất từ KiotViet (tab Sản xuất) → phiếu ALOHA.
 * Khớp cột linh hoạt theo tên tiếng Việt.
 */
import { normalizeString } from "./helpers";
import type { AlohaProductionMaterial, CreateProductionBody } from "../types/production";

async function loadXlsx() {
  return import("xlsx");
}

export function isProductionImportFile(file: File) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    type.includes("sheet") ||
    type.includes("excel") ||
    type.includes("csv")
  );
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toLocaleString("vi-VN");
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date
    if (v > 20000 && v < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + v * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return String(v);
  }
  return String(v).trim();
}

function parseQty(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellStr(v).replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Chuỗi ngày KV kiểu 20/08/2026 11:39 → ISO */
export function parseKvDateTime(raw: unknown): string | undefined {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString();
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + raw * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const s = cellStr(raw);
  if (!s) return undefined;
  const m = s.match(
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const mo = Number(m[2]) - 1;
    const day = Number(m[1]);
    const hh = Number(m[4] || 0);
    const mm = Number(m[5] || 0);
    const ss = Number(m[6] || 0);
    const d = new Date(y, mo, day, hh, mm, ss);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  return undefined;
}

export function mapProductionStatus(raw: unknown): number {
  const n = normalizeString(cellStr(raw));
  if (!n) return 3;
  if (n.includes("huy") || n.includes("cancel")) return 4;
  if (n.includes("tam") || n.includes("draft") || n.includes("phieu tam")) return 1;
  if (n.includes("hoan thanh") || n.includes("complete") || n.includes("done")) return 3;
  if (n === "1") return 1;
  if (n === "3") return 3;
  if (n === "4") return 4;
  return 3;
}

type ColMap = Record<string, number>;

function findHeaderRow(rows: unknown[][]): { headerIdx: number; col: ColMap } {
  const want = [
    "ma san xuat",
    "ma hang",
    "ten hang",
    "so luong",
    "trang thai",
    "thoi gian",
  ];
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const row = rows[i] || [];
    const col: ColMap = {};
    for (let c = 0; c < row.length; c++) {
      const key = normalizeString(cellStr(row[c]));
      if (!key) continue;
      if (key.includes("ma san xuat") || key === "ma sx" || key === "code") col.code = c;
      else if (
        (key.includes("ma hang") || key === "ma thanh pham" || key === "sku") &&
        !key.includes("thanh phan")
      )
        col.productCode = c;
      else if (
        (key.includes("ten hang") || key.includes("ten thanh pham")) &&
        !key.includes("thanh phan")
      )
        col.productName = c;
      else if (key.includes("so luong") && !key.includes("thanh phan") && !key.includes("su dung"))
        col.quantity = c;
      else if (key.includes("trang thai")) col.status = c;
      else if (key.includes("thoi gian") || key.includes("ngay san xuat") || key === "ngay")
        col.producedDate = c;
      else if (key.includes("kho dau vao") || key.includes("kho nguyen lieu"))
        col.fromWarehouseName = c;
      else if (key.includes("kho dau ra") || key.includes("kho thanh pham"))
        col.toWarehouseName = c;
      else if (key.includes("chi nhanh")) col.branchName = c;
      else if (key.includes("nguoi tao")) col.createdByName = c;
      else if (key.includes("ghi chu")) col.note = c;
      else if (key.includes("ma thanh phan") || key.includes("ma hang thanh phan"))
        col.materialCode = c;
      else if (key.includes("ten thanh phan")) col.materialName = c;
      else if (
        key.includes("su dung") ||
        key === "sl thanh phan" ||
        (key.includes("so luong") && key.includes("thanh phan"))
      )
        col.materialQty = c;
    }
    const hits = want.filter((w) => {
      if (w === "ma san xuat") return col.code != null;
      if (w === "ma hang") return col.productCode != null;
      if (w === "ten hang") return col.productName != null;
      if (w === "so luong") return col.quantity != null;
      if (w === "trang thai") return col.status != null;
      if (w === "thoi gian") return col.producedDate != null;
      return false;
    }).length;
    if (col.code != null && hits >= 2) return { headerIdx: i, col };
  }
  return { headerIdx: -1, col: {} };
}

export type ParsedProductionImport = {
  items: CreateProductionBody[];
  skipped: number;
  /** Số dòng dữ liệu (sau header), kể cả dòng trùng mã */
  dataRows?: number;
  warnings: string[];
};

/**
 * Gom dòng Excel theo mã SX. Hỗ trợ:
 * - 1 dòng = 1 phiếu (file list KV)
 * - Nhiều dòng cùng mã + cột thành phần (file chi tiết)
 */
export function parseProductionSheetRows(rows: unknown[][]): ParsedProductionImport {
  const { headerIdx, col } = findHeaderRow(rows);
  const warnings: string[] = [];
  if (headerIdx < 0 || col.code == null) {
    return {
      items: [],
      skipped: 0,
      warnings: [
        "Không tìm thấy cột «Mã sản xuất». Hãy xuất file từ tab Sản xuất KiotViet hoặc dùng mẫu ALOHA.",
      ],
    };
  }
  if (col.productCode == null && col.productName == null) {
    warnings.push("Thiếu cột Mã hàng / Tên hàng — một số dòng có thể bị bỏ.");
  }

  const byCode = new Map<string, CreateProductionBody>();
  let skipped = 0;
  let dataRows = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const code = cellStr(row[col.code!]);
    if (!code) {
      skipped++;
      continue;
    }
    dataRows++;
    const productCode = col.productCode != null ? cellStr(row[col.productCode]) : "";
    const productName = col.productName != null ? cellStr(row[col.productName]) : "";
    const quantity = col.quantity != null ? parseQty(row[col.quantity]) : 0;
    const status = col.status != null ? mapProductionStatus(row[col.status]) : 3;
    const producedDate =
      col.producedDate != null ? parseKvDateTime(row[col.producedDate]) : undefined;

    let item = byCode.get(code);
    if (!item) {
      if (!productCode && !productName) {
        skipped++;
        continue;
      }
      item = {
        code,
        productCode: productCode || code,
        productName: productName || productCode || code,
        quantity: quantity > 0 ? quantity : 1,
        status,
        isDraft: status === 1,
        producedDate,
        fromWarehouseName:
          col.fromWarehouseName != null ? cellStr(row[col.fromWarehouseName]) : undefined,
        toWarehouseName:
          col.toWarehouseName != null ? cellStr(row[col.toWarehouseName]) : undefined,
        branchName: col.branchName != null ? cellStr(row[col.branchName]) : undefined,
        createdByName: col.createdByName != null ? cellStr(row[col.createdByName]) : undefined,
        note: col.note != null ? cellStr(row[col.note]) : undefined,
        materials: [],
      };
      byCode.set(code, item);
    } else {
      if (productCode && !item.productCode) item.productCode = productCode;
      if (productName && !item.productName) item.productName = productName;
      if (quantity > 0) item.quantity = quantity;
      if (producedDate) item.producedDate = producedDate;
    }

    if (col.materialCode != null) {
      const mc = cellStr(row[col.materialCode]);
      if (mc) {
        const mat: AlohaProductionMaterial = {
          productId: 0,
          productCode: mc,
          productName:
            col.materialName != null ? cellStr(row[col.materialName]) || mc : mc,
          quantity: col.materialQty != null ? parseQty(row[col.materialQty]) : 0,
        };
        item.materials = item.materials || [];
        item.materials.push(mat);
      }
    }
  }

  if (dataRows > byCode.size) {
    warnings.push(
      `File chi tiết: ${dataRows} dòng → gom ${byCode.size} phiếu (cùng mã SX có nhiều thành phần).`
    );
  }

  return { items: Array.from(byCode.values()), skipped, dataRows, warnings };
}

export async function parseProductionImportFile(file: File): Promise<ParsedProductionImport> {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const allItems: CreateProductionBody[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let dataRows = 0;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    }) as unknown[][];
    const parsed = parseProductionSheetRows(rows);
    if (parsed.items.length) {
      allItems.push(...parsed.items);
      skipped += parsed.skipped;
      dataRows += parsed.dataRows || 0;
      warnings.push(...parsed.warnings.map((w) => `[${sheetName}] ${w}`));
    } else if (parsed.warnings.length && wb.SheetNames.length === 1) {
      return parsed;
    }
  }

  // Gộp trùng mã giữa các sheet
  const merged = new Map<string, CreateProductionBody>();
  for (const it of allItems) {
    const code = String(it.code || "").trim();
    if (!code) continue;
    const prev = merged.get(code);
    if (!prev) {
      merged.set(code, { ...it, materials: [...(it.materials || [])] });
      continue;
    }
    if ((it.materials || []).length) {
      prev.materials = [...(prev.materials || []), ...(it.materials || [])];
    }
    if (it.productName && it.productName !== code) prev.productName = it.productName;
    if (it.productCode) prev.productCode = it.productCode;
    if (it.quantity) prev.quantity = it.quantity;
  }

  if (!merged.size) {
    return {
      items: [],
      skipped,
      dataRows,
      warnings: warnings.length
        ? warnings
        : ["File không có dòng phiếu hợp lệ (cần cột Mã sản xuất + Mã/Tên hàng)."],
    };
  }

  return { items: Array.from(merged.values()), skipped, dataRows, warnings };
}

/** Tải mẫu Excel khớp cột list KV / ALOHA */
export async function downloadProductionImportTemplate() {
  const XLSX = await loadXlsx();
  const rows = [
    [
      "Mã sản xuất",
      "Thời gian",
      "Mã hàng",
      "Tên hàng",
      "Số lượng",
      "Trạng thái",
      "Chi nhánh",
      "Kho đầu vào",
      "Kho đầu ra",
      "Người tạo",
      "Ghi chú",
      "Mã thành phần",
      "Tên thành phần",
      "Sử dụng",
    ],
    [
      "SX000001",
      "20/08/2026 11:39",
      "CBKNTV",
      "COMBO MẪU",
      3,
      "Hoàn thành",
      "Chi nhánh trung tâm",
      "KHU VỰC BÁN HÀNG",
      "KHU VỰC BÁN HÀNG",
      "kế toán",
      "",
      "DATTRONG",
      "ĐẤT TRỒNG",
      3,
    ],
    [
      "SX000001",
      "20/08/2026 11:39",
      "CBKNTV",
      "COMBO MẪU",
      3,
      "Hoàn thành",
      "Chi nhánh trung tâm",
      "KHU VỰC BÁN HÀNG",
      "KHU VỰC BÁN HÀNG",
      "kế toán",
      "",
      "CHAUNHO",
      "CHẬU NHỎ",
      3,
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SanXuat");
  XLSX.writeFile(wb, `Mau-nhap-phieu-san-xuat-ALOHA.xlsx`);
}
