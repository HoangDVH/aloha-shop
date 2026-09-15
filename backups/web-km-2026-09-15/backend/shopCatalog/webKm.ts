/**
 * Giá KM trên aloha_products (`webKm` + `giaWebLichSu`).
 * giaThamChieu = min giá đã offer trong 30 ngày (chống tăng giá ảo).
 */
import { z } from "zod";

export const LOOKBACK_DAYS = 30;
export const HISTORY_MAX = 60;

export type GiaWebLichSuPoint = {
  /** Giá bán khách trả tại thời điểm (KM nếu đang giảm) */
  gia: number;
  at: string;
  by?: string;
  /** Giá web niêm yết lúc ghi */
  giaWeb?: number;
  /** Giá KM lúc ghi (null/0 = không KM) */
  giaKm?: number | null;
  phanTram?: number | null;
};

/** Dòng lịch sử đã gộp (UI admin). */
export type PriceHistoryRow = {
  at: string;
  by?: string;
  gia: number;
  giaWeb?: number;
  giaKm?: number | null;
  phanTram?: number | null;
};

export type WebKm = {
  gia: number;
  phanTram?: number;
  tu?: string;
  den?: string;
};

export type ResolvedShopSellPrice = {
  gia: number;
  giaGoc?: number;
  dangKm: boolean;
  phanTramGiam?: number;
  giaThamChieu: number;
  giaWeb: number;
  giaWebTangAo: boolean;
};

export const webKmSchema = z
  .object({
    gia: z.number().finite().positive(),
    phanTram: z.number().finite().min(1).max(99).optional(),
    tu: z.string().trim().optional().nullable(),
    den: z.string().trim().optional().nullable(),
  })
  .strict();

export const webKmBulkSchema = z.object({
  mode: z.enum(["apply", "clear"]),
  phanTram: z.number().finite().min(1).max(99).optional(),
  tu: z.string().trim().optional().nullable(),
  den: z.string().trim().optional().nullable(),
});

/** Giá gốc web sau overlay (giaWeb ưu tiên). */
export function baseGiaWeb(doc: Record<string, unknown>): number {
  const n = Number(
    doc.giaWeb ?? doc.giaBan ?? doc.giaChung ?? doc.basePrice ?? 0
  );
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseIso(s: string | undefined | null): number | null {
  if (!s) return null;
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : null;
}

export function isWebKmInSchedule(
  webKm: WebKm | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!webKm) return false;
  const tu = parseIso(webKm.tu ?? null);
  const den = parseIso(webKm.den ?? null);
  if (tu != null && nowMs < tu) return false;
  if (den != null && nowMs > den) return false;
  return true;
}

export function readGiaWebLichSu(
  doc: Record<string, unknown>
): GiaWebLichSuPoint[] {
  const raw = doc.giaWebLichSu;
  if (!Array.isArray(raw)) return [];
  const out: GiaWebLichSuPoint[] = [];
  for (const p of raw) {
    const gia = Math.round(Number((p as any)?.gia) || 0);
    const at = String((p as any)?.at || "").trim();
    if (!(gia > 0) || !at) continue;
    const by = String((p as any)?.by || "").trim();
    const giaWebN = Math.round(Number((p as any)?.giaWeb) || 0);
    const giaKmRaw = (p as any)?.giaKm;
    const giaKmN =
      giaKmRaw == null || giaKmRaw === ""
        ? undefined
        : Math.round(Number(giaKmRaw) || 0);
    const pctN = Math.round(Number((p as any)?.phanTram) || 0);
    const point: GiaWebLichSuPoint = { gia, at };
    if (by) point.by = by;
    if (giaWebN > 0) point.giaWeb = giaWebN;
    if (giaKmN != null && giaKmN > 0) point.giaKm = giaKmN;
    else if (giaKmRaw === null) point.giaKm = null;
    if (pctN >= 1 && pctN <= 99) point.phanTram = pctN;
    out.push(point);
  }
  return out;
}

/** Min giá đã ghi trong LOOKBACK_DAYS ∪ giaWeb hiện tại. */
export function resolveGiaThamChieu(
  doc: Record<string, unknown>,
  nowMs = Date.now(),
  opts?: { excludeGia?: number }
): number {
  const current = baseGiaWeb(doc);
  const since = nowMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const exclude =
    opts?.excludeGia != null && Number(opts.excludeGia) > 0
      ? Math.round(Number(opts.excludeGia))
      : 0;
  let min = current > 0 && current !== exclude ? current : Infinity;
  for (const p of readGiaWebLichSu(doc)) {
    const t = parseIso(p.at);
    if (t == null || t < since) continue;
    if (!(p.gia > 0)) continue;
    if (exclude > 0 && p.gia === exclude) continue;
    if (p.gia < min) min = p.gia;
  }
  if (!Number.isFinite(min) || min === Infinity) {
    // Không còn mốc khác — dùng giaWeb (kể cả khi = exclude)
    return current;
  }
  return Math.round(min);
}

