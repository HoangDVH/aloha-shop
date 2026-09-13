/**
 * Tìm SP kiểu công ty / KiotViet:
 * 1) Mã khớp đúng → 2) Mã bắt đầu → 3) Mã chứa → 4) Tên (token)
 * Luôn bổ sung Mongo khi chưa khớp đúng mã — kho máy thường chỉ vài chục SP lúc mở app.
 */
import { normalizeString } from './helpers';
import { shouldHideTempProductInCatalog } from './tempProductCode';
import { getAlohaProduct, listAlohaProducts, listAlohaProductsByCodes } from '../services/alohaApi';
import { db, type Product } from '../services/database';
import { fetchKiotVietProductByCode, getKiotVietToken } from '../services/kiotviet';
import { resolveProductTon } from './productTon';

export type RankedProduct = Product & { _searchScore?: number };

/** Số viết chữ → chữ số (hai ly ≈ 2 ly). */
const VI_NUM: Record<string, string> = {
  khong: '0',
  mot: '1',
  hai: '2',
  ba: '3',
  bon: '4',
  nam: '5',
  sau: '6',
  bay: '7',
  tam: '8',
  chin: '9',
};

const STOP_WORDS = new Set(['va', 'cua', 'cho', 'voi', 'cac', 'mot', 'nhung', 'dung', 'loai']);

/**
 * Giống mã SP thật (T11T, BKT2.4KG, TNM2L, BX1L…):
 * — có cả chữ lẫn số, hoặc có dấu mã (._-/)
 * — KHÔNG coi «nuocmia» / chữ thuần là mã khi xếp hạng tên.
 */
function looksLikeProductCode(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s || /\s/.test(s)) return false;
  if (!/^[A-Za-z0-9._\-/%]+$/.test(s)) return false;
  if (s.length < 2 || s.length > 24) return false;
  const hasLetter = /[A-Za-z]/.test(s);
  const hasDigit = /[0-9]/.test(s);
  const hasSep = /[._\-/%]/.test(s);
  if (hasLetter && hasDigit) return true;
  if (hasSep && (hasLetter || hasDigit)) return true;
  if (/^\d{3,}$/.test(s)) return true;
  return false;
}

/** Token một khối kiểu mã SP (BX1L, TNM2L…) — không coi «bach»/chữ thuần là mã. */
function looksLikeBareSkuToken(raw: string): boolean {
  return looksLikeProductCode(raw);
}

export { looksLikeProductCode };

/** Token tìm tên (bỏ dấu, tách số+chữ). */
export function searchNameTokens(query: string): string[] {
  return nameTokens(normalizeString(query));
}

/**
 * Khớp chuỗi kiểu công ty: mọi từ khóa đều có trong text (không cần liền nhau).
 * «bach tuyet» khớp «CÂY BẠCH TUYẾT MAI».
 */
export function textMatchesQuery(text: string, query: string): boolean {
  const raw = String(query || '').trim();
  if (!raw) return true;
  const hay = normalizeString(text);
  if (!hay) return false;
  const normQ = normalizeString(raw);
  const tokens = nameTokens(normQ);
  if (!tokens.length) return hay.includes(normQ);
  if (tokens.length === 1) {
    const t = tokens[0]!;
    return hay.includes(t) || hay.replace(/\s+/g, '').includes(t);
  }
  return tokens.every((t) => hay.includes(t) || hay.replace(/\s+/g, '').includes(t));
}

/** Khớp SP theo mã/tên/barcode — cùng logic xếp hạng ô tìm công ty. */
export function matchesProductQuery(
  p: { ma?: string; ten?: string; barcode?: string; name?: string } | null | undefined,
  query: string
): boolean {
  if (!p) return false;
  const raw = String(query || '').trim();
  if (!raw) return true;
  return (
    rankProductSearch(
      [
        {
          ma: p.ma || '',
          ten: p.ten || p.name || '',
          barcode: p.barcode || '',
        } as Product,
      ],
      raw,
      1
    ).length > 0
  );
}

function normalizeCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[_/\-]+/g, '');
}

/** Tách «2ly» → 2 + ly; map số chữ → số; bỏ từ thừa. */
function nameTokens(normQ: string): string[] {
  const out: string[] = [];
  for (const raw of normQ.split(/\s+/).filter(Boolean)) {
    const t0 = VI_NUM[raw] || raw;
    const glued = t0.match(/^(\d+)([a-z]+)$/i) || t0.match(/^([a-z]+)(\d+)$/i);
    const parts = glued ? [glued[1]!.toLowerCase(), glued[2]!.toLowerCase()] : [t0];
    for (const t of parts) {
      if (!t || STOP_WORDS.has(t)) continue;
      if (t.length < 1) continue;
      out.push(t);
    }
  }
  return out;
}

