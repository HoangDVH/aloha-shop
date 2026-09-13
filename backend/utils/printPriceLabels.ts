/**
 * In tem giá ALOHA — bám ảnh mẫu gốc.
 * Logo nhúng 1 lần; QR PNG nét (in rõ); đường cắt cách viền tem.
 * Số đỏ lớn = giá bán (không in giá vốn lên tem khách).
 */
import QRCode from 'qrcode';
import type { Product } from '../services/database';
import { formatVndDot } from './helpers';
import { thermalPosQrPayload } from './printBarcodeLabels';

/**
 * an-toan = lề đủ cho máy in thường (không bị che mép) — mặc định.
 * thoang = lề + khe cắt rộng hơn (cắt tay dễ).
 * sat-mep = cũ, lề hẹp — dễ bị máy in cắt mép (chỉ dùng khi cần).
 */
export type LabelLayoutMode = 'an-toan' | 'thoang' | 'sat-mep';

export interface PrintPriceLabelOptions {
  copiesPerProduct?: number;
  showBarcode?: boolean;
  autoPrint?: boolean;
  /** Mặc định an-toan: 3×7, lề ~6mm, máy in không che chữ/QR. */
  layout?: LabelLayoutMode;
  productUrlBuilder?: (p: Product) => string;
  /** Gọi khi đang chuẩn bị (vd. hiện toast %). */
  onProgress?: (done: number, total: number) => void;
  /**
   * Khung in đã mở ngay trong cú chạm (tránh chặn popup ĐT).
   * Gọi `openPricePrintShell()` trước khi await.
   */
  printShell?: PricePrintShell | null;
}

export type PricePrintShell = {
  win: Window;
  /** Ghi HTML chuẩn bị / bản in vào khung */
  writeHtml: (html: string) => void;
  /** Gỡ iframe (nếu có) sau khi in */
  cleanup: () => void;
  /** true = iframe full màn (ĐT), false = tab/popup */
  isIframe: boolean;
};

function isMobilePrintClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

/**
 * Mở khung in NGAY trong cú chạm nút.
 * prefer: 'pc' = tab/popup (máy tính), 'phone' = iframe full màn (ĐT), 'auto' = đoán theo thiết bị.
 */