export function computePhanTramGiam(giaGoc: number, giaBan: number): number {
  if (!(giaGoc > 0) || !(giaBan >= 0) || giaBan >= giaGoc) return 0;
  return Math.max(
    1,
    Math.min(99, Math.round((1 - giaBan / giaGoc) * 100))
  );
}

export function priceFromPercent(giaGoc: number, phanTram: number): number {
  const p = Math.max(1, Math.min(99, Math.round(phanTram)));
  return Math.max(0, Math.round(giaGoc * (1 - p / 100)));
}

export function normalizeWebKmInput(
  input: {
    gia?: number;
    phanTram?: number;
    tu?: string | null;
    den?: string | null;
  },
  giaThamChieu: number
): WebKm {
  let gia = Math.round(Number(input.gia) || 0);
  let phanTram =
    input.phanTram != null && Number(input.phanTram) > 0
      ? Math.round(Number(input.phanTram))
      : undefined;
  if (!(gia > 0) && phanTram && giaThamChieu > 0) {
    gia = priceFromPercent(giaThamChieu, phanTram);
  }
  if (gia > 0 && giaThamChieu > 0 && !phanTram) {
    phanTram = computePhanTramGiam(giaThamChieu, gia);
  }
  const tu = String(input.tu || "").trim() || undefined;
  const den = String(input.den || "").trim() || undefined;
  return {
    gia,
    ...(phanTram && phanTram >= 1 && phanTram <= 99 ? { phanTram } : {}),
    ...(tu ? { tu } : {}),
    ...(den ? { den } : {}),
  };
}

/**
 * Validate trước khi ghi webKm.
 * Trả error string hoặc null nếu OK.
 */
export function validateWebKmAgainstRef(
  webKm: WebKm,
  giaThamChieu: number
): string | null {
  if (!(webKm.gia > 0)) return "Giá khuyến mãi không hợp lệ";
  if (!(giaThamChieu > 0)) {
    return "Sản phẩm chưa có giá web / giá tham chiếu";
  }
  if (webKm.gia >= giaThamChieu) {
    return `Giá KM phải thấp hơn ${giaThamChieu.toLocaleString("vi-VN")} ₫ (giá thấp nhất 30 ngày)`;
  }
  const tu = parseIso(webKm.tu ?? null);
  const den = parseIso(webKm.den ?? null);
  if (tu != null && den != null && tu >= den) {
    return "Thời gian bắt đầu phải trước kết thúc";
  }
  return null;
}

export function resolveShopSellPrice(
  doc: Record<string, unknown>,
  nowMs = Date.now()
): ResolvedShopSellPrice {
  const giaWeb = baseGiaWeb(doc);

  const raw = doc.webKm;
  let webKm: WebKm | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const gia = Math.round(Number((raw as any).gia) || 0);
    if (gia > 0) {
      webKm = {
        gia,
        phanTram:
          Number((raw as any).phanTram) > 0
            ? Math.round(Number((raw as any).phanTram))
            : undefined,
        tu: String((raw as any).tu || "").trim() || undefined,
        den: String((raw as any).den || "").trim() || undefined,
      };
    }
  }

  /**
   * Không tính giá KM hiện tại vào min — nếu không, vừa lưu KM 72k
   * rồi snapshot 72k vào lịch sử → tham chiếu=72k → tự hủy KM (72k < 72k sai).
   */
  const giaThamChieu =
    resolveGiaThamChieu(
      doc,
      nowMs,
      webKm ? { excludeGia: webKm.gia } : undefined
    ) || giaWeb;
  const giaWebTangAo = giaWeb > 0 && giaThamChieu > 0 && giaWeb > giaThamChieu;

  const inSched = isWebKmInSchedule(webKm, nowMs);
  const okSale =
    webKm &&
    inSched &&
    giaThamChieu > 0 &&
    webKm.gia > 0 &&
    webKm.gia < giaThamChieu;

  if (okSale && webKm) {
    const phanTramGiam =
      webKm.phanTram && webKm.phanTram >= 1 && webKm.phanTram <= 99
        ? webKm.phanTram
        : computePhanTramGiam(giaThamChieu, webKm.gia);
    return {
      gia: webKm.gia,
      giaGoc: giaThamChieu,
      dangKm: true,
      phanTramGiam,
      giaThamChieu,
      giaWeb,
      giaWebTangAo,
    };
  }

  return {
    gia: giaWeb,
    dangKm: false,
    giaThamChieu,
    giaWeb,
    giaWebTangAo,
  };
}

