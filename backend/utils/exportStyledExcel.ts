/** Xuất Excel .xlsx: hàng đầu in đậm, cột tự rộng, hyperlink, ảnh nhúng (ExcelJS). */

import ExcelJS from 'exceljs';
import { formatVndDot } from './helpers';
import { ensureShopProductUrlMap, resolveShopProductUrl } from './shopProductUrl';

export type ExcelCell = string | number | boolean | null | undefined;

export type ExcelLinkCell = {
  v: ExcelCell;
  href?: string;
  /** Dùng làm mới URL sau khi nạp sitemap (web bán alohathegioichaucay.com). */
  shopMa?: string;
  shopTen?: string;
};

/** Ô ảnh — nhúng thumbnail vào file Excel. */
export type ExcelImageCell = {
  imageUrl: string;
  size?: number;
};

export type ExcelCol = {
  header: string;
  width?: number;
  alignRight?: boolean;
  /** Hiện 450.000. Không bật cho file import KiotViet. */
  vnd?: boolean;
};

export type ExcelAnyCell = ExcelCell | ExcelLinkCell | ExcelImageCell;

function cellText(v: ExcelCell): string {
  if (v == null) return '';
  return String(v);
}

function isPlainMoneyNumber(v: ExcelCell): v is number | string {
  if (typeof v === 'number' && Number.isFinite(v)) return true;
  if (typeof v === 'string' && v !== '' && v !== '—' && /^\d+$/.test(v.trim())) return true;
  return false;
}

function vndCell(v: ExcelCell, col?: ExcelCol): ExcelCell {
  if (!col?.vnd || !isPlainMoneyNumber(v)) return v;
  return formatVndDot(v);
}

function isLinkCell(cell: ExcelAnyCell): cell is ExcelLinkCell {
  return !!cell && typeof cell === 'object' && 'v' in cell && !('imageUrl' in cell);
}

function isImageCell(cell: ExcelAnyCell): cell is ExcelImageCell {
  return !!cell && typeof cell === 'object' && 'imageUrl' in cell;
}

function absFetchUrl(url: string): string {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  if (u.startsWith('/')) {
    try {
      return `${window.location.origin}${u}`;
    } catch {
      return u;
    }
  }
  return u;
}

/** Độ rộng ký tự theo nội dung (ưu tiên tên dài). */
export function autoColWidths(
  headers: string[],
  rows: ExcelCell[][],
  opts?: { min?: number; max?: number }
): number[] {
  const min = opts?.min ?? 10;
  const max = opts?.max ?? 72;
  return headers.map((h, i) => {
    let w = Math.max(min, [...h].length + 2);
    for (const row of rows) {
      const t = cellText(row[i]);
      w = Math.max(w, Math.min(max, [...t].length + 2));
    }
    return Math.min(max, Math.max(min, w));
  });
}

/** Link trang chi tiết SP trên web bán https://alohathegioichaucay.com */
export function productDetailUrl(ma: string, ten?: string): string {
  const code = String(ma || '').trim();
  if (!code && !ten) return '';
  return resolveShopProductUrl(code, ten);
}

async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; ext: 'png' | 'jpeg' | 'gif' } | null> {
  const abs = absFetchUrl(url);
  if (!abs || abs.startsWith('data:')) return null;
  try {
    const res = await fetch(abs);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) return null;
    let ext: 'png' | 'jpeg' | 'gif' = 'jpeg';
    if (ct.includes('png') || abs.toLowerCase().includes('.png')) ext = 'png';
    else if (ct.includes('gif') || abs.toLowerCase().includes('.gif')) ext = 'gif';
    return { buffer, ext };
  } catch {
    return null;
  }
}

/**
 * Tải file .xlsx: tiêu đề in đậm, cột rộng theo nội dung, mã/tên bấm được, ảnh nhúng.
 */
