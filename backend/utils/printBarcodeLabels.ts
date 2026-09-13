/**
 * In tem nhiệt HPRT HT330 — Page Setup Seagull «2 TEM» + kiểu KiotViet.
 *
 * Khổ tờ = đúng stock máy: 1.97 in × 0.39 in  ≈  50.04 × 9.91 mm
 * - 2 tem/hàng: mỗi tem ~24.2 × 9.91 mm, khe giữa 1.6 mm
 * - Khe giấy dọc (Gap Height): 0.12 in — cảm biến máy, không cộng vào chiều cao trang
 * - Media: Labels With Gaps · Tear Off · Portrait
 * - In: Direct Thermal · Chrome 100% · lề Không
 * - QR = đúng mã SP (KiotViet POS tìm theo code). Không nhét link web.
 */
import QRCode from 'qrcode';
import type { Product } from '../services/database';
import { resolveBarcodeValue } from './productBarcodeValue';

/** Khổ cuộn tem nhiệt ALOHA (composite). */
export type BarcodeLabelSize = '72x22' | '50x20' | '47x15' | '34x20';
/** 2 = 2 tem một hàng (mặc định). 1 = chỉ nửa trái, nửa phải trống. */
export type BarcodeLabelColumns = 1 | 2;

/** Tên stock Seagull / Chrome — máy IN 2 TEM / HPRT HT330. */
export const THERMAL_STOCK_NAME = '2 TEM';
export const THERMAL_STOCK_TYPE = 'Die-Cut Labels';
/** Khổ tờ = stock Seagull «2 TEM (1.97 in × 0.39 in)». */
export const THERMAL_PAGE_W_IN = 1.97;
export const THERMAL_PAGE_H_IN = 0.39;
export const THERMAL_PAGE_W_MM = Math.round(THERMAL_PAGE_W_IN * 25.4 * 100) / 100;
export const THERMAL_PAGE_H_MM = Math.round(THERMAL_PAGE_H_IN * 25.4 * 100) / 100;
/** Tỉ lệ in = 100% — khớp Page Setup, không thu 50/59. */
export const THERMAL_PRINT_PCT_DEFAULT = 100;
export const THERMAL_PAGE_PAD_X_MM = 0;
export const THERMAL_GAP_MM = 1.6;
export const THERMAL_LABEL_W_MM =
  Math.round(((THERMAL_PAGE_W_MM - THERMAL_GAP_MM) / 2) * 100) / 100;
export const THERMAL_LABEL_H_MM = THERMAL_PAGE_H_MM;

const THERMAL_PAGE = {
  pageW: THERMAL_PAGE_W_MM,
  pageH: THERMAL_PAGE_H_MM,
  labelW: THERMAL_LABEL_W_MM,
  labelH: THERMAL_LABEL_H_MM,
  padX: THERMAL_PAGE_PAD_X_MM,
  gap: THERMAL_GAP_MM,
};

/** Size cũ map về stock 2 TEM 1.97×0.39 — media thống nhất. */
const LEGACY_SIZE_MAP: Record<string, typeof THERMAL_PAGE> = {
  '72x22': THERMAL_PAGE,
  '50x20': THERMAL_PAGE,
  '47x15': THERMAL_PAGE,
  '34x20': THERMAL_PAGE,
};

export type PrintBarcodeLabelOptions = {
  copiesPerProduct?: number;
  size?: BarcodeLabelSize;
  customWidthMm?: number;
  customHeightMm?: number;
  columns?: BarcodeLabelColumns;
  gapMm?: number;
  showLogo?: boolean;
  showName?: boolean;
  showBarcode?: boolean;
  showBarcodeValue?: boolean;
  showPrice?: boolean;
  autoPrint?: boolean;
  barcodeHeight?: number;
  barcodeWidth?: number;
  fontSize?: number;
  printWindow?: Window | null;
  printShell?: BarcodePrintShell | null;
  productUrlBuilder?: (p: Product) => string;
  /** Gọi khi in xong: tspl = máy trực tiếp, chrome = hộp in trình duyệt. */
  onPrintComplete?: (info: { method: 'tspl' | 'chrome'; count: number }) => void;
  /** TSPL thất bại — báo lỗi (vẫn có thể fallback Chrome). */
  onPrintFailed?: (message: string) => void;
  /** Luôn mở hộp thoại in Chrome (2 TEM) — như trước. false = thử TSPL thẳng máy trước. */
  showPrintDialog?: boolean;
  /** Bỏ qua TSPL, ép in Chrome (debug). */
  forceChromePrint?: boolean;
  /** TSPL: độ đậm máy 0–15 (mặc định 3 — chống lem). */
  tsplDensity?: number;
  /** TSPL: tốc độ in 1–6 (mặc định 1 — chậm nhất, ít dính mực). */
  tsplSpeed?: number;
};

