export function uid(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Mã duy nhất: ghép thời gian + ngẫu nhiên -> gần như không thể trùng (tránh đè bản ghi).
export function genId(prefix: string = ''): string {
  const s = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${s}` : s;
}

// Lấy TÊN người đang đăng nhập một cách an toàn.
// Trước đây nhiều nơi lấy thẳng localStorage 'aloha_current_user' (là cả cục JSON) làm tên -> sai.
export function getCurrentUserName(fallback: string = ''): string {
  try {
    const raw = localStorage.getItem('aloha_current_user');
    if (!raw) return fallback;
    // Có thể là JSON object, cũng có thể là chuỗi tên thuần (dữ liệu cũ).
    if (raw.trim().startsWith('{')) {
      const u = JSON.parse(raw);
      return (u && (u.fullName || u.username)) || fallback;
    }
    return raw || fallback;
  } catch {
    return fallback;
  }
}

export function parseMoney(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^\d]/g, '');
  return parseInt(clean, 10) || 0;
}

/** Luôn hiện 450.000 (dấu chấm VN) — không phụ thuộc locale trình duyệt / Excel. */
export function formatVndDot(num: number | string | null | undefined): string {
  const n = Math.round(Number(num) || 0);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatVND(num: number | string | null | undefined): string {
  return formatVndDot(num) + ' đ';
}

export function fmtMoney(num: number): string {
  return formatVndDot(num) + 'đ';
}

export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mã tạm tạo khi Khai báo SP mới — hạ ưu tiên khi gợi ý map kho. */
export function isTempProductCode(ma: string | undefined | null): boolean {
  const c = String(ma || '').trim().toUpperCase();
  return c.startsWith('SPM-') || c.startsWith('NEW-');
}

/**
 * Điểm khớp tên (càng cao càng gần). Dùng gợi ý SP kho khi nhập chứng từ.
 * 0 = không đủ gần để gợi ý.
 */
export function scoreProductNameMatch(query: string, candidateName: string): number {
  const q = normalizeString(query);
  const t = normalizeString(candidateName);
  if (!q || !t) return 0;
  if (q === t) return 1000;
  if (t.includes(q) || q.includes(t)) {
    const longer = Math.max(q.length, t.length);
    const shorter = Math.min(q.length, t.length);
    return 700 + Math.round((shorter / longer) * 200);
  }
  const qTok = q.split(' ').filter((x) => x.length >= 2);
  const tTok = new Set(t.split(' ').filter((x) => x.length >= 2));
  if (!qTok.length || !tTok.size) return 0;
  let hit = 0;
  for (const tok of qTok) {
    if (tTok.has(tok)) hit += 1;
    else if ([...tTok].some((x) => x.includes(tok) || tok.includes(x))) hit += 0.5;
  }
  const ratio = hit / qTok.length;
  if (ratio < 0.4) return 0;
  return Math.round(200 + ratio * 400 + Math.min(t.length, 40));
}

/** Top SP kho gần đúng tên query — ưu tiên mã thật, hạ SPM-/NEW-. */
export function suggestProductsByName<T extends { ma?: string; ten?: string }>(
  query: string,
  products: T[],
  limit = 5
): T[] {
  const q = String(query || '').trim();
  if (!q || !Array.isArray(products) || products.length === 0) return [];
  const scored = products
    .map((p) => {
      let score = scoreProductNameMatch(q, String(p.ten || ''));
      if (score <= 0) return null;
      if (isTempProductCode(p.ma)) score = Math.max(1, Math.floor(score * 0.35));
      return { p, score };
    })
    .filter((x): x is { p: T; score: number } => !!x && x.score > 0)
    .sort((a, b) => b.score - a.score || String(b.p.ten || '').length - String(a.p.ten || '').length);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const { p } of scored) {
    const ma = String(p.ma || '').trim().toUpperCase();
    if (!ma || seen.has(ma)) continue;
    seen.add(ma);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export function getComboParts(combo: any, products: any[]): Array<{ j: string; n: number; m: number; l: number; k: string; name: string }> {
  if (!combo || !combo.maTp) return [];
  return combo.maTp.split('|').map((part: string) => {
    const trimmed = part.trim();
    const maSub = trimmed.split(/[\s(×]/)[0].trim();
    const slM = trimmed.match(/×\s*(\d+)/);
    const qty = slM ? parseInt(slM[1]) : 1;
    const p = products.find(x => x.ma === maSub);
    return {
      j: maSub,
      n: qty,
      m: qty,
      l: p ? p.giaNhap : 0,
      k: p ? p.ten : maSub,
      name: p ? p.ten : maSub
    };
  }).filter(Boolean);
}

export const DEFAULT_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><rect width="24" height="24" fill="%23f1f8e9" rx="4"/><path d="M17,8C8,10 5.9,16.17 5.18,18C6.96,17.8 12.8,16 16.74,10.19C17.74,8.71 17.5,8.19 17,8Z" fill="%2381c784"/><path d="M16,2C8,4 6,10 5,12C7,11.8 12,10 15,6C16,4.7 16.2,4.1 16,2Z" fill="%234caf50"/><path d="M12,14C7.5,15 6.5,18.5 6,20C7,19.8 10,18.5 11.5,16.5C12.5,15.2 12.6,14.6 12,14Z" fill="%232e7d32"/></svg>';