export async function downloadStyledExcel(opts: {
  filename: string;
  sheetName?: string;
  columns: ExcelCol[];
  rows: Array<Array<ExcelAnyCell>>;
}): Promise<void> {
  // Nạp map URL web bán (1 lần/ngày) rồi LÀM MỚI hyperlink — tránh đóng băng fallback /products/ sai
  try {
    await ensureShopProductUrlMap();
  } catch {
    /* fallback trang chủ shop */
  }
  for (const row of opts.rows) {
    let ma = '';
    let ten = '';
    for (const cell of row) {
      if (!isLinkCell(cell)) continue;
      if (cell.shopMa) ma = String(cell.shopMa).trim() || ma;
      if (cell.shopTen) ten = String(cell.shopTen).trim() || ten;
      const text = String(cell.v ?? '').trim();
      if (!text) continue;
      if (!ma && !/\s/.test(text) && text.length <= 40) ma = text;
      else if (!ten && (/\s/.test(text) || text.length > 20)) ten = text;
    }
    if (!ma && !ten) continue;
    const fresh = resolveShopProductUrl(ma, ten);
    for (const cell of row) {
      if (!isLinkCell(cell)) continue;
      if (
        !cell.href ||
        String(cell.href).includes('alohathegioichaucay.com') ||
        String(cell.href).includes('/products/')
      ) {
        cell.href = fresh;
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((opts.sheetName || 'BangGia').slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = opts.columns.map((c) => c.header);
  const plainForWidth: ExcelCell[][] = opts.rows.map((row) =>
    row.map((cell, i) => {
      const col = opts.columns[i];
      if (isImageCell(cell)) return '';
      if (isLinkCell(cell)) return vndCell(cell.v, col);
      return vndCell(cell, col);
    })
  );
  const auto = autoColWidths(headers, plainForWidth, { min: 10, max: 72 });

  opts.columns.forEach((col, i) => {
    const hasImg = opts.rows.some((r) => isImageCell(r[i]));
    ws.getColumn(i + 1).width = col.width != null ? col.width : hasImg ? 8 : auto[i];
    if (col.alignRight) {
      ws.getColumn(i + 1).alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
    }
  });

  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FF1B5E20' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF9E9E9E' } },
      bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
      left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
      right: { style: 'thin', color: { argb: 'FF9E9E9E' } },
    };
  });

  const imgJobs: Array<{
    row: number;
    col: number;
    url: string;
    size: number;
  }> = [];

  for (let R = 0; R < opts.rows.length; ++R) {
    const rawRow = opts.rows[R];
    const values = rawRow.map((cell, C) => {
      const col = opts.columns[C];
      if (isImageCell(cell)) return '';
      if (isLinkCell(cell)) return vndCell(cell.v ?? '', col);
      return vndCell(cell ?? '', col);
    });
    const excelRow = ws.addRow(values);
    let rowHasImg = false;

    for (let C = 0; C < opts.columns.length; ++C) {
      const raw = rawRow[C];
      const cell = excelRow.getCell(C + 1);
      const col = opts.columns[C];
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
      cell.alignment = {
        horizontal: col?.alignRight || typeof cell.value === 'number' ? 'right' : 'left',
        vertical: 'middle',
        wrapText: true,
      };

      if (isLinkCell(raw) && raw.href) {
        cell.value = {
          text: cellText(vndCell(raw.v, col)),
          hyperlink: String(raw.href),
          tooltip: 'Mở trang sản phẩm trên alohathegioichaucay.com',
        };
        cell.font = { color: { argb: 'FF1565C0' }, underline: true };
      }

      if (isImageCell(raw) && raw.imageUrl) {
        rowHasImg = true;
        imgJobs.push({
          row: R + 2,
          col: C + 1,
          url: raw.imageUrl,
          size: raw.size && raw.size > 0 ? raw.size : 40,
        });
      }
    }

    if (rowHasImg) excelRow.height = 36;
  }

  // Tải ảnh song song (giới hạn nhẹ)
  const concurrency = 6;
  for (let i = 0; i < imgJobs.length; i += concurrency) {
    const batch = imgJobs.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (job) => {
        const got = await fetchImageBuffer(job.url);
        if (!got) return;
        const imageId = wb.addImage({
          // Browser: Uint8Array; ExcelJS typings expect Node Buffer
          buffer: new Uint8Array(got.buffer) as any,
          extension: got.ext,
        });
        const px = job.size;
        // ExcelJS dùng đơn vị roughly EMU; tl/br theo cell
        ws.addImage(imageId, {
          tl: { col: job.col - 1 + 0.15, row: job.row - 1 + 0.15 },
          ext: { width: px, height: px },
          editAs: 'oneCell',
        });
      })
    );
  }

  let filename = (opts.filename || 'BangGia').trim();
  if (filename.toLowerCase().endsWith('.xls') && !filename.toLowerCase().endsWith('.xlsx')) {
    filename = filename.slice(0, -4) + '.xlsx';
  } else if (!filename.toLowerCase().endsWith('.xlsx')) {
    filename += '.xlsx';
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
}