function scoreProduct(
  p: Product,
  rawQ: string,
  normQ: string,
  tokens: string[],
  codeQuery: boolean
): number {
  const ma = String(p.ma || '').trim();
  const maU = ma.toUpperCase();
  const maN = normalizeString(ma);
  const maCode = normalizeCode(ma);
  const tenN = normalizeString(p.ten || '');
  const tenCompact = tenN.replace(/\s+/g, '');
  const qU = rawQ.trim().toUpperCase();
  const qCode = normalizeCode(rawQ);
  const normCompact = normQ.replace(/\s+/g, '');

  if (!normQ && !qU) return 0;

  if (maU === qU || maN === normQ || (qCode && maCode === qCode)) return 10_000;
  if (normCompact && maN.replace(/\s+/g, '') === normCompact) return 10_000;

  if (
    (qU && maU.startsWith(qU)) ||
    (normQ && maN.startsWith(normQ)) ||
    (qCode && maCode.startsWith(qCode)) ||
    (normCompact.length >= 2 && maN.replace(/\s+/g, '').startsWith(normCompact))
  ) {
    return 8_000 - Math.min(ma.length, 200);
  }

  if (
    (qU && maU.includes(qU)) ||
    (normQ && maN.includes(normQ)) ||
    (qCode.length >= 3 && maCode.includes(qCode)) ||
    (normCompact.length >= 3 && maN.replace(/\s+/g, '').includes(normCompact))
  ) {
    return 5_000 - Math.min(ma.length, 200);
  }

  if (codeQuery) return 0;

  if (tokens.length > 0) {
    const hit = tokens.filter((t) => tenN.includes(t) || tenCompact.includes(t));
    if (hit.length === tokens.length) {
      const starts = tenN.startsWith(tokens[0]) || tenCompact.startsWith(tokens[0]) ? 500 : 0;
      return 2_000 + starts + hit.length * 50 - Math.min(tenN.length, 500);
    }
    if (tokens.length >= 2 && hit.length >= Math.ceil(tokens.length * 0.6)) {
      return 1_200 + hit.length * 80 - Math.min(tenN.length, 500);
    }
  }

  if (normQ && tenN.includes(normQ)) return 1_500 - Math.min(tenN.length, 500);
  if (normCompact.length >= 3 && tenCompact.includes(normCompact)) {
    return 1_400 - Math.min(tenCompact.length, 500);
  }

  return 0;
}