export function appendGiaWebLichSu(
  existing: GiaWebLichSuPoint[],
  gia: number,
  opts?: {
    at?: string;
    by?: string;
    giaWeb?: number;
    giaKm?: number | null;
    phanTram?: number | null;
  }
): GiaWebLichSuPoint[] {
  const g = Math.round(gia);
  if (!(g > 0)) return existing;
  const at = opts?.at || new Date().toISOString();
  const by = String(opts?.by || "").trim();
  const point: GiaWebLichSuPoint = { gia: g, at };
  if (by) point.by = by;
  const gw = Math.round(Number(opts?.giaWeb) || 0);
  if (gw > 0) point.giaWeb = gw;
  if (opts && "giaKm" in opts) {
    const km = opts.giaKm == null ? null : Math.round(Number(opts.giaKm) || 0);
    point.giaKm = km != null && km > 0 ? km : null;
  }
  if (opts && "phanTram" in opts) {
    const pct = Math.round(Number(opts.phanTram) || 0);
    point.phanTram = pct >= 1 && pct <= 99 ? pct : null;
  }
  const last = existing[existing.length - 1];
  if (
    last &&
    last.gia === g &&
    (last.giaWeb || 0) === (point.giaWeb || 0) &&
    (last.giaKm || 0) === (point.giaKm || 0)
  ) {
    const next = existing.slice(0, -1);
    next.push(point);
    return next.slice(-HISTORY_MAX);
  }
  return [...existing, point].slice(-HISTORY_MAX);
}

/** Snapshot giá bán hiện tại (sau resolve) vào lịch sử. */
export function pushOfferSnapshot(
  doc: Record<string, unknown>,
  opts?: { by?: string; nowMs?: number; at?: string }
): GiaWebLichSuPoint[] {
  const resolved = resolveShopSellPrice(doc, opts?.nowMs);
  const offer = resolved.dangKm ? resolved.gia : resolved.giaWeb;
  return appendGiaWebLichSu(readGiaWebLichSu(doc), offer, {
    by: opts?.by,
    at: opts?.at,
    giaWeb: resolved.giaWeb,
    giaKm: resolved.dangKm ? resolved.gia : null,
    phanTram: resolved.dangKm ? resolved.phanTramGiam ?? null : null,
  });
}

/**
 * Gộp các mốc cùng giây (vd. 80k + 72k lúc bật KM) thành 1 dòng UI:
 * giá web / giá KM / %.
 */
export function groupPriceHistoryRows(
  points: GiaWebLichSuPoint[]
): PriceHistoryRow[] {
  type Bucket = {
    at: string;
    by?: string;
    items: GiaWebLichSuPoint[];
  };
  const buckets: Bucket[] = [];
  const keyOf = (at: string) => {
    const t = Date.parse(at);
    return Number.isFinite(t) ? Math.floor(t / 1000) : at;
  };

  for (const p of points) {
    const k = keyOf(p.at);
    const last = buckets[buckets.length - 1];
    const lastK = last ? keyOf(last.at) : null;
    if (last && lastK === k) {
      last.items.push(p);
      if (!last.by && p.by) last.by = p.by;
      // giữ at mới hơn trong cùng giây
      if (Date.parse(p.at) >= Date.parse(last.at)) last.at = p.at;
    } else {
      buckets.push({ at: p.at, by: p.by, items: [p] });
    }
  }

  return buckets.map((b) => {
    const rich = [...b.items].reverse().find(
      (x) => x.giaWeb != null || x.giaKm != null || x.phanTram != null
    );
    if (rich && (rich.giaWeb || rich.giaKm != null)) {
      const giaWeb = rich.giaWeb || rich.gia;
      const giaKm =
        rich.giaKm != null && rich.giaKm > 0 ? rich.giaKm : null;
      const phanTram =
        rich.phanTram != null && rich.phanTram > 0
          ? rich.phanTram
          : giaKm && giaWeb > giaKm
            ? computePhanTramGiam(giaWeb, giaKm)
            : null;
      return {
        at: b.at,
        by: b.by || rich.by,
        gia: rich.gia,
        giaWeb,
        giaKm,
        phanTram,
      };
    }

    const gias = [
      ...new Set(
        b.items.map((x) => x.gia).filter((n) => n > 0)
      ),
    ].sort((a, c) => c - a);
    if (gias.length >= 2) {
      const giaWeb = gias[0]!;
      const giaKm = gias[gias.length - 1]!;
      return {
        at: b.at,
        by: b.by,
        gia: giaKm,
        giaWeb,
        giaKm,
        phanTram: computePhanTramGiam(giaWeb, giaKm) || null,
      };
    }
    const only = gias[0] || b.items[0]!.gia;
    return {
      at: b.at,
      by: b.by,
      gia: only,
      giaWeb: only,
      giaKm: null,
      phanTram: null,
    };
  });
}