export type BarcodePrintShell = {
  win: Window;
  writeHtml: (html: string) => void;
  cleanup: () => void;
  isIframe: boolean;
};

function isMobilePrintClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

const BARCODE_LOADING_HTML = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Chuẩn bị tem…</title>
<style>
  body{font-family:Arial,sans-serif;padding:28px;background:#F7F3EA;color:#333;margin:0}
  h2{color:#1b5e20;margin:0 0 8px;font-size:18px}
  p{font-size:14px;line-height:1.45}
  .bar{height:6px;background:#c8e6c9;border-radius:99px;overflow:hidden;max-width:320px;margin-top:14px}
  .bar>i{display:block;height:100%;width:40%;background:linear-gradient(90deg,#43a047,#1e88e5);
    animation:s .7s ease-in-out infinite;border-radius:99px}
  @keyframes s{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}
</style></head><body>
  <h2>Đang tạo tem nhiệt…</h2>
  <p>Chuẩn bị bản in — hộp thoại máy in hiện ngay khi xong.</p>
  <div class="bar"><i></i></div>
  <p id="pg" style="font-size:13px;color:#558b2f;margin-top:10px"></p>
</body></html>`;

export type BarcodePrintShellOpts = {
  /** Không hiện màn «Đang tạo tem…» — mở trống rồi ghi bản in. */
  skipLoading?: boolean;
  /** iframe ẩn — chỉ hiện hộp thoại in, không ló cửa sổ trung gian. */
  hidden?: boolean;
};

export function openBarcodePrintShell(
  prefer: 'auto' | 'pc' | 'phone' = 'auto',
  opts: BarcodePrintShellOpts = {}
): BarcodePrintShell | null {
  const skipLoading = opts.skipLoading === true;
  const hidden = opts.hidden === true;
  const wantPhone =
    prefer === 'phone' || (prefer === 'auto' && isMobilePrintClient());

  if (!wantPhone && !hidden) {
    try {
      const w = window.open('', '_blank', 'width=900,height=640');
      if (w) {
        if (!skipLoading) {
          try {
            w.document.write(BARCODE_LOADING_HTML);
            w.document.close();
          } catch {
            /* ignore */
          }
        }
        return {
          win: w,
          isIframe: false,
          writeHtml: (html: string) => {
            try {
              w.document.open();
              w.document.write(html);
              w.document.close();
              return;
            } catch {
              /* fallback blob */
            }
            try {
              const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              w.location.replace(url);
              setTimeout(() => URL.revokeObjectURL(url), 120_000);
            } catch {
              /* ignore */
            }
          },
          cleanup: () => {},
        };
      }
    } catch {
      /* fallback iframe */
    }
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'In tem nhiệt ALOHA');
  iframe.setAttribute('name', 'aloha-barcode-print-frame');
  iframe.style.cssText = hidden
    ? 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;'
    : 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483646;border:0;background:#fff;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return null;
  }
  if (!skipLoading) {
    try {
      win.document.open();
      win.document.write(BARCODE_LOADING_HTML);
      win.document.close();
    } catch {
      iframe.remove();
      return null;
    }
  }
  return {
    win,
    isIframe: true,
    writeHtml: (html: string) => {
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch (e) {
        console.warn('[printBarcodeLabels] ghi iframe:', e);
      }
    },
    cleanup: () => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    },
  };
}

/** @deprecated dùng openBarcodePrintShell('pc') */
export function openBarcodePrintWindow(): Window | null {
  const shell = openBarcodePrintShell('pc');
  return shell?.win || null;
}

function resolveDims(
  _opts: Pick<PrintBarcodeLabelOptions, 'size' | 'customWidthMm' | 'customHeightMm' | 'columns'>
): {
  pageW: number;
  pageH: number;
  labelW: number;
  labelH: number;
  padX: number;
  gap: number;
} {
  const key = _opts.size || '72x22';
  const mapped = LEGACY_SIZE_MAP[key] || THERMAL_PAGE;
  return {
    pageW: mapped.pageW,
    pageH: mapped.pageH,
    labelW: mapped.labelW,
    labelH: mapped.labelH,
    padX: mapped.padX,
    gap: mapped.gap,
  };
}

/** Kích thước 1 nửa tem (mm). */
export function sizeMm(
  opts: Pick<PrintBarcodeLabelOptions, 'size' | 'customWidthMm' | 'customHeightMm' | 'columns'>
): { w: number; h: number } {
  const d = resolveDims(opts);
  return { w: d.labelW, h: d.labelH };
}

export function defaultThermalGapMm(
  _size: BarcodeLabelSize | undefined,
  cols: 1 | 2
): number {
  return cols === 2 ? THERMAL_GAP_MM : 0;
}

/** Đăng stock Windows "2 TEM" = 1.97×0.39 in — chạy nền, không chặn mở trang in. */
let stockEnsurePromise: Promise<void> | null = null;
let stockEnsureAt = 0;

export async function ensureThermalPrinterStock(): Promise<void> {
  const now = Date.now();
  // Cache 10 phút — tránh mỗi lần in lại chạy PowerShell chậm
  if (stockEnsurePromise && now - stockEnsureAt < 10 * 60 * 1000) {
    return stockEnsurePromise;
  }
  stockEnsureAt = now;
  stockEnsurePromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      await fetch('/api/printer/ensure-stock-72x22', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
    } catch {
      /* máy không Windows / không quyền — CSS @page vẫn 1.97×0.39 in */
    }
  })();
  return stockEnsurePromise;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Nội dung QR tem nhiệt / máy bán hàng: đúng mã SP.
 * KiotViet chỉ tìm code/barcode — link URL máy POS không ra hàng.
 * Mọi loại tem (A4 / nhiệt / 80mm): QR = mã SP thuần. App quét tự gắn ?sp= trên store.
 */
export function thermalPosQrPayload(p: Product): string {
  const ma = String(p.ma || '').trim().toUpperCase();
  if (ma) return ma;
  return String(resolveBarcodeValue(p) || '').trim().toUpperCase();
}

/** Nóng máy in TSPL (PowerShell + Add-Type) — gọi nền khi mở tab Hàng hóa. */
let tsplWarmupPromise: Promise<void> | null = null;
export function warmupThermalTspl(): void {
  if (tsplWarmupPromise) return;
  tsplWarmupPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      await fetch('/api/printer/warmup-tspl', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: '{}',
      });
      clearTimeout(t);
    } catch {
      /* máy không Windows / timeout — bỏ qua */
    }
  })();
}

function formatTsplError(code?: string): string {
  const c = String(code || '').trim();
  if (c === 'no-thermal-printer') {
    return 'Không tìm thấy máy in nhiệt HPRT. Bật máy, cắm USB và kiểm tra driver «IN 2 TEM».';
  }
  if (c === 'tspl-timeout') {
    return 'Máy in phản hồi chậm — thử lại sau vài giây hoặc kiểm tra cáp USB.';
  }
  if (c === 'missing-script') return 'Thiếu script in TSPL trên server — restart app.';
  if (c) return `In TSPL thất bại: ${c}`;
  return 'In TSPL thất bại — kiểm tra máy HPRT đã bật.';
}

/** In TSPL thẳng máy HPRT (Windows) — trả về ok nếu máy nhận lệnh. */
export async function printThermalViaTspl(
  products: Product[],
  options: {
    columns?: 1 | 2;
    density?: number;
    speed?: number;
    printer?: string;
    qrUrlByMa?: Map<string, string>;
  } = {}
): Promise<{ ok: boolean; error?: string; printer?: string }> {
  const cols: 1 | 2 = options.columns === 1 ? 1 : 2;
  const labels: { qr: string; code: string }[] = [];
  for (const p of products || []) {
    const payload = thermalPosQrPayload(p);
    if (!payload) continue;
    labels.push({
      qr: payload,
      code: payload,
    });
  }
  if (labels.length === 0) return { ok: false, error: 'no-codes' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch('/api/printer/print-tspl-2tem', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        labels,
        columns: cols,
        density: options.density ?? 3,
        speed: options.speed ?? 1,
        printer: options.printer || '',
      }),
    });
    const j = (await r.json()) as {
      ok?: boolean;
      error?: string;
      printer?: string;
      skipped?: boolean;
      reason?: string;
    };
    if (j.skipped) return { ok: false, error: j.reason || 'not-windows' };
    return { ok: j.ok === true, error: j.error, printer: j.printer };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: 'tspl-timeout' };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function defaultThermalQrPayload(p: Product): string {
  return thermalPosQrPayload(p);
}

const thermalQrCache = new Map<string, string>();

/**
 * QR tem nhiệt HT330 — POS KiotViet:
 * 1) Nội dung = mã SP ngắn (ít module → ô đen to, súng 2D đọc được)
 * 2) Error correction cao hơn để chịu lem/xước tem quầy
 * 3) Raster 203 dpi, module nguyên chấm
 * 4) Chừa mép trên/dưới (~0.85 / 1.2 mm) — máy nhiệt hay cắt khi in/xé tem
 */
const THERMAL_DPI = 203;
const THERMAL_QR_SIZE_MM = 7.85;
/** HT330 / driver Chrome hay ăn ~0.8–1 mm mép trên. */
const THERMAL_QR_PAD_TOP_MM = 0.85;
/** Mép dưới hay cắt khi xé tem — chừa rộng hơn mép trên. */
const THERMAL_QR_PAD_BOTTOM_MM = 1.2;
const THERMAL_QR_MARGIN = 2;
const THERMAL_QR_MIN_DOTS = 3;
const THERMAL_QR_CACHE_VER = 'v40-safe-edges';

type ThermalQrPacked = {
  bits: string;
  size: number;
};

function packQrModules(payload: string): ThermalQrPacked {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H', margin: THERMAL_QR_MARGIN });
  const modules = qr.modules;
  const size = modules.size;
  let bits = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      bits += modules.get(r, c) ? '1' : '0';
    }
  }
  return { bits, size };
}

function isBlackModule(bits: string, size: number, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= size || c >= size) return false;
  return bits[r * size + c] === '1';
}

/** Raster PNG 300dpi — ô đen đặc kín ô lưới, liền khối như tem kho. */
function thermalQrRasterHtml(packed: ThermalQrPacked): string {
  const { bits, size } = packed;
  const n = size;
  const targetPx = Math.max(96, Math.round((THERMAL_QR_SIZE_MM / 25.4) * THERMAL_DPI));
  let mod = Math.floor(targetPx / n);
  if (mod < THERMAL_QR_MIN_DOTS) mod = THERMAL_QR_MIN_DOTS;
  const canvasPx = mod * n;

  const canvas = document.createElement('canvas');
  canvas.width = canvasPx;
  canvas.height = canvasPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasPx, canvasPx);
  ctx.fillStyle = '#000000';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isBlackModule(bits, size, r, c)) continue;
      ctx.fillRect(c * mod, r * mod, mod, mod);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  return `<img class="qr-img" src="${dataUrl}" width="${canvasPx}" height="${canvasPx}" alt="" decoding="sync" style="image-rendering:pixelated;image-rendering:crisp-edges"/>`;
}

/** SVG dự phòng: ô đen 100% lưới, liền khối. */
function thermalQrSvgHtml(packed: ThermalQrPacked): string {
  const { bits, size } = packed;
  const n = size;
  const parts: string[] = [
    `<svg class="qr-svg" viewBox="0 0 ${n} ${n}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">`,
    `<rect width="${n}" height="${n}" fill="#fff"/>`,
  ];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isBlackModule(bits, size, r, c)) continue;
      parts.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="#000000"/>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

function buildOneQrImgHtml(payload: string): string {
  const packed = packQrModules(payload);
  // SVG nhanh hơn canvas raster — tem mã SP ngắn in Chrome vẫn sắc nét
  return `<span class="qr-img">${thermalQrSvgHtml(packed)}</span>`;
}

async function buildQrMap(
  products: Product[],
  builder: (p: Product) => string,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, string>> {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const u = builder(p);
    if (!seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  const out = new Map<string, string>();
  let done = 0;
  const total = urls.length || 1;

  const need: string[] = [];
  for (const url of urls) {
    const cacheKey = `${THERMAL_QR_CACHE_VER}|${url}`;
    const cached = thermalQrCache.get(cacheKey);
    if (cached) {
      out.set(url, cached);
      done += 1;
      onProgress?.(done, total);
    } else {
      need.push(url);
    }
  }

  const CONCURRENCY = 64;
  for (let i = 0; i < need.length; i += CONCURRENCY) {
    const batch = need.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const img = buildOneQrImgHtml(url);
          thermalQrCache.set(`${THERMAL_QR_CACHE_VER}|${url}`, img);
          out.set(url, img);
        } catch {
          /* bỏ qua */
        } finally {
          done += 1;
          onProgress?.(done, total);
        }
      })
    );
    if (i + CONCURRENCY < need.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return out;
}

export function prefetchThermalQr(
  products: Product[],
  productUrlBuilder?: (p: Product) => string
): void {
  const builder = productUrlBuilder || defaultThermalQrPayload;
  const list = (products || []).slice(0, 120);
  if (!list.length) return;
  void buildQrMap(list, builder).catch(() => undefined);
  void ensureThermalPrinterStock();
}

function buildOneLabel(p: Product, qrHtml: string): string {
  const code = thermalPosQrPayload(p) || resolveBarcodeValue(p) || String(p.ma || '').trim();
  const qrBlock = qrHtml
    ? `<div class="qr" role="img" aria-label="QR">${qrHtml}</div>`
    : `<div class="qr qr-empty">QR</div>`;

  return `
  <div class="label">
    <div class="label-inner">
      ${qrBlock}
      ${code ? `<div class="ma">${escapeHtml(code)}</div>` : `<div class="ma ma-err">—</div>`}
    </div>
  </div>`;
}

/**
 * CSS 1.97×0.39 in — 2 tem đối xứng (KiotViet / HT330).
 * QR gần kín tem; mã SP dọc phải, to hơn và tách QR rõ hơn.
 */
function buildCss(
  dims: {
    pageW: number;
    pageH: number;
    labelW: number;
    labelH: number;
    padX: number;
    gap: number;
  },
  cols: 1 | 2,
  gapOverrideMm: number
): string {
  const { pageW, pageH, labelW, labelH, padX } = dims;
  const gapMm = cols === 2 ? (Number.isFinite(gapOverrideMm) ? gapOverrideMm : dims.gap) : 0;
  const sidePad = cols === 2 ? padX : (pageW - labelW) / 2;
  const padTop = THERMAL_QR_PAD_TOP_MM;
  const padBottom = THERMAL_QR_PAD_BOTTOM_MM;
  const qrMaxH = Math.max(5, labelH - padTop - padBottom);
  const qrMm = Math.min(THERMAL_QR_SIZE_MM, qrMaxH, labelW * 0.72);
  const maGap = 0.95;
  const maPullMm = 0;
  const maSizePx = 6.2;
  const maColor = '#111';
  const labelPadX = 0.18;
  const gridCols =
    cols === 2 ? `${labelW.toFixed(2)}mm ${labelW.toFixed(2)}mm` : `${labelW.toFixed(2)}mm`;

  return `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  :root {
    --print-scale: 1;
    --qr-size: ${qrMm.toFixed(2)}mm;
    --ma-gap: ${maGap}mm;
    --ma-pull: ${maPullMm}mm;
  }
  @page { size: ${THERMAL_PAGE_W_IN}in ${THERMAL_PAGE_H_IN}in; margin: 0; }
  @page thermal72x22 { size: ${THERMAL_PAGE_W_IN}in ${THERMAL_PAGE_H_IN}in; margin: 0; }
  html, body {
    width: ${pageW}mm;
    max-width: ${pageW}mm;
    margin: 0;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: ${maColor};
    -webkit-font-smoothing: none;
    font-smooth: never;
  }
  .print-hint {
    font-size: 12px;
    padding: 12px 16px;
    background: #f0fdf4;
    border-bottom: 1px solid #bbf7d0;
    color: #166534;
  }
  .print-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    padding: 10px 16px;
    background: #fffbeb;
    border-bottom: 1px solid #fcd34d;
    color: #78350f;
    font-size: 13px;
  }
  .print-toolbar .dens-hint { font-weight: 500; color: #92400e; flex: 1 1 180px; }
  .print-toolbar button {
    margin-left: auto;
    padding: 8px 16px;
    border: 0;
    border-radius: 8px;
    background: #166534;
    color: #fff;
    font-weight: 900;
    cursor: pointer;
  }
  .print-toolbar button:hover { background: #14532d; }
  .sheet {
    width: ${pageW}mm;
    max-width: ${pageW}mm;
    padding: 0;
    margin: 0;
    transform: none;
  }
  .row {
    box-sizing: border-box;
    page: thermal72x22;
    width: ${pageW}mm;
    min-width: ${pageW}mm;
    max-width: ${pageW}mm;
    height: ${pageH}mm;
    min-height: ${pageH}mm;
    max-height: ${pageH}mm;
    padding: 0 ${sidePad.toFixed(2)}mm;
    margin: 0;
    display: grid;
    grid-template-columns: ${gridCols};
    column-gap: ${gapMm.toFixed(2)}mm;
    align-items: stretch;
    justify-content: stretch;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
  }
  .row:last-child { page-break-after: auto; break-after: auto; }
  .label {
    box-sizing: border-box;
    position: relative;
    width: ${labelW.toFixed(2)}mm;
    min-width: ${labelW.toFixed(2)}mm;
    max-width: ${labelW.toFixed(2)}mm;
    height: ${labelH}mm;
    min-height: ${labelH}mm;
    max-height: ${labelH}mm;
    padding: ${padTop}mm ${labelPadX}mm ${padBottom}mm;
    margin: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
  .label.empty { visibility: hidden; }
  .label-inner {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: var(--ma-gap);
    width: 100%;
    max-width: 100%;
    height: 100%;
    margin: 0;
  }
  .qr {
    flex: 0 0 var(--qr-size);
    width: var(--qr-size);
    height: var(--qr-size);
    margin: 0;
    padding: 0;
    background: #fff;
    overflow: hidden;
  }
  .qr .qr-img,
  .qr img,
  .qr .qr-svg,
  .qr svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
    margin: 0;
    padding: 0;
    border: 0;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    -ms-interpolation-mode: nearest-neighbor;
  }
  .qr .qr-img {
    width: 100%;
    height: 100%;
  }
  .qr svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
    margin: 0;
    padding: 0;
    shape-rendering: crispEdges;
  }
  .qr-empty {
    display: flex; align-items: center; justify-content: center;
    font-size: 5px; font-weight: 500; border: 0.2mm solid #ccc; color: #999;
    width: 100%; height: 100%;
  }
  .ma {
    flex: 0 0 auto;
    width: auto;
    min-width: 0;
    max-width: calc(${labelW.toFixed(2)}mm - var(--qr-size) - ${labelPadX * 2}mm - 0.2mm);
    height: var(--qr-size);
    margin: 0 0 0 var(--ma-pull);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${maSizePx}px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: ${maColor};
    line-height: 1.05;
    overflow: hidden;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    -webkit-text-orientation: mixed;
    word-break: break-all;
    text-align: center;
    -webkit-font-smoothing: none;
    font-smooth: never;
    text-rendering: geometricPrecision;
  }
  .ma-err { font-size: 5px; color: #999; font-weight: 500; }
  @media print {
    .print-hint, .print-toolbar { display: none !important; }
    html, body {
      width: ${pageW}mm !important;
      max-width: ${pageW}mm !important;
      min-width: ${pageW}mm !important;
      height: auto !important;
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .sheet {
      width: ${pageW}mm !important;
      max-width: ${pageW}mm !important;
      transform: none !important;
    }
    .row {
      width: ${pageW}mm !important;
      height: ${pageH}mm !important;
      padding: 0 ${sidePad.toFixed(2)}mm !important;
      margin: 0 !important;
      display: grid !important;
      grid-template-columns: ${gridCols} !important;
      column-gap: ${gapMm.toFixed(2)}mm !important;
    }
    .label {
      width: ${labelW.toFixed(2)}mm !important;
      height: ${labelH}mm !important;
      padding: ${padTop}mm ${labelPadX}mm ${padBottom}mm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      position: relative !important;
    }
    .label-inner {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: var(--ma-gap) !important;
      width: 100% !important;
      margin: 0 !important;
    }
    .qr {
      flex: 0 0 var(--qr-size) !important;
      width: var(--qr-size) !important;
      height: var(--qr-size) !important;
      position: static !important;
    }
    .ma {
      position: static !important;
      left: auto !important;
      top: auto !important;
      flex: 0 0 auto !important;
      width: auto !important;
      height: var(--qr-size) !important;
      margin: 0 0 0 var(--ma-pull) !important;
      color: ${maColor} !important;
      font-weight: 700 !important;
      font-size: ${maSizePx}px !important;
      -webkit-font-smoothing: none !important;
      font-smooth: never !important;
      text-rendering: geometricPrecision !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
    }
    .qr .qr-img, .qr img, .qr svg {
      shape-rendering: crispEdges !important;
    }
  }
  @media screen {
    body { background: #e8e8e8; padding: 0 0 16px; width: auto; max-width: none; }
    .sheet { width: auto; max-width: none; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; margin: 16px; }
    .row {
      width: ${pageW}mm;
      background: #fff;
      page-break-after: auto;
      box-shadow: 0 1px 4px rgba(0,0,0,.12);
    }
  }
  `;
}

export async function printBarcodeLabels(
  products: Product[],
  options: PrintBarcodeLabelOptions = {}
): Promise<boolean> {
  const cols: 1 | 2 = options.columns === 1 ? 1 : 2;
  const gapRaw = Number(options.gapMm);
  const gapMm = Number.isFinite(gapRaw)
    ? Math.max(0, Math.min(6, gapRaw))
    : defaultThermalGapMm(options.size, cols);
  const dims = resolveDims({ ...options, columns: cols });
  const dim = sizeMm({ ...options, columns: cols });
  const copiesPerProduct = options.copiesPerProduct ?? 1;
  const autoPrint = options.autoPrint !== false;
  const { pageW, pageH } = dims;
  // Không await — PowerShell đăng stock có thể chậm vài giây
  void ensureThermalPrinterStock();

  const expanded: Product[] = [];
  (products || []).forEach((p) => {
    if (!p?.ma && !resolveBarcodeValue(p)) return;
    const n = Math.max(1, Math.min(99, Number(copiesPerProduct) || 1));
    for (let i = 0; i < n; i++) expanded.push(p);
  });

  if (expanded.length === 0) return false;

  const printable = expanded.filter((p) => resolveBarcodeValue(p) || String(p.ma || '').trim());
  if (printable.length === 0) {
    try {
      options.printWindow?.close();
    } catch {
      /* ignore */
    }
    alert('Sản phẩm chưa có mã sản phẩm, không thể in tem.');
    return false;
  }

  const qrBuilder = options.productUrlBuilder || thermalPosQrPayload;
  const useChrome =
    options.forceChromePrint === true || options.showPrintDialog !== false;

  /** Bước 1: TSPL thẳng máy — chỉ khi không bắt buộc hộp thoại in Chrome. */
  if (!useChrome) {
    void warmupThermalTspl();
    const tspl = await printThermalViaTspl(printable, {
      columns: cols,
      density: options.tsplDensity ?? 3,
      speed: options.tsplSpeed ?? 1,
    });
    if (tspl.ok) {
      try {
        options.printShell?.cleanup();
        options.printWindow?.close();
      } catch {
        /* ignore */
      }
      options.onPrintComplete?.({ method: 'tspl', count: printable.length });
      return true;
    }
    options.onPrintFailed?.(formatTsplError(tspl.error));
  }

  /** Bước 2: Chrome — tạo QR nền, mở thẳng hộp thoại in (không màn chờ). */
  const builder = qrBuilder;
  const uniqueForQr: Product[] = [];
  const seenMa = new Set<string>();
  for (const p of printable) {
    const key = String(p.ma || resolveBarcodeValue(p) || '');
    if (seenMa.has(key)) continue;
    seenMa.add(key);
    uniqueForQr.push(p);
  }

  let shell: BarcodePrintShell | null = null;
  try {
  const qrMap = await buildQrMap(uniqueForQr, builder);

  const rows = chunk(printable, cols);
  const style = buildCss(dims, cols, gapMm);

  const sheet = rows
    .map((row) => {
      const cells = row.map((p) => {
        const url = builder(p);
        return buildOneLabel(p, qrMap.get(url) || '');
      });
      while (cells.length < cols) cells.push('<div class="label empty"></div>');
      return `<div class="row">${cells.join('\n')}</div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>In tem nhiệt ${pageW}×${pageH}mm</title>
<style>${style}</style>
</head>
<body>
<div class="print-hint">
  Tem nhiệt <b>2 TEM</b> · QR = <b>mã SP</b> (máy bán hàng KiotViet ra đúng hàng) · ${printable.length} tem.<br/>
  Chrome: <b>2 TEM</b> · lề <b>Không</b> · tỉ lệ <b>100%</b>. Còn đậm/dính mực → giảm <b>Darkness</b> trong Tùy chọn in máy HPRT.
</div>
<div class="print-toolbar" id="printToolbar">
  <span class="dens-hint">TSPL đậm=3 · in chậm · QR nhạt chống lem. Vẫn đậm → giảm Darkness driver HPRT.</span>
  <button type="button" id="btnPrint">In tem</button>
</div>
<div class="sheet">${sheet}</div>
<script>
  function fitMa() {
    var list = document.querySelectorAll('.ma');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var f = parseFloat(window.getComputedStyle(el).fontSize) || 9;
      var guard = 0;
      while ((el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5) && f > 3.2 && guard < 20) {
        f -= 0.25;
        el.style.fontSize = f + 'px';
        guard++;
      }
    }
  }
  function goPrint() {
    try { window.focus(); } catch (e) {}
    try { window.print(); } catch (e2) {}
  }
  function whenReady() {
    fitMa();
    var btn = document.getElementById('btnPrint');
    if (btn) btn.addEventListener('click', goPrint);
    ${autoPrint ? 'goPrint();' : ''}
  }
  if (document.readyState === 'complete') whenReady();
  else window.addEventListener('DOMContentLoaded', whenReady);
</script>
</body>
</html>`;

  shell =
    options.printShell ||
    (options.printWindow && !options.printWindow.closed
      ? {
          win: options.printWindow,
          isIframe: false,
          writeHtml: (htmlDoc: string) => {
            try {
              options.printWindow!.document.open();
              options.printWindow!.document.write(htmlDoc);
              options.printWindow!.document.close();
              return;
            } catch {
              /* fallback */
            }
            try {
              const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              options.printWindow!.location.replace(url);
              setTimeout(() => URL.revokeObjectURL(url), 120_000);
            } catch {
              /* ignore */
            }
          },
          cleanup: () => {},
        }
      : openBarcodePrintShell('auto', { skipLoading: true, hidden: !isMobilePrintClient() }));
  if (!shell) return false;

  try {
    if (!shell.isIframe && shell.win.closed) {
      shell.cleanup();
      return false;
    }
  } catch {
    /* iframe */
  }

  shell.writeHtml(html);
  if (shell.isIframe) {
    try {
      shell.win.addEventListener?.('afterprint', () => setTimeout(() => shell!.cleanup(), 800));
    } catch {
      /* ignore */
    }
    setTimeout(() => shell!.cleanup(), 180_000);
  }
  options.onPrintComplete?.({ method: 'chrome', count: printable.length });
  return true;
  } catch (e) {
    try {
      shell?.cleanup();
      options.printWindow?.close();
    } catch {
      /* ignore */
    }
    options.onPrintFailed?.(
      e instanceof Error ? e.message : 'Không tạo được bản in Chrome.'
    );
    return false;
  }
}