export function openPricePrintShell(prefer: 'auto' | 'pc' | 'phone' = 'auto'): PricePrintShell | null {
  const loadingHtml = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuẩn bị in tem…</title>
<style>
  body{font-family:Arial,sans-serif;padding:28px;background:#F7F3EA;color:#333;margin:0}
  h2{color:#1b5e20;margin:0 0 8px;font-size:18px}
  p{font-size:14px;line-height:1.45;margin:0 0 8px}
  .bar{height:6px;background:#c8e6c9;border-radius:99px;overflow:hidden;max-width:320px;margin-top:14px}
  .bar>i{display:block;height:100%;width:30%;background:linear-gradient(90deg,#43a047,#1e88e5);
    animation:s 1s ease-in-out infinite;border-radius:99px}
  @keyframes s{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}
</style></head><body>
  <h2>Đang chuẩn bị tem A4…</h2>
  <p>Tạo mã QR trên máy. Hộp thoại in sẽ hiện khi xong — chọn máy in hoặc Lưu PDF.</p>
  <div class="bar"><i></i></div>
  <p id="pg" style="font-size:13px;color:#558b2f;margin-top:10px"></p>
</body></html>`;

  const wantPhone =
    prefer === 'phone' || (prefer === 'auto' && isMobilePrintClient());

  const makeWindowShell = (w: Window): PricePrintShell => ({
    win: w,
    isIframe: false,
    writeHtml: (html: string) => {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        w.location.replace(url);
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } catch {
        try {
          w.document.open();
          w.document.write(html);
          w.document.close();
        } catch {
          /* bỏ qua */
        }
      }
    },
    cleanup: () => {},
  });

  const makeIframeShell = (): PricePrintShell | null => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'In tem A4 ALOHA');
    iframe.setAttribute('name', 'aloha-price-print-frame');
    iframe.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:2147483646;border:0;background:#fff;';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return null;
    }
    try {
      win.document.open();
      win.document.write(loadingHtml);
      win.document.close();
    } catch {
      iframe.remove();
      return null;
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
          console.warn('[printPriceLabels] ghi iframe:', e);
        }
      },
      cleanup: () => {
        try {
          iframe.remove();
        } catch {
          /* bỏ qua */
        }
      },
    };
  };

  if (!wantPhone) {
    const w = window.open('', '_blank');
    if (w) {
      try {
        w.document.write(loadingHtml);
        w.document.close();
      } catch {
        /* bỏ qua */
      }
      return makeWindowShell(w);
    }
    // Bị chặn popup → vẫn fallback iframe
  }

  return makeIframeShell();
}

/** Thông số lưới A4 — luôn 3 cột × 7 dòng = 21 tem/mặt. */
function layoutMetrics(mode: LabelLayoutMode) {
  if (mode === 'sat-mep') {
    // Cũ — lề 1mm: nhiều máy in cắt mất mép trên/dưới/trái/phải
    return {
      pageMarginMm: 1,
      colMm: 69.333,
      rowMm: 42.14,
      cutPadMm: 1.35,
      hintCut: '~1.3mm',
    };
  }
  if (mode === 'thoang') {
    // Lề 8mm + khe cắt 2.1mm — vẫn 3×7 nhưng lùi khỏi mép giấy thêm 1mm mỗi phía
    return {
      pageMarginMm: 8,
      colMm: 64.667, // (210 − 2×8) / 3
      rowMm: 40.143, // (297 − 2×8) / 7
      cutPadMm: 2.1,
      hintCut: '~2.1mm',
    };
  }
  // an-toan (mặc định): lề 6mm trong vùng in được của hầu hết máy phun/laser
  return {
    pageMarginMm: 6,
    colMm: 66, // (210 − 2×6) / 3
    rowMm: 40.714, // (297 − 2×6) / 7
    cutPadMm: 1.8,
    hintCut: '~1.8mm',
  };
}

/** Một màu vàng duy nhất cho logo + viền (tránh “hai màu”) */
const GOLD = '#c9a227';
const RED = '#e30613';
/** Nền kem như ảnh mẫu gốc (không dùng trắng tinh) */
const BG = '#f7f3e8';

const fmt = (n: number) => formatVndDot(n);
const siRutGon = (n: number) => formatVndDot(Math.round((n || 0) / 1000));

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Nội dung QR tem A4 = mã SP thuần (POS quét ra mã). Nút quét app tự gắn link nội bộ. */
function defaultProductUrl(p: Product): string {
  return thermalPosQrPayload(p) || String(p.ma || '').trim().toUpperCase();
}

export function estimateLabelPages(productCount: number, copiesPerProduct = 1): number {
  const total = Math.max(0, productCount) * Math.max(1, copiesPerProduct);
  // A4: 3 cột x 7 hàng = 21 tem / trang
  return Math.max(1, Math.ceil(total / 21));
}

export function countMissingSalePrice(products: Product[]): number {
  return products.filter((p) => !(p.giaVon > 0) && !(p.giaSi && p.giaSi > 0)).length;
}

/** QR PNG độ phân giải cao — in máy phun không bị xám/mờ như SVG nhỏ. */
async function buildQrPngMap(
  products: Product[],
  opts: PrintPriceLabelOptions
): Promise<Map<string, string>> {
  const builder = opts.productUrlBuilder || defaultProductUrl;
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
  const total = urls.length;
  let done = 0;
  const CONCURRENCY = 32;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const dataUrl = await QRCode.toDataURL(url, {
            width: 280,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          });
          out.set(url, dataUrl);
        } catch {
          out.set(
            url,
            'data:image/svg+xml,' +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280"><rect width="280" height="280" fill="#fff"/><text x="140" y="150" text-anchor="middle" font-size="32" fill="#000">QR</text></svg>`
              )
          );
        }
        done += 1;
        opts.onProgress?.(done, total);
      })
    );
    if (i + CONCURRENCY < urls.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return out;
}

const TEXT_LOGO_HTML = `<div class="tem-logo-row" style="display:flex;">
  <div class="tem-brand">
    <div class="tem-aloha">ALOHA</div>
    <div class="tem-slogan">
      <i class="line"></i>
      <span>THẾ GIỚI CHẬU CÂY</span>
      <i class="line"></i>
    </div>
  </div>
</div>`;

/** Logo header nhúng 1 lần (data URL) — in nhiều tem vẫn có logo, không mất vì blob: */
let logoHeaderDataUrlCache: string | null | undefined;

async function loadLogoHeaderDataUrl(origin: string): Promise<string> {
  if (logoHeaderDataUrlCache !== undefined) return logoHeaderDataUrlCache || '';
  const base = (origin || '').replace(/\/$/, '');
  if (!base || typeof fetch === 'undefined') {
    logoHeaderDataUrlCache = '';
    return '';
  }
  try {
    const res = await fetch(`${base}/logo-tem-header.png?v=10`);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    logoHeaderDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    logoHeaderDataUrlCache = '';
    return '';
  }
}

