/** Gộp giá bán: máy đang làm việc thắng số remote cũ; máy khác nhận patch thì số server thắng. */

export type SellPriceFields = {
  ma?: string;
  giaSi?: number;
  giaChung?: number;
  giaWeb?: number;
  giaBan?: number;
  giaVon?: number;
  giaNhap?: number;
  anh?: string;
  images?: string[];
};

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/** Ưu tiên số local > 0 (đã Lưu trên máy này) — remote chỉ lấp chỗ trống. */
export function pickLocalPrice(local: unknown, remote: unknown): number {
  const l = n(local);
  if (l > 0) return l;
  return n(remote);
}

export function mergeProductKeepLocalPrices<T extends SellPriceFields>(
  local: T | undefined,
  remote: T
): T {
  if (!local) return remote;
  const giaChung = pickLocalPrice(local.giaChung || local.giaBan, remote.giaChung || remote.giaBan);
  const giaVon = pickLocalPrice(local.giaVon || local.giaNhap, remote.giaVon || remote.giaNhap);
  return {
    ...remote,
    ...local,
    anh: local.anh || remote.anh,
    images:
      Array.isArray(local.images) && local.images.length > 0 ? local.images : remote.images,
    giaSi: pickLocalPrice(local.giaSi, remote.giaSi),
    giaChung,
    giaWeb: pickLocalPrice(local.giaWeb, remote.giaWeb),
    giaBan: giaChung || n(local.giaBan) || n(remote.giaBan),
    giaVon,
    giaNhap: giaVon || n(local.giaNhap) || n(remote.giaNhap),
  };
}

/** Máy khác vừa Lưu — áp giá server lên catalog local. */
export function applyServerSellPrices<T extends SellPriceFields>(existing: T, patch: T): T {
  const giaChung = n(patch.giaChung || patch.giaBan) || n(existing.giaChung || existing.giaBan);
  const giaVon = n(patch.giaVon || patch.giaNhap) || n(existing.giaVon || existing.giaNhap);
  return {
    ...existing,
    ...patch,
    anh: existing.anh || patch.anh,
    images:
      Array.isArray(existing.images) && existing.images.length > 0
        ? existing.images
        : patch.images,
    giaSi: n(patch.giaSi) || n(existing.giaSi),
    giaChung,
    giaWeb: n(patch.giaWeb) || n(existing.giaWeb),
    giaBan: giaChung,
    giaVon,
    giaNhap: giaVon,
  };
}

let cachedSwMap: Record<string, any> | null = null;
let cachedSwMapRaw: string | null = null;

function getCachedSwMap(): Record<string, any> {
  try {
    const raw = localStorage.getItem('aloha_gia_sw_kv') || '{}';
    if (raw === cachedSwMapRaw && cachedSwMap) {
      return cachedSwMap;
    }
    cachedSwMapRaw = raw;
    const parsed = JSON.parse(raw);
    const normalized: Record<string, any> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        const key = String(k || '').trim();
        if (key) {
          normalized[key] = v;
          normalized[key.toUpperCase()] = v;
        }
      }
    }
    cachedSwMap = normalized;
    return normalized;
  } catch {
    return {};
  }
}

/**
 * Giá đã Lưu/Đồng bộ (overrides + map sỉ/web) thắng số catalog cũ —
 * tránh search vẫn ra giá trước khi bấm Lưu/Đồng bộ.
 *
 * Ngoại lệ: override chỉ còn `giaBan` lệch (thiếu sỉ/chung/web) sau khi đã sync KV
 * vào catalog → giữ giá catalog (đúng với KiotViet), không để giaBan cũ đè.
 */
export function applyCommittedSellPricesOverlay<T extends SellPriceFields>(p: T): T {
  const ma = String(p?.ma || '').trim();
  if (!ma) return p;
  const maU = ma.toUpperCase();
  try {
    const sw = getCachedSwMap();
    const swRow = sw[ma] || sw[maU];
    if (!swRow) return p;

    const catChung = n(p.giaChung) || n(p.giaBan);
    const catSi = n(p.giaSi);
    const catWeb = n(p.giaWeb);
    const swSi = n(swRow?.giaSi);
    const swWeb = n(swRow?.giaWeb);
    const swChung = n(swRow?.giaChung);

    const giaSi = swSi || catSi || n(p.giaSi);
    const giaChung = swChung || catChung;
    const giaWeb = swWeb || catWeb || n(p.giaWeb);
    const giaVon = n(p.giaVon) || n(p.giaNhap);
    return {
      ...p,
      giaSi,
      giaChung,
      giaWeb,
      giaBan: giaChung || n(p.giaBan),
      giaVon,
      giaNhap: giaVon || n(p.giaNhap),
    };
  } catch {
    return p;
  }
}


