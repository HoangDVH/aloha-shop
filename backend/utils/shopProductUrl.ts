/**
 * Link SP trên web bán alohathegioichaucay.com (xuất Excel / in bảng giá).
 * Chuẩn shop mới: /c/{danh-muc}/p/{slug}--{ma}
 * ví dụ …/c/binh-tuoi-cay/p/binh-xit-1-5l--bx1500ml
 * (Không dùng slug-hash KiotViet cũ kiểu …-1fe117 — trang sẽ “Không tìm thấy SP”.)
 */
import { normalizeString } from './helpers';

/** App nội bộ ALOHA — store.alohathegioichaucay.com */
export const STORE_ORIGIN = 'https://store.alohathegioichaucay.com';
/** Web bán công khai — in/xuất bảng giá. */
export const SHOP_ORIGIN = 'https://alohathegioichaucay.com';

/** Link app nội bộ (?sp=MÃ) — dùng khi quét trên app, không in lên tem POS. */
export function internalProductUrl(ma: string, _ten?: string): string {
  const code = String(ma || '').trim();
  if (!code) return STORE_ORIGIN;
  return `${STORE_ORIGIN}/?sp=${encodeURIComponent(code)}`;
}

/**
 * Gắn ?sp=MÃ vào URL đang mở (localhost / store) + session — mở đúng SP Hàng hóa.
 * Không đổi origin; chỉ cập nhật query.
 */
export function bindInternalSpToBrowser(ma: string): string {
  const code = String(ma || '').trim();
  if (!code) return '';
  const link = internalProductUrl(code);
  try {
    sessionStorage.setItem('aloha_focus_sp', code);
    const next = new URL(window.location.href);
    next.searchParams.set('sp', code);
    next.searchParams.delete('ma');
    const qs = next.searchParams.toString();
    window.history.replaceState({}, '', `${next.pathname}${qs ? `?${qs}` : ''}${next.hash}`);
  } catch {
    /* offline / không có window */
  }
  return link;
}

/**
 * Ưu tiên sitemap shop standalone (slug--mã).
 * CDN KiotViet Web chỉ còn dự phòng — URL hash cũ dễ 404 trên shop mới.
 */
const SITEMAP_URLS = [
  'https://alohathegioichaucay.com/sitemap.xml',
  'https://cdn-kvweb.citigo.net/sitemaps/906762/product1/product.xml',
] as const;

/** v7: bỏ cache map URL hash KiotViet cũ. */
const CACHE_KEY = 'aloha_shop_product_url_map_v7';
const CACHE_AT_KEY = 'aloha_shop_product_url_map_at_v7';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Map trong RAM — tránh mất link khi localStorage đầy / lỗi ghi. */
let memoryMap: UrlMap | null = null;

export function slugifyShop(text: string): string {
  return normalizeString(text)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140);
}

