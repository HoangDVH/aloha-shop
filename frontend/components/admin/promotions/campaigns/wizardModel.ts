import type {
  CampaignContentAdmin,
  CampaignProductAdmin,
  CheckIssue,
  FieldError,
  ProductFacts,
} from "@/lib/campaign/campaignAdminApi";

export const STEPS = [
  { key: "when", title: "Chạy khi nào?" },
  { key: "products", title: "Giảm giá sản phẩm nào?" },
  { key: "vouchers", title: "Tặng gì cho khách?" },
  { key: "display", title: "Hiện trên web thế nào?" },
  { key: "review", title: "Kiểm tra & bật" },
] as const;

/** Lỗi server trả theo đường dẫn field → bước chứa ô đó (để nút "Sửa" nhảy tới). */
export function stepOfPath(path: string): number {
  if (path.startsWith("info")) return 0;
  if (path.startsWith("products") || path.startsWith("slots")) return 1;
  if (path.startsWith("voucherIds")) return 2;
  if (path.startsWith("display")) return 3;
  return 4;
}

export const vnd = (n: number) => `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;

export function percentOff(list: number, sale: number): number {
  if (!(list > 0) || !(sale > 0)) return 0;
  return Math.round((1 - sale / list) * 100);
}

export function saleFromPercent(list: number, pct: number): number {
  const p = Math.min(99, Math.max(0, pct));
  return Math.round((list * (100 - p)) / 100 / 1000) * 1000;
}

/** Ô giá: thấp hơn giá web = giá sale; cao hơn giá web = giá trước KM (chỉ gạch ngang, khách trả giá web). */
export function withPriceInput(row: CampaignProductAdmin, value: number, list: number): CampaignProductAdmin {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (list > 0 && n > list) return { ...row, salePrice: 0, compareAtPrice: n };
  return { ...row, salePrice: n, compareAtPrice: undefined };
}

export function newProductRow(ma: string, listPrice: number): CampaignProductAdmin {
  return { ma, salePrice: saleFromPercent(listPrice, 20), quota: 10, perCustomerLimit: 2 };
}

/** Lỗi nhập ngay trên dòng (AD04) — server vẫn kiểm tra lại khi lưu / bật. */
export function rowError(p: CampaignProductAdmin, f?: ProductFacts): string | null {
  if (!f) return null;
  if (p.compareAtPrice && p.compareAtPrice <= f.listPrice) {
    return `Giá trước KM phải cao hơn giá web ${vnd(f.listPrice)}`;
  }
  if (p.salePrice > 0 && p.salePrice >= f.listPrice) return `Giá sale phải thấp hơn giá thường ${vnd(f.listPrice)}`;
  if (p.salePrice > 0 && p.quota < 1) return "Nhập số lượng bán giá sale";
  return null;
}

export function fieldErrorsFor(errors: (FieldError | CheckIssue)[], prefix: string): string[] {
  return errors.filter((e) => e.path === prefix || e.path.startsWith(`${prefix}.`)).map((e) => e.message);
}

const BACKUP_PREFIX = "aloha:campaign-draft:";

/** Giữ bản đang sửa trên máy khi phiên đăng nhập hết hạn / mất mạng (AD17). */
export function saveLocalBackup(id: string, content: CampaignContentAdmin, revision: number): void {
  try {
    localStorage.setItem(BACKUP_PREFIX + id, JSON.stringify({ content, revision, at: Date.now() }));
  } catch {
    /* hết dung lượng: bỏ qua */
  }
}

export function readLocalBackup(id: string): { content: CampaignContentAdmin; revision: number; at: number } | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalBackup(id: string): void {
  try {
    localStorage.removeItem(BACKUP_PREFIX + id);
  } catch {
    /* ignore */
  }
}

/** "Mã, giá sale, số lượng" mỗi dòng; trả dòng hợp lệ và danh sách dòng lỗi (AD15). */
export function parsePastedRows(text: string): { rows: { ma: string; salePrice: number; quota: number }[]; errors: string[] } {
  const rows: { ma: string; salePrice: number; quota: number }[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const [ma, price, qty] = line.split(/[\t,;]/).map((s) => s.trim());
    const salePrice = Number(String(price || "").replace(/[^\d]/g, ""));
    const quota = Number(String(qty || "").replace(/[^\d]/g, ""));
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(ma || "")) errors.push(`Dòng ${i + 1}: mã "${ma || ""}" không hợp lệ`);
    else if (!(salePrice > 0)) errors.push(`Dòng ${i + 1}: thiếu giá sale`);
    else if (!(quota > 0)) errors.push(`Dòng ${i + 1}: thiếu số lượng`);
    else rows.push({ ma: ma.toUpperCase(), salePrice, quota });
  });
  return { rows, errors };
}
