/**
 * Ngày tạo SP theo KiotViet (createdDate / taoLuc).
 * Không dùng createdAt (ngày import Mongo) để xếp danh sách — dễ ra thứ tự A–Z / ngày đồng bộ.
 */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Chuẩn hóa chuỗi ngày KV (.NET 7 số lẻ, thiếu Z) → Date hợp lệ. */
export function parseKvDate(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? raw : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  let s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(" ", "T");
  s = s.replace(/(\.\d{3})\d+/, "$1");
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = `${s}Z`;
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

/** YYYY-MM-DD từ field thô (ưu tiên 10 ký tự đầu chuỗi KV). */
function ymdFromRaw(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = parseKvDate(raw);
  if (!d) return "";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Ngày KV: 7 số lẻ, hoặc ISO khi đã có ID KV. Không có ID + đuôi Z = giờ import Mongo. */
function isUsableCreatedDate(raw: unknown, kvId: number): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  if (!parseKvDate(s)) return false;
  if (/\.\d{7}/.test(s)) return true;
  if (/Z$/i.test(s) && kvId <= 0) return false;
  return true;
}

/** Ngày tạo KV — không dùng createdAt (ngày import Mongo). */
function pickProductCreatedRaw(p: any): unknown {
  if (!p) return null;
  const kv = productKvId(p);
  for (const key of ["createdDate", "CreatedDate", "taoLuc"]) {
    const raw = p[key];
    if (raw == null || raw === "") continue;
    if (isUsableCreatedDate(raw, kv)) return raw;
  }
  return null;
}

/** Mốc tạo SP (ms) theo ngày KV. */
export function productCreatedMs(p: any): number | null {
  const raw = pickProductCreatedRaw(p);
  if (!raw) return null;
  return parseKvDate(raw)?.getTime() ?? null;
}

export function productKvId(p: any): number {
  const n = Number(p?.kvId ?? p?.kiotVietId ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Mới nhất trước: ngày tạo KV → mã KV (ID tăng = SP mới) → mã SP.
 */
export function sortByNewest<T extends Record<string, any>>(list: T[]): T[] {
  return [...(list || [])].sort((a, b) => {
    const mb = productCreatedMs(b) ?? 0;
    const ma = productCreatedMs(a) ?? 0;
    const hb = mb > 0 ? 1 : 0;
    const ha = ma > 0 ? 1 : 0;
    if (hb !== ha) return hb - ha;
    if (mb !== ma) return mb - ma;
    const ib = productKvId(b);
    const ia = productKvId(a);
    if (ib !== ia) return ib - ia;
    return 0;
  });
}

/**
 * YYYY-MM-DD ngày tạo SP (lịch trên chuỗi KV).
 */
export function productCreatedYmd(p: any): string {
  const raw = pickProductCreatedRaw(p);
  if (!raw) return "";
  const ymd = ymdFromRaw(raw);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : "";
}

/** Hiển thị cột Thời gian tạo. */
export function formatProductCreated(p: any): string {
  const ymd = productCreatedYmd(p);
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  const ms = productCreatedMs(p);
  if (ms == null) return `${d}/${m}/${y}`;
  const dt = new Date(ms);
  return `${d}/${m}/${y} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}`;
}

/** YYYY-MM-DD từ ISO / YMD / Date (bound lọc). */
export function toYmdBound(raw: string | undefined | null): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = parseKvDate(s);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