/** Điểm ưu tiên URL — slug--mã (shop mới) cao hơn slug-hash (KV cũ). */
function detailUrlScore(url: string): number {
  const path = String(url || '').split(/[?#]/)[0] || '';
  if (/\/c\/[^/]+\/p\/[^/]+--[^/]+$/i.test(path)) return 6;
  if (/\/sp\/[^/]+$/i.test(path)) return 5;
  if (/\/c\/[^/]+\/p\/[^/]+-[a-f0-9]{5,8}$/i.test(path)) return 2; // KV hex cũ
  if (/\/c\/[^/]+\/p\//i.test(path)) return 4;
  if (/\/p\//i.test(path)) return 3;
  if (/\/products\//i.test(path)) return 1;
  return 0;
}

function preferDetailUrl(prev: string | undefined, next: string): string {
  if (!prev) return next;
  return detailUrlScore(next) >= detailUrlScore(prev) ? next : prev;
}

function isShopDetailUrl(url: string): boolean {
  return detailUrlScore(url) > 0 && /alohathegioichaucay\.com/i.test(url);
}

/** Khi chưa khớp sitemap — /sp/{mã} luôn mở được trên shop mới. */
export function shopProductUrlFallback(ma: string, ten?: string): string {
  const code = String(ma || '').trim();
  if (code) return `${SHOP_ORIGIN}/sp/${encodeURIComponent(code)}`;
  const name = String(ten || '').trim();
  if (!name) return SHOP_ORIGIN;
  return `${SHOP_ORIGIN}/tim?q=${encodeURIComponent(name)}`;
}

/** Các biến thể slug tên để khớp sitemap (bỏ ngoặc, rút ngắn…). */
function nameSlugCandidates(ten: string): string[] {
  const raw = String(ten || '').trim();
  if (!raw) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const sl = slugifyShop(s);
    if (sl && !out.includes(sl)) out.push(sl);
  };
  push(raw);
  push(raw.replace(/\([^)]*\)/g, ' '));
  push(raw.split('(')[0] || raw);
  const full = slugifyShop(raw);
  const parts = full.split('-').filter(Boolean);
  for (let n = parts.length; n >= Math.min(3, parts.length); n--) {
    const sl = parts.slice(0, n).join('-');
    if (sl && !out.includes(sl)) out.push(sl);
  }
  return out;
}

type UrlMap = Record<string, string>;

function readCachedMap(): UrlMap | null {
  if (memoryMap && Object.keys(memoryMap).length > 50) return memoryMap;
  try {
    const at = Number(localStorage.getItem(CACHE_AT_KEY) || 0);
    if (!at || Date.now() - at > CACHE_TTL_MS) return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UrlMap;
    if (parsed && Object.keys(parsed).length > 50) {
      if (mapLooksStale(parsed)) return null;
      memoryMap = parsed;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Cache toàn URL hash KV → coi cũ, tải lại sitemap shop. */
function mapLooksStale(map: UrlMap): boolean {
  const vals = Object.values(map);
  if (!vals.length) return true;
  let neu = 0;
  let hex = 0;
  for (const u of vals) {
    const path = String(u || '').split(/[?#]/)[0] || '';
    if (/\/p\/[^/]+--[^/]+$/i.test(path) || /\/sp\//i.test(path)) neu += 1;
    else if (/\/p\/[^/]+-[a-f0-9]{5,8}$/i.test(path)) hex += 1;
  }
  return neu < 30 && hex > neu;
}

function writeCachedMap(map: UrlMap) {
  memoryMap = map;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    localStorage.setItem(CACHE_AT_KEY, String(Date.now()));
  } catch {
    /* quota / private mode — vẫn giữ memoryMap */
  }
}

function pickFromMap(cached: UrlMap, ma: string, ten: string): string | null {
  const code = String(ma || '').trim().toUpperCase();
  const name = String(ten || '').trim();

  const candidates: string[] = [];
  if (code && cached[code]) candidates.push(cached[code]);

  for (const sl of nameSlugCandidates(name)) {
    const low = sl.toLowerCase();
    const byTen = cached[`TEN:${low}`];
    if (byTen) candidates.push(byTen);
    const bySlug = cached[`SLUG:${low}`];
    if (bySlug) candidates.push(bySlug);
  }

  if (name) {
    const primary = slugifyShop(name).toLowerCase();
    if (primary.length >= 8) {
      let bestUrl = '';
      let bestLen = 0;
      for (const [k, url] of Object.entries(cached)) {
        if (!k.startsWith('SLUG:') && !k.startsWith('TEN:')) continue;
        const key = k.slice(k.indexOf(':') + 1);
        if (key.length < 8) continue;
        const hit =
          key === primary ||
          key.startsWith(primary + '-') ||
          primary.startsWith(key + '-');
        if (hit && key.length > bestLen) {
          bestLen = key.length;
          bestUrl = url;
        }
      }
      if (bestUrl) candidates.push(bestUrl);
    }
  }

  let best: string | null = null;
  for (const url of candidates) {
    if (!isShopDetailUrl(url)) continue;
    best = preferDetailUrl(best || undefined, url);
  }
  // Không trả URL hash KV cũ nếu đã có mã — dùng /sp/{mã} chắc chắn mở được.
  if (best && code && detailUrlScore(best) <= 2) {
    return shopProductUrlFallback(code, name);
  }
  return best;
}

/**
 * Link trang chi tiết SP trên alohathegioichaucay.com
 * (vd. /c/binh-tuoi-cay/p/binh-xit-1-5l--bx1500ml).
 */
export function shopProductUrl(ma: string, ten?: string): string {
  const code = String(ma || '').trim().toUpperCase();
  const name = String(ten || '').trim();
  const cached = readCachedMap();
  if (cached) {
    const hit = pickFromMap(cached, code, name);
    if (hit) return hit;
  }
  return shopProductUrlFallback(code, name);
}

/** Parse sitemap → map mã / slug / tên → URL đầy đủ. */
export function parseSitemapToMap(xml: string): UrlMap {
  const map: UrlMap = {};
  const put = (key: string, url: string) => {
    map[key] = preferDetailUrl(map[key], url);
  };

  const blocks = xml.split(/<\/url>/i);
  for (const block of blocks) {
    const locM = block.match(/<loc>(https:\/\/alohathegioichaucay\.com\/[^<]+)<\/loc>/i);
    if (!locM) continue;
    const url = locM[1].trim();
    if (!/\/p\//i.test(url) && !/\/products\//i.test(url) && !/\/sp\//i.test(url)) continue;

    let slugPart = '';
    const pMatch = url.match(/\/p\/([^/?#]+)/i);
    const spMatch = url.match(/\/sp\/([^/?#]+)/i);
    const prodMatch = url.match(/\/products\/([^/?#]+)\/([a-f0-9]{5,8})/i);
    if (pMatch) slugPart = decodeURIComponent(pMatch[1]);
    else if (spMatch) {
      put(decodeURIComponent(spMatch[1]).toUpperCase(), url);
      continue;
    } else if (prodMatch) slugPart = `${prodMatch[1]}-${prodMatch[2]}`;
    else slugPart = decodeURIComponent(url.split('/').pop() || '');

    // Shop mới: slug--MA
    const dd = slugPart.match(/^(.*)--([A-Za-z0-9][A-Za-z0-9._-]*)$/);
    if (dd) {
      put(dd[2].toUpperCase(), url);
      if (dd[1]) put(`SLUG:${dd[1].toLowerCase()}`, url);
    }

    const parts = slugPart.split('-').filter(Boolean);
    let withoutHex = slugPart;
    if (parts.length >= 2 && /^[a-f0-9]{5,8}$/i.test(parts[parts.length - 1]!)) {
      withoutHex = parts.slice(0, -1).join('-');
      const codeGuess = parts[parts.length - 2] || '';
      if (codeGuess && /[0-9]/.test(codeGuess) && codeGuess.length <= 24) {
        put(codeGuess.toUpperCase(), url);
      }
    }
    if (withoutHex) put(`SLUG:${withoutHex.toLowerCase()}`, url);
    if (slugPart) put(`SLUG:${slugPart.toLowerCase()}`, url);

    const titleM =
      block.match(/<image:title>([^<]*)<\/image:title>/i) ||
      block.match(/<image:title><!\[CDATA\[(.*?)\]\]><\/image:title>/i);
    const title = titleM ? titleM[1].trim() : '';
    if (title) {
      const tSlug = slugifyShop(title);
      if (tSlug) put(`TEN:${tSlug}`, url);
    }
  }
  return map;
}

/**
 * Tải map URL từ sitemap (1 lần/ngày). Gọi trước khi in/xuất bảng giá.
 * Ưu tiên /api/shop-product-map (máy chủ có bản dự phòng trên đĩa khi CDN lỗi).
 */
export async function ensureShopProductUrlMap(force = false): Promise<number> {
  if (!force) {
    const cached = readCachedMap();
    if (cached && Object.keys(cached).length > 50) {
      const hasDetail = Object.values(cached).some(
        (u) => /\/c\/[^/]+\/p\/[^/]+--/i.test(u) || /\/sp\//i.test(u) || /\/c\/[^/]+\/p\//i.test(u)
      );
      if (hasDetail && !mapLooksStale(cached)) return Object.keys(cached).length;
    }
  } else {
    memoryMap = null;
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_AT_KEY);
      // Xóa luôn cache v6 cũ nếu còn
      localStorage.removeItem('aloha_shop_product_url_map_v6');
      localStorage.removeItem('aloha_shop_product_url_map_at_v6');
    } catch {
      /* ignore */
    }
  }
  try {
    const res = await fetch('/api/shop-product-map?fresh=1', { credentials: 'same-origin' });
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; map?: UrlMap; count?: number };
      if (json?.map && Object.keys(json.map).length) {
        writeCachedMap(json.map);
        return Object.keys(json.map).length;
      }
    }
  } catch {
    /* thử CDN / shop sitemap */
  }
  for (const sitemapUrl of SITEMAP_URLS) {
    try {
      const res = await fetch(sitemapUrl, { credentials: 'omit' });
      if (!res.ok) continue;
      const xml = await res.text();
      const map = parseSitemapToMap(xml);
      if (Object.keys(map).length) {
        writeCachedMap(map);
        return Object.keys(map).length;
      }
    } catch {
      /* thử URL kế */
    }
  }
  return 0;
}

/** Link xuất/in → trang chi tiết web bán. */
export function resolveShopProductUrl(ma: string, ten?: string): string {
  return shopProductUrl(ma, ten);
}
