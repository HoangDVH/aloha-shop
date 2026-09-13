/**
 * Client — URL QR ngắn /p/{token} cho tem nhiệt.
 */
import { STORE_ORIGIN } from './shopProductUrl';

const TOKEN_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,8}$/i;

export function shortProductQrUrl(token: string): string {
  const t = String(token || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const base = STORE_ORIGIN.replace(/\/$/, '');
  return `${base}/p/${t}`;
}

/**
 * Trích token QR ngắn — chỉ từ path đúng `/p/XXXX` (tem nhiệt Aloha).
 * Không coi mã SP / mã vạch 4–8 ký tự là token (trước đây hay báo «không đúng SP»).
 */
export function parseQrTokenFromScan(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  const fromPath = (pathname: string) => {
    const m = String(pathname || '').match(/^\/p\/([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,8})$/i);
    return m?.[1] ? m[1].trim().toUpperCase() : '';
  };
  try {
    if (/^https?:\/\//i.test(t) || t.startsWith('/p/')) {
      const u = new URL(t.startsWith('http') ? t : `https://x.local${t.startsWith('/') ? t : `/${t}`}`);
      return fromPath(u.pathname);
    }
  } catch {
    /* ignore */
  }
  // Chỉ token từ path /p/ — không coi mã SP/mã vạch thuần là token (tránh nhầm mã 6 ký tự).
  return '';
}

/** Gọi server lấy/tạo token cho danh sách mã SP → Map(ma → url ngắn). */
export async function ensureShortQrUrlsForCodes(
  codes: string[]
): Promise<Map<string, string>> {
  const uniq = Array.from(
    new Set(codes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean))
  );
  const out = new Map<string, string>();
  if (uniq.length === 0) return out;

  try {
    const r = await fetch('/api/qr/ensure-tokens', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: uniq }),
    });
    const j = (await r.json()) as {
      ok?: boolean;
      urls?: Record<string, string>;
      tokens?: Record<string, string>;
    };
    if (j.ok && j.urls) {
      for (const ma of uniq) {
        const url = j.urls[ma];
        if (url) out.set(ma, url);
      }
    }
    if (out.size === 0 && j.tokens) {
      for (const ma of uniq) {
        const token = j.tokens[ma];
        if (token) out.set(ma, shortProductQrUrl(token));
      }
    }
  } catch {
    /* fallback caller */
  }
  return out;
}

const qrTokenMaCache = new Map<string, string>();
const qrTokenMaPending = new Map<string, Promise<string>>();

/** Quét token ngắn → mã SP (app nội bộ). Có cache — quét lại cùng tem không gọi API. */
export async function resolveScanToProductMa(raw: string): Promise<string> {
  const token = parseQrTokenFromScan(raw);
  if (!token) return '';

  const cached = qrTokenMaCache.get(token);
  if (cached) return cached;

  const inflight = qrTokenMaPending.get(token);
  if (inflight) return inflight;

  const job = (async () => {
    try {
      const r = await fetch(`/api/qr/resolve/${encodeURIComponent(token)}`, {
        credentials: 'same-origin',
      });
      const j = (await r.json()) as { ok?: boolean; ma?: string; status?: string };
      if (j.ok && j.ma) {
        const ma = String(j.ma).trim().toUpperCase();
        qrTokenMaCache.set(token, ma);
        return ma;
      }
      if (j.status === 'unknown') return '';
    } catch {
      /* fall through */
    }
    return '';
  })();

  qrTokenMaPending.set(token, job);
  try {
    return await job;
  } finally {
    qrTokenMaPending.delete(token);
  }
}

let qrTokenMapPrefetch: Promise<void> | null = null;

/** Tải sẵn map token → mã SP khi mở camera — /p/ không chờ resolve từng tem. */
export function prefetchQrTokenMap(): void {
  if (qrTokenMapPrefetch) return;
  qrTokenMapPrefetch = (async () => {
    try {
      const r = await fetch('/api/qr/token-map', { credentials: 'same-origin' });
      const j = (await r.json()) as { ok?: boolean; map?: Record<string, string> };
      if (!j.ok || !j.map) return;
      for (const [token, ma] of Object.entries(j.map)) {
        const t = String(token || '').trim().toUpperCase();
        const m = String(ma || '').trim().toUpperCase();
        if (t && m) qrTokenMaCache.set(t, m);
      }
    } catch {
      /* offline */
    }
  })();
}

/** Trang mở trực tiếp /p/TOKEN (SPA / Firebase) → redirect ?sp=MÃ. */
export async function resolveQrShortPathRedirect(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/p\/([A-Za-z0-9]+)/i);
  if (!m?.[1]) return null;
  const token = m[1].toUpperCase();
  try {
    const r = await fetch(`/api/qr/resolve/${encodeURIComponent(token)}`, {
      credentials: 'same-origin',
    });
    const j = (await r.json()) as { ok?: boolean; status?: string; ma?: string; token?: string };
    if (j.ma && (j.ok || j.status === 'active')) {
      return `/?sp=${encodeURIComponent(j.ma)}`;
    }
    if (j.ma && j.status === 'inactive') {
      return `/?sp=${encodeURIComponent(j.ma)}&qr_status=inactive`;
    }
    const t = j.token || token;
    return `/?qr_status=unknown&qr_token=${encodeURIComponent(t)}`;
  } catch {
    return '/?qr_status=unknown';
  }
}