function buildLabelHtml(
  p: Product,
  opts: PrintPriceLabelOptions,
  qrDataUrl = '',
  hasEmbeddedLogo = false
): string {
  // Số đỏ = bảng giá chung (giá bán tem). Không lấy giá web làm số đỏ — nếu không sẽ mất «GIÁ GỐC».
  const giaChung = Number((p as any).giaChung) > 0 ? Number((p as any).giaChung) : 0;
  const giaBanField = Number(p.giaBan) > 0 ? Number(p.giaBan) : 0;
  const giaWeb = Number(p.giaWeb) > 0 ? Number(p.giaWeb) : 0;
  const giaBanDo = giaChung || giaBanField || giaWeb || 0;
  // GIÁ GỐC = giá web (gạch ngang) khi cao hơn giá bán trên tem
  const giaGoc = giaWeb > 0 && giaWeb > giaBanDo ? giaWeb : 0;
  const giaSi = Number(p.giaSi) > 0 ? Number(p.giaSi) : giaBanDo;
  const tenRaw = String(p.ten || p.ma || '').toUpperCase();
  const ten = escapeHtml(tenRaw);
  const ma = escapeHtml(p.ma || '');
  const dvt = escapeHtml(p.dvt || 'Cái');
  const barcode = escapeHtml((p.barcode || '').trim());
  void barcode;
  void opts;

  const tenLen = tenRaw.replace(/\s+/g, ' ').trim().length;
  const giaDigits = String(Math.round(Math.abs(giaBanDo) || 0)).length;
  const temClass = [
    'tem',
    tenLen > 45 ? 'tem-ten-rat-dai' : tenLen > 28 ? 'tem-ten-dai' : '',
    giaDigits >= 8 ? 'tem-gia-rat-lon' : giaDigits >= 6 ? 'tem-gia-lon' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Logo ảnh nhúng 1 lần trong CSS (mọi tem). Không có ảnh → chữ vàng.
  const headerHtml = hasEmbeddedLogo
    ? `<div class="tem-logo-full tem-logo-full-bg" role="img" aria-label="ALOHA"></div>`
    : TEXT_LOGO_HTML;

  const qrBlock = qrDataUrl
    ? `<img class="tem-qr" src="${qrDataUrl}" alt="QR" width="280" height="280" />`
    : `<div class="tem-qr tem-qr-empty"></div>`;

  return `
    <div class="${temClass}">
      <div class="tem-header">
        <div class="tem-header-inner">${headerHtml}</div>
        <div class="tem-header-rule" aria-hidden="true"></div>
      </div>

      <div class="tem-ten-box">
        <div class="tem-ten-wrap">
          <div class="tem-ten-label">TÊN SẢN PHẨM:</div>
          <div class="tem-ten">${ten}</div>
        </div>
      </div>

      <div class="tem-body">
        <div class="tem-left">
          <div class="tem-price-col">
            ${
              giaGoc > 0
                ? `<div class="tem-gia-goc-line">
              <span class="lab">GIÁ GỐC:</span>
              <span class="gia-goc">${fmt(giaGoc)} đ</span>
            </div>`
                : ''
            }
            <div class="tem-gia-do"><span class="so">${fmt(giaBanDo)}</span><span class="d">đ</span></div>
          </div>
          <div class="tem-footer">
            <span class="ft-si">S.${siRutGon(giaSi)}</span>
            <span class="ft-dvt">ĐVT: ${dvt}</span>
            <span class="ft-spacer" aria-hidden="true"></span>
          </div>
        </div>
        <div class="tem-qr-box">
          ${qrBlock}
          <div class="tem-ma-qr">MÃ SP: ${ma}</div>
        </div>
      </div>
    </div>
  `;
}

function buildLabelCss(mode: LabelLayoutMode): string {
  const m = layoutMetrics(mode);
  const sheetW = (3 * m.colMm).toFixed(3);
  return `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; margin: 0; padding: 0; }
  @media print {
    /* Lề trang theo chế độ — hộp thoại in nên chọn Lề = Tối thiểu / Không */
    @page { size: A4 portrait; margin: ${m.pageMarginMm}mm; }
    html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
    .print-hint { display: none !important; }
    .sheet {
      width: ${sheetW}mm !important;
      height: calc(7 * var(--row)) !important;
      min-height: calc(7 * var(--row)) !important;
      max-width: 100% !important;
      margin: 0 !important;
      page-break-after: always;
      break-after: page;
    }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .cut-guides { display: block !important; }
    .cut-guides line { stroke: #111 !important; stroke-width: 0.9 !important; }
    .tem-cell {
      border-color: #111 !important;
    }
    /* Viền tem: khi in đen trắng, vàng dễ mất → ép đen */
    .tem,
    .tem-ten-box,
    .tem-left,
    .tem-price-col {
      border-color: #111 !important;
    }
    .tem-header-rule {
      /* Nhẹ hơn viền ngoài — không in đậm như khung tem */
      height: 0.7pt !important;
      background: #666 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .tem-qr {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
  body {
    font-family: "Segoe UI", Arial, Helvetica, "Helvetica Neue", sans-serif;
    margin: 0; padding: 8px; background: #e8e8e8;
    -webkit-font-smoothing: antialiased;
  }
  .print-hint {
    max-width: 20cm; margin: 0 auto 8px; padding: 8px 12px;
    background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px;
    font-size: 12px; color: #5d4037; line-height: 1.45;
  }
  .print-hint b { color: #333; }
  /* A4 in được: lề ngoài do @page; lưới 3×7 cố định — in 1 tem vẫn cùng khổ ô */
  .sheet {
    --col: ${m.colMm}mm;
    --row: ${m.rowMm}mm;
    --cut-pad: ${m.cutPadMm}mm;
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, var(--col));
    grid-template-rows: repeat(7, var(--row));
    grid-auto-rows: var(--row);
    gap: 0;
    width: calc(3 * var(--col));
    height: calc(7 * var(--row));
    min-height: calc(7 * var(--row));
    margin: 0 auto 12px;
    background: #fff;
  }
  /* Đường cắt SVG — máy in luôn in stroke (không như nền CSS) */
  .cut-guides {
    position: absolute;
    left: 0; top: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 30;
    overflow: visible;
  }
  .cut-guides line {
    stroke: #333;
    stroke-width: 0.75;
    stroke-dasharray: 2.2 1.6;
    vector-effect: non-scaling-stroke;
  }
  .tem-cell {
    width: var(--col);
    height: var(--row);
    /* Khe giữa đường cắt và viền vàng — đủ cắt, không phí giấy */
    padding: var(--cut-pad);
    overflow: hidden;
    /* Viền đứt đoạn 4 cạnh (dự phòng SVG) — mép ngoài cũng có đường cắt */
    border: 0.7pt dashed #444;
  }
  /* Tránh đường đôi giữa các ô: bỏ viền trùng cạnh trong */
  .tem-cell + .tem-cell { border-left: none; }
  .tem-cell:nth-child(3n+1) { border-left: 0.7pt dashed #444; }
  .tem-cell:nth-child(n+4) { border-top: none; }
  /* Ô pad — giữ chỗ lưới, không in khung tem */
  .tem-cell--empty {
    border: none !important;
    padding: 0;
    visibility: hidden;
    pointer-events: none;
  }
  @media print {
    .tem-cell--empty {
      border: none !important;
      visibility: hidden !important;
    }
  }
  .tem {
    width: 100%; height: 100%;
    border: 1.8px solid ${GOLD};
    background: ${BG};
    display: grid;
    /* Header + tên SP cao hơn — tránh cắt dấu / dòng cuối */
    grid-template-rows: 0.54cm 1.34cm minmax(0, 1fr);
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .tem-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    border-bottom: none;
    padding: 0;
    background: ${BG};
    min-height: 0;
    overflow: hidden;
  }
  .tem-header-inner {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 3px 1px;
    overflow: hidden;
  }
  /* Thanh kẻ dưới logo — mảnh, không đậm bằng viền khung */
  .tem-header-rule {
    flex: 0 0 auto;
    height: 0.9px;
    width: 100%;
    margin: 0;
    padding: 0;
    background: ${GOLD};
    opacity: 0.85;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .tem-logo-full {
    height: 0.48cm; width: auto; max-width: 96%;
    max-height: 0.48cm;
    object-fit: contain; object-position: center;
    display: block;
  }
  .tem-logo-full-bg {
    width: 96%;
    height: 0.48cm;
    max-height: 0.48cm;
    margin: 0 auto;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }
  .tem-logo-row {
    display: flex;
    align-items: center; justify-content: center; gap: 4px; width: 100%;
    padding: 1px 0;
  }
  .tem-chau {
    height: 0.5cm; width: auto; flex-shrink: 0;
    object-fit: contain;
  }
  .tem-brand {
    display: flex; flex-direction: column; align-items: center;
    padding-top: 1px;
  }
  .tem-aloha {
    font-size: 12px; font-weight: 800; letter-spacing: 0.8px;
    color: ${GOLD} !important;
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.15;
    padding-top: 1px;
  }
  .tem-slogan {
    display: flex; align-items: center; gap: 4px;
    margin-top: 1px;
    font-size: 6px; font-weight: 800; letter-spacing: 0.4px;
    color: ${GOLD} !important;
  }
  .tem-slogan span { color: ${GOLD} !important; }
  .tem-slogan .line {
    display: inline-block; width: 24px; height: 1px;
    background: ${GOLD} !important;
    font-style: normal;
  }

  .tem-ten-box {
    border-bottom: 1.8px solid ${GOLD};
    padding: 2px 4px 3px;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    min-height: 0;
    overflow: hidden;
  }
  .tem-ten-wrap {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .tem-ten-label {
    font-size: 6.5px; font-weight: 800; color: #111;
    text-align: left; flex-shrink: 0;
    line-height: 1.2;
    padding: 0;
    margin: 0 0 1.5px;
    width: 100%;
    letter-spacing: 0.2px;
  }
  .tem-ten {
    font-size: 14.5px; font-weight: 800; color: #111;
    text-transform: uppercase;
    line-height: 1.22;
    letter-spacing: 0.15px;
    text-align: left;
    margin: 0;
    padding: 1px 0 1px;
    overflow: hidden;
    flex: 1;
    min-height: 0;
    word-break: break-word;
    overflow-wrap: anywhere;
    width: 100%;
    display: block;
  }
  .tem-ten-dai .tem-ten {
    font-size: 12.5px;
    line-height: 1.2;
  }
  .tem-ten-rat-dai .tem-ten {
    font-size: 11px;
    line-height: 1.18;
  }
  body.bulk .tem-ten { font-size: 14px; }
  body.bulk .tem-ten-dai .tem-ten { font-size: 12px; }
  body.bulk .tem-ten-rat-dai .tem-ten { font-size: 10.5px; }

  .tem-body {
    display: grid;
    grid-template-columns: 1.35fr 1.35fr;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .tem-left {
    display: grid;
    grid-template-rows: minmax(0, 1fr) 0.5cm;
    border-right: 1.8px solid ${GOLD};
    min-height: 0; min-width: 0;
    height: 100%;
    overflow: hidden;
  }
  .tem-price-col {
    padding: 2px 3px 2px 4px;
    display: flex; flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 1px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-bottom: 1.8px solid ${GOLD};
  }
  .tem-gia-goc-line {
    display: flex; align-items: baseline; gap: 3px; flex-wrap: wrap;
    line-height: 1.05;
    flex-shrink: 0;
    max-width: 100%;
    overflow: hidden;
  }
  .tem-gia-goc-line .lab {
    font-size: 8px; font-weight: 800; color: #111;
  }
  .tem-gia-goc-line .gia-goc {
    position: relative;
    font-size: 10px; font-weight: 800; color: #111;
    display: inline-block;
  }
  .tem-gia-goc-line .gia-goc::after {
    content: '';
    position: absolute; left: -1px; right: -1px; top: 50%;
    height: 1.6px; background: ${RED};
    transform: translateY(-50%);
  }
  .tem-gia-do {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    font-size: 25.5px; font-weight: 800; color: ${RED};
    line-height: 1.08;
    letter-spacing: -0.25px;
    white-space: nowrap;
    max-width: 100%;
    overflow: visible;
    flex-shrink: 1;
    min-width: 0;
    padding: 1px 0;
  }
  /* Số dài: CSS mặc định nhỏ hơn; JS fitTrongKhung còn thu thêm nếu cần */
  .tem-gia-lon .tem-gia-do { font-size: 19px; letter-spacing: -0.4px; }
  .tem-gia-rat-lon .tem-gia-do { font-size: 15px; letter-spacing: -0.5px; }
  body.bulk .tem-gia-do { font-size: 24px; }
  body.bulk .tem-gia-lon .tem-gia-do { font-size: 18px; }
  body.bulk .tem-gia-rat-lon .tem-gia-do { font-size: 14.5px; }
  .tem-gia-do .so {
    color: ${RED};
    font-weight: 900;
    line-height: 1;
  }
  .tem-gia-do .d {
    color: ${RED} !important;
    font-size: 0.55em;
    font-weight: 900;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }

  .tem-qr-box {
    display: flex; flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3px 3px 2px;
    text-align: center;
    background: ${BG};
    min-height: 0;
    height: 100%;
    gap: 1px;
    overflow: hidden;
  }
  .tem-qr {
    width: 1.68cm; height: 1.68cm;
    max-width: 96%;
    max-height: calc(100% - 0.28cm);
    border: none;
    background: #fff;
    padding: 0;
    object-fit: contain;
    flex: 0 1 auto;
    margin: 0 auto;
    display: block;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }
  .tem-qr-empty {
    background: #fff;
    border: 1px solid #ccc;
  }
  .tem-ma-qr {
    font-size: 5.5px;
    font-weight: 800;
    color: #111;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.2px;
    margin: 0;
    padding: 0 1px 2px;
    flex: 0 0 auto;
    text-align: center;
  }

  .tem-footer {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2px;
    padding: 2px 3px 3px;
    font-size: 8.5px; font-weight: 800; color: #111;
    background: ${BG};
    min-height: 0.5cm;
    height: 0.5cm;
    overflow: hidden;
    position: relative;
    z-index: 2;
    line-height: 1.2;
  }
  .tem-footer .ft-si { white-space: nowrap; justify-self: start; font-size: 9px; letter-spacing: 0.15px; overflow: hidden; text-overflow: ellipsis; max-width: 100%; line-height: 1.2; }
  .tem-footer .ft-dvt { white-space: nowrap; justify-self: center; text-align: center; font-size: 9px; overflow: hidden; text-overflow: ellipsis; max-width: 100%; line-height: 1.2; }
  .tem-footer .ft-spacer { justify-self: end; width: 0; height: 0; overflow: hidden; }
`;
}

/** Vẽ đường cắt ngang/dọc — luôn lưới 3×7 (kích thước tem cố định dù in 1 hay 21 tem). */
function buildCutGuidesSvg(): string {
  const cols = 3;
  const rows = 7;
  const lines: string[] = [];
  // Kéo nét ngoài cùng vào nhẹ để máy in không ăn mất mép trái/phải/trên/dưới.
  const edgeInsetPct = 0.18;
  const edgeStart = edgeInsetPct.toFixed(3);
  const edgeEnd = (100 - edgeInsetPct).toFixed(3);
  // Dọc: mép trái + giữa cột + mép phải
  for (let c = 0; c <= cols; c++) {
    const x =
      c === 0 ? edgeStart : c === cols ? edgeEnd : ((c / cols) * 100).toFixed(4);
    lines.push(`<line x1="${x}%" y1="${edgeStart}%" x2="${x}%" y2="${edgeEnd}%"/>`);
  }
  // Ngang: mép trên + giữa hàng + mép dưới
  for (let r = 0; r <= rows; r++) {
    const y =
      r === 0 ? edgeStart : r === rows ? edgeEnd : ((r / rows) * 100).toFixed(4);
    lines.push(`<line x1="${edgeStart}%" y1="${y}%" x2="${edgeEnd}%" y2="${y}%"/>`);
  }
  return `<svg class="cut-guides" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`;
}

/** Cache QR PNG trong phiên — in lại cùng mã khỏi tạo lại. */
const qrPngSessionCache = new Map<string, string>();

export async function buildPriceLabelsDocument(
  products: Product[],
  options: PrintPriceLabelOptions = {}
): Promise<string> {
  if (!products.length) return '';

  const copies = Math.max(1, Math.min(50, options.copiesPerProduct ?? 1));
  const expanded: Product[] = [];
  products.forEach((p) => {
    for (let i = 0; i < copies; i++) expanded.push(p);
  });

  const bulkMode = expanded.length >= 12;

  // Tem A4: QR = mã SP thuần (vd. HD1) — POS và mọi loại tem cùng chuẩn.
  // App quét → tự gắn link nội bộ store.?sp=MÃ.
  const builder = options.productUrlBuilder || defaultProductUrl;
  const needQr: Product[] = [];
  const needSeen = new Set<string>();
  for (const p of products) {
    const u = builder(p);
    if (qrPngSessionCache.has(u) || needSeen.has(u)) continue;
    needSeen.add(u);
    needQr.push(p);
  }

  // Logo + QR chạy song song — không chờ logo xong mới tạo QR
  const assetOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const logoPromise = loadLogoHeaderDataUrl(assetOrigin);
  const qrPromise = needQr.length
    ? buildQrPngMap(needQr, {
        ...options,
        // Phải cùng builder với lúc gắn ảnh — nếu không, cache key /p/token ≠ ?sp=MÃ → tem trống QR.
        productUrlBuilder: builder,
        onProgress: (done, total) => options.onProgress?.(done, total),
      }).then((fresh) => {
        fresh.forEach((png, url) => qrPngSessionCache.set(url, png));
      })
    : Promise.resolve().then(() => options.onProgress?.(1, 1));

  const [logoDataUrl] = await Promise.all([logoPromise, qrPromise]);
  const hasEmbeddedLogo = Boolean(logoDataUrl);
  const logoCss = hasEmbeddedLogo
    ? `.tem-logo-full-bg{background-image:url("${logoDataUrl}");}`
    : '';

  const cellCache = new Map<string, string>();
  const labelsParts: string[] = new Array(expanded.length);
  for (let i = 0; i < expanded.length; i++) {
    const p = expanded[i];
    const cacheKey = `${p.ma}|${p.ten}|${p.giaBan}|${p.giaWeb}|${p.giaSi}|${p.dvt}|${p.barcode || ''}`;
    let cell = cellCache.get(cacheKey);
    if (!cell) {
      const qr = qrPngSessionCache.get(builder(p)) || '';
      cell = `<div class="tem-cell">${buildLabelHtml(p, options, qr, hasEmbeddedLogo)}</div>`;
      cellCache.set(cacheKey, cell);
    }
    labelsParts[i] = cell;
  }
  const labelsHtml = labelsParts.join('');
  const pages = estimateLabelPages(products.length, copies);
  const missing = countMissingSalePrice(products);
  // Lề ngoài thực tế của nhiều máy in lớn hơn cấu hình trong Chrome,
  // nên dùng layout thoáng để không mất mép trên/dưới/trái/phải.
  const layout: LabelLayoutMode = 'thoang';
  const metrics = layoutMetrics(layout);
  const PER_PAGE = 21;
  const emptyCell = '<div class="tem-cell tem-cell--empty" aria-hidden="true"></div>';
  const sheetChunks: string[] = [];
  for (let i = 0; i < labelsParts.length; i += PER_PAGE) {
    const chunk = labelsParts.slice(i, i + PER_PAGE);
    // Luôn đủ 21 ô — tem thứ 2…21 để trống, giữ khổ ô giống in full trang (tránh Chrome phóng to 1 tem)
    const padded = [...chunk];
    while (padded.length < PER_PAGE) padded.push(emptyCell);
    const cutGuides = buildCutGuidesSvg();
    sheetChunks.push(`<div class="sheet">${cutGuides}${padded.join('')}</div>`);
  }
  const sheetsHtml = sheetChunks.join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>In Tem Sản Phẩm — ALOHA</title>
  <style>${buildLabelCss(layout)}
${logoCss}</style>
</head>
<body class="${bulkMode ? 'bulk' : ''}">
  <div class="print-hint">
    ${expanded.length} tem · ~${pages} trang A4 · <b>3 cột × 7 dòng = 21 tem/mặt</b>.
    In tỷ lệ <b>100%</b> · lề máy in chọn <b>Mặc định</b> hoặc <b>Tối thiểu</b> · <b>không</b> chọn “Vừa khít trang / Fit”.
    <br/>✂️ Đường cắt cách viền vàng ${metrics.hintCut} — dễ cắt thẳng theo nét đứt.
    <br/>📱 Điện thoại: chọn <b>máy in Wi‑Fi / AirPrint</b> hoặc <b>Lưu PDF</b> trong hộp thoại in.
    <br/>📱 QR mở sản phẩm trên <b>store.alohathegioichaucay.com</b> (link ?sp=MÃ).
    ${missing > 0 ? `<br/>⚠ ${missing} SP thiếu giá vốn/giá sỉ — tem vẫn in.` : ''}
  </div>
  ${sheetsHtml}
  <script>
    var soTem = ${expanded.length};
    var inNhanh = ${bulkMode ? 'true' : 'false'};
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    function fitTenSanPham() {
      var list = document.querySelectorAll('.tem-ten');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        var box = el.closest('.tem-ten-box');
        if (!box) continue;
        var label = box.querySelector('.tem-ten-label');
        var maxH = Math.max(10, box.clientHeight - 4);
        if (label) maxH -= label.offsetHeight + 2;
        el.style.display = 'block';
        el.style.webkitLineClamp = 'unset';
        el.style.lineClamp = 'unset';
        el.style.overflow = 'hidden';
        var fSize = parseFloat(window.getComputedStyle(el).fontSize) || 14.5;
        var guard = 0;
        while (el.scrollHeight > maxH && fSize > 9 && guard < 44) {
          fSize -= 0.35;
          el.style.fontSize = fSize + 'px';
          el.style.lineHeight = '1.2';
          guard++;
        }
        if (el.scrollHeight > maxH) {
          var lh = parseFloat(window.getComputedStyle(el).lineHeight) || fSize * 1.16;
          var lines = Math.max(1, Math.floor(maxH / lh));
          el.style.display = '-webkit-box';
          el.style.webkitBoxOrient = 'vertical';
          el.style.webkitLineClamp = String(lines);
          el.style.lineClamp = String(lines);
        }
      }
    }
    function fitTrongKhung() {
      var list = document.querySelectorAll('.tem');
      for (var i = 0; i < list.length; i++) {
        var tem = list[i];
        var col = tem.querySelector('.tem-price-col');
        var gia = tem.querySelector('.tem-gia-do');
        var gocLine = tem.querySelector('.tem-gia-goc-line');
        if (col && gia) {
          var gocH = gocLine ? (gocLine.offsetHeight + 2) : 0;
          var maxW = Math.max(24, col.clientWidth - 5);
          var maxHg = Math.max(14, col.clientHeight - gocH - 4);
          var gSize = parseFloat(window.getComputedStyle(gia).fontSize) || 25.5;
          var guard2 = 0;
          // Thu dần khi số quá dài — không cắt mất chữ đầu/đuôi
          while ((gia.scrollWidth > maxW || gia.scrollHeight > maxHg) && gSize > 8.5 && guard2 < 48) {
            gSize -= 0.55;
            gia.style.fontSize = gSize + 'px';
            gia.style.lineHeight = '1.05';
            gia.style.letterSpacing = (gSize < 14 ? -0.6 : gSize < 18 ? -0.35 : -0.2) + 'px';
            guard2++;
          }
        }
      }
    }
    function batDauIn() {
      fitTenSanPham();
      fitTrongKhung();
      ${
        options.autoPrint === false
          ? ''
          : `function goPrint(){
        setTimeout(function(){
          try { window.focus(); } catch (e) {}
          try { window.print(); } catch (e2) {}
        }, inNhanh ? (isMobile ? 220 : 60) : (isMobile ? 350 : 180));
      }
      var imgs = Array.prototype.slice.call(document.querySelectorAll('img.tem-qr'));
      var left = imgs.length;
      if (!left) { goPrint(); return; }
      var done = false;
      function one(){
        left--;
        if (left <= 0 && !done) { done = true; goPrint(); }
      }
      imgs.forEach(function(img){
        if (img.complete) one();
        else { img.onload = one; img.onerror = one; }
      });
      setTimeout(function(){ if (!done) { done = true; goPrint(); } }, isMobile ? 3500 : 2000);`
      }
    }
    if (document.readyState === 'complete') batDauIn();
    else window.addEventListener('DOMContentLoaded', batDauIn);
  </script>
</body>
</html>`;
}

/**
 * Mở khung in ngay (tránh chặn popup), hiện “Đang chuẩn bị…”, rồi đổ tem.
 * Điện thoại: dùng iframe full màn → hộp thoại in (AirPrint / Wi‑Fi / Lưu PDF).
 */
export async function printPriceLabels(
  products: Product[],
  options: PrintPriceLabelOptions = {}
): Promise<boolean> {
  if (!products.length) return false;

  const copies = Math.max(1, Math.min(50, options.copiesPerProduct ?? 1));
  const totalTem = products.length * copies;

  // Mở khung TRƯỚC khi await — nếu không trình duyệt (nhất là ĐT) chặn in
  const shell = options.printShell || openPricePrintShell();
  if (!shell) return false;

  try {
    const el = shell.win.document.getElementById('pg');
    if (el) el.textContent = `Chuẩn bị ${totalTem} tem…`;
  } catch {
    /* bỏ qua */
  }

  try {
    const html = await buildPriceLabelsDocument(products, {
      ...options,
      onProgress: (done, total) => {
        options.onProgress?.(done, total);
        try {
          const el = shell.win.document.getElementById('pg');
          if (el) el.textContent = `QR ${done}/${total} mã…`;
        } catch {
          /* cửa sổ đã đóng */
        }
      },
    });
    try {
      if (!shell.isIframe && shell.win.closed) {
        shell.cleanup();
        return false;
      }
    } catch {
      /* iframe không có closed */
    }
    shell.writeHtml(html);
    // ĐT: giữ iframe ~2 phút sau in để xem lại / in lại; desktop tab tự giữ
    if (shell.isIframe) {
      const removeLater = () => shell.cleanup();
      try {
        shell.win.addEventListener?.('afterprint', () => setTimeout(removeLater, 800));
      } catch {
        /* bỏ qua */
      }
      setTimeout(removeLater, 180_000);
    }
    return true;
  } catch (e: any) {
    try {
      shell.writeHtml(
        `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:Arial;padding:24px"><h2>Không chuẩn bị được bản in</h2><p>${String(e?.message || e)}</p>
<p><button type="button" onclick="window.parent && window.parent.document.querySelector('iframe[name=aloha-price-print-frame]')?.remove()">Đóng</button></p>
</body></html>`
      );
    } catch {
      shell.cleanup();
    }
    return false;
  }
}