/** Xếp hạng + lọc danh sách local (đồng bộ, nhanh — không clone từng SP). */
export function rankProductSearch(
  products: Product[] | null | undefined,
  query: string,
  limit = 40
): Product[] {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const normQ = normalizeString(raw);
  const tokens = nameTokens(normQ);
  if (!normQ && !raw) return [];
  const codeQuery = looksLikeProductCode(raw);

  const scored: { p: Product; s: number }[] = [];
  for (const p of products || []) {
    if (!p?.ma && !p?.ten) continue;
    if (shouldHideTempProductInCatalog(p.ma, raw)) continue;
    const s = scoreProduct(p, raw, normQ, tokens, codeQuery);
    if (s <= 0) continue;
    scored.push({ p, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.p);
}

function mergeByMa(lists: Product[][]): Product[] {
  const map = new Map<string, Product>();
  for (const list of lists) {
    for (const p of list || []) {
      const k = String(p.ma || '').trim().toUpperCase();
      if (!k) continue;
      map.set(k, { ...(map.get(k) || {}), ...p });
    }
  }
  return Array.from(map.values());
}

function hasExactCodeMatch(hits: Product[], typed: string): boolean {
  const qU = typed.trim().toUpperCase();
  const qCode = normalizeCode(typed);
  return hits.some((p) => {
    const maU = String(p.ma || '').trim().toUpperCase();
    if (!maU) return false;
    return maU === qU || normalizeCode(maU) === qCode;
  });
}

/** Cache ngắn getProducts — tránh scan lại kho máy mỗi phím gõ. */
let productsPoolCache: { at: number; list: Product[] } | null = null;
const PRODUCTS_POOL_TTL_MS = 2500;

function getCachedDbProducts(): Product[] {
  const now = Date.now();
  if (productsPoolCache && now - productsPoolCache.at < PRODUCTS_POOL_TTL_MS) {
    return productsPoolCache.list;
  }
  let fromDb: Product[] = [];
  try {
    fromDb = db.getProducts() || [];
  } catch {
    fromDb = [];
  }
  productsPoolCache = { at: now, list: fromDb };
  return fromDb;
}

function buildLocalPool(localProducts: Product[]): Product[] {
  const local = localProducts || [];
  const fromDb = getCachedDbProducts();
  if (!fromDb.length) return local;
  if (!local.length) return fromDb;
  // Tab có vài trăm SP (đơn / hydrate) vẫn có thể thiếu mã — luôn gộp kho máy
  if (local.length >= 1500 && fromDb.length <= local.length + 50) return local;
  return mergeByMa([local, fromDb]);
}

function toProduct(p: any): Product | null {
  const ma = String(p?.ma || p?.code || '').trim();
  if (!ma) return null;
  const images = Array.isArray(p?.images)
    ? p.images.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];
  const anh = String(p?.anh || images[0] || '') || '';
  return {
    ma,
    ten: String(p?.ten || p?.name || ma),
    dvt: String(p?.dvt || p?.unit || 'Cái'),
    nhom: String(p?.nhom || p?.categoryName || ''),
    nhomPath: p?.nhomPath,
    ton: resolveProductTon(p),
    giaVon: Number(p?.giaVon ?? p?.cost ?? 0) || 0,
    giaNhap: Number(p?.giaNhap ?? p?.giaVon ?? p?.cost ?? 0) || 0,
    giaBan: Number(p?.giaBan ?? p?.basePrice ?? p?.giaChung ?? 0) || 0,
    giaSi: Number(p?.giaSi ?? 0) || 0,
    giaChung: Number(p?.giaChung ?? p?.giaBan ?? 0) || 0,
    giaWeb: Number(p?.giaWeb ?? 0) || 0,
    anh,
    images: images.length ? images : anh ? [anh] : undefined,
    barcode: String(p?.barcode || p?.barCode || ''),
  } as Product;
}

/** Tra đúng 1 mã: /products/:ma → codes → KiotViet */
async function lookupExactCode(typed: string): Promise<Product[]> {
  const ma = typed.trim().toUpperCase();
  if (!ma) return [];

  try {
    const one = await getAlohaProduct(ma);
    if (one.ok && one.data) {
      const p = toProduct(one.data);
      if (p) return [p];
    }
  } catch {
    /* tiếp */
  }

  try {
    const byCodes = await listAlohaProductsByCodes([ma], { lite: true });
    if (byCodes.ok && byCodes.data?.length) {
      return byCodes.data.map(toProduct).filter(Boolean) as Product[];
    }
  } catch {
    /* tiếp */
  }

  try {
    const cfg = db.getKiotVietConfig?.();
    if (cfg?.clientId && cfg?.clientSecret && cfg?.retailer) {
      const token = await getKiotVietToken(cfg.clientId, cfg.clientSecret);
      const kv = await fetchKiotVietProductByCode(token, cfg.retailer, ma);
      if (kv?.ma) {
        return [
          {
            ma: kv.ma,
            ten: kv.ten,
            dvt: kv.dvt || 'Cái',
            nhom: '',
            ton: kv.ton || 0,
            giaVon: kv.giaVon || 0,
            giaNhap: kv.giaVon || 0,
            giaBan: kv.giaBan || 0,
          } as Product,
        ];
      }
    }
  } catch (e) {
    console.warn('[productSearch] KV theo mã:', e);
  }

  return [];
}

export type ProductSearchRemoteOptions = {
  localProducts: Product[];
  query: string;
  limit?: number;
  /** Chỉ xếp hạng máy, không gọi Mongo (dùng khi đang gõ từng phím). */
  localOnly?: boolean;
  /** @deprecated */
  localEnough?: number;
  onResults: (hits: Product[]) => void;
  isCurrent?: (typed: string) => boolean;
  mergeIntoProducts?: (hits: Product[]) => void;
};

/** Debounce hỏi kho — kiểu sàn TMĐT: gõ thấy ngay, dừng gõ mới gọi server. */
export const PRODUCT_SEARCH_REMOTE_DEBOUNCE_MS = 320;

/**
 * Local ngay → (trừ localOnly) hỏi Mongo / đúng mã / KV nếu chưa khớp.
 * Dùng: onLiveChange → localOnly:true · onCommit → localOnly:false.
 */
export function searchProductsCompanyStyle(opts: ProductSearchRemoteOptions): () => void {
  const limit = opts.limit ?? 40;
  const typed = String(opts.query || '').trim();
  let cancelled = false;

  if (!typed) {
    opts.onResults([]);
    return () => {
      cancelled = true;
    };
  }

  const localPool = buildLocalPool(opts.localProducts);
  const localHits = rankProductSearch(localPool, typed, limit);
  if (!cancelled) opts.onResults(localHits);

  const codeQuery = looksLikeProductCode(typed);
  const exactLocal = hasExactCodeMatch(localHits, typed);
  const bareSku = looksLikeBareSkuToken(typed);
  /** Tên SP / nhiều từ → cần hỏi Mongo (kho máy thường thiếu). */
  const nameQuery = !codeQuery && !bareSku && typed.length >= 2;

  const fetchRemoteList = async (q: string) => {
    const r = await listAlohaProducts({
      q,
      limit: Math.max(limit, 40),
      page: 1,
      lite: true,
    });
    return r.ok && Array.isArray(r.data) ? (r.data as Product[]) : [];
  };

  const finishMerge = (remote: Product[]) => {
    if (cancelled) return;
    if (opts.isCurrent && !opts.isCurrent(typed)) return;
    let merged = rankProductSearch(mergeByMa([localHits, remote]), typed, limit);
    if (!merged.length && remote.length) {
      merged = remote
        .filter((p) => !shouldHideTempProductInCatalog(p?.ma, typed))
        .slice(0, limit);
    }
    if (cancelled) return;
    if (opts.isCurrent && !opts.isCurrent(typed)) return;
    opts.onResults(merged);
    if (merged.length) {
      try {
        db.seedCatalogFromServer(merged);
      } catch {
        /* ignore */
      }
      opts.mergeIntoProducts?.(merged);
    }
  };

  // Đang gõ: máy trước; thiếu thì hỏi kho (mã đúng + tìm theo tên)
  if (opts.localOnly) {
    if (exactLocal) {
      return () => {
        cancelled = true;
      };
    }
    if (!(codeQuery || bareSku || nameQuery)) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (cancelled) return;
          if (opts.isCurrent && !opts.isCurrent(typed)) return;
          let remote: Product[] = [];
          if (codeQuery || bareSku) {
            const exact = await lookupExactCode(typed);
            if (exact.length) remote = exact;
          }
          // Tên / chữ thuần («bach tuyet mai») → list?q= trên Mongo
          if (nameQuery || (!remote.length && !codeQuery)) {
            const list = await fetchRemoteList(typed);
            if (list.length) remote = mergeByMa([remote, list]);
          }
          if (!remote.length) return;
          finishMerge(remote);
        } catch (e) {
          console.warn('[productSearch] tra kho (live):', e);
        }
      })();
    }, Math.min(PRODUCT_SEARCH_REMOTE_DEBOUNCE_MS, nameQuery ? 220 : 160));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }

  // Đã khớp đúng mã trên máy → không gọi mạng
  if (exactLocal) {
    return () => {
      cancelled = true;
    };
  }

  const normQ = normalizeString(typed);
  const toks = nameTokens(normQ);

  const timer = window.setTimeout(() => {
    void (async () => {
      try {
        if (cancelled) return;
        if (opts.isCurrent && !opts.isCurrent(typed)) return;

        // 1 lần hỏi kho chính (trước đây gọi nhiều biến thể → lag)
        let remote = await fetchRemoteList(typed);
        if (cancelled) return;
        if (opts.isCurrent && !opts.isCurrent(typed)) return;

        // Mã kiểu BX1L / TNM2L: thêm 1 lần tra đúng mã nếu list?q chưa ra
        if (
          (codeQuery || (!remote.length && !/\s/.test(typed) && typed.length >= 2 && bareSku)) &&
          !hasExactCodeMatch(remote, typed)
        ) {
          const exact = await lookupExactCode(typed);
          if (exact.length) remote = mergeByMa([remote, exact]);
        }

        // Chỉ thêm 1 biến thể tên khi kết quả còn mỏng
        if (!codeQuery && remote.length < 5 && normQ.length >= 3) {
          const sig = toks.filter((t) => t.length >= 2 || /^\d+$/.test(t));
          const alt =
            (sig.length >= 2 ? sig.slice(0, 3).join(' ') : '') ||
            (normQ.replace(/\s+/g, '').length >= 4 ? normQ.replace(/\s+/g, '') : '');
          if (alt && alt.toLowerCase() !== typed.toLowerCase()) {
            if (cancelled) return;
            if (opts.isCurrent && !opts.isCurrent(typed)) return;
            const more = await fetchRemoteList(alt);
            if (more.length) remote = mergeByMa([remote, more]);
          }
        }

        finishMerge(remote);
      } catch (e) {
        console.warn('[productSearch] Mongo:', e);
      }
    })();
  }, PRODUCT_SEARCH_REMOTE_DEBOUNCE_MS);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

/** Lọc mã tạm SPM/NEW — dùng cho ô tìm không đi qua rankProductSearch. */
export function filterProductsForUserSearch<T extends { ma?: string }>(
  products: T[] | null | undefined,
  query: string
): T[] {
  const raw = String(query || "").trim();
  if (!raw) return products || [];
  return (products || []).filter((p) => !shouldHideTempProductInCatalog(p?.ma, raw));
}
