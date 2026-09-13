import { normalizeString } from './helpers';

export type ChungTuSanPham = {
  ten: string;
  ma?: string;
  sku?: string;
  sl?: number;
  donGia?: number;
  thanhTien?: number;
  si?: number;
  chung?: number;
  web?: number;
  _fromFile?: string;
};

export type ChungTuParsedData = {
  ncc: string;
  ngay: string;
  sanPham: ChungTuSanPham[];
  fromSpreadsheet?: boolean;
};

async function loadXlsx() {
  return import('xlsx');
}

export function isCsvFileName(name: string) {
  return (name || '').toLowerCase().endsWith('.csv');
}

export function isExcelFileName(name: string) {
  const n = (name || '').toLowerCase();
  return n.endsWith('.xlsx') || n.endsWith('.xls');
}

export function isTabularImportFile(file: File) {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    isExcelFileName(name) ||
    isCsvFileName(name) ||
    type === 'text/csv' ||
    type === 'application/csv' ||
    type.includes('csv')
  );
}

export function isChungTuAcceptableFile(file: File) {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  if (type === 'application/pdf' || name.endsWith('.pdf')) return true;
  if (isTabularImportFile(file)) return true;
  if (type.includes('sheet') || type.includes('excel') || type === 'application/vnd.ms-excel') return true;
  return false;
}

export function parseOcrPriceHelper(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const valStr = String(val).trim();

  if (valStr.includes('.') && valStr.includes(',')) {
    const firstDot = valStr.indexOf('.');
    const firstComma = valStr.indexOf(',');
    if (firstDot < firstComma) {
      const clean = valStr.replace(/\./g, '').replace(/,/g, '.');
      return parseFloat(clean) || 0;
    }
    const clean = valStr.replace(/,/g, '');
    return parseFloat(clean) || 0;
  }

  const hasDot = valStr.includes('.');
  const hasComma = valStr.includes(',');
  if (hasDot || hasComma) {
    const parts = valStr.split(/[.,]/);
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 3) {
      const clean = valStr.replace(/[.,]/g, '');
      return parseFloat(clean) || 0;
    }
    if (lastPart.length === 1 || lastPart.length === 2) {
      const clean = valStr.replace(/,/g, '.');
      return parseFloat(clean) || 0;
    }
  }

  const clean = valStr.replace(/[^\d]/g, '');
  return parseFloat(clean) || 0;
}

export function parseExcelRowsToOcrData(rows: unknown[][], fileName: string): ChungTuParsedData {
  const sanPham: ChungTuSanPham[] = [];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(50, rows.length); i++) {
    const normJoined = normalizeString((rows[i] || []).join(' '));
    if (
      (normJoined.includes('ten') ||
        normJoined.includes('san pham') ||
        normJoined.includes('sku') ||
        normJoined.includes('mat hang')) &&
      (normJoined.includes('sl') ||
        normJoined.includes('so luong') ||
        normJoined.includes('qty') ||
        normJoined.includes('don gia') ||
        normJoined.includes('thanh tien') ||
        normJoined.includes('gia si') ||
        normJoined.includes('gia chung') ||
        normJoined.includes('gia web'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  let colTen = -1;
  let colSku = -1;
  let colSl = -1;
  let colGia = -1;
  let colThanhTien = -1;
  let colGiaSi = -1;
  let colGiaChung = -1;
  let colGiaWeb = -1;

  if (headerRowIdx >= 0) {
    const hdr = (rows[headerRowIdx] || []).map((h) => normalizeString(String(h || '')));
    colTen = hdr.findIndex(
      (h) => h.includes('ten hang') || h.includes('ten sp') || h.includes('ten') || h.includes('description') || h.includes('mat hang')
    );
    colSku = hdr.findIndex((h) => h.includes('ma hang') || h.includes('sku') || h.includes('ma sp'));
    colSl = hdr.findIndex((h) => h === 'sl' || h.includes('so luong') || h.includes('qty') || h.includes('quantity'));
    colGiaSi = hdr.findIndex((h) => h.includes('gia si') || h === 'si' || h.includes('gia ban si'));
    colGiaChung = hdr.findIndex((h) => h.includes('gia chung') || h.includes('bang gia chung') || h === 'chung');
    colGiaWeb = hdr.findIndex((h) => h.includes('gia web') || h === 'web');
    colGia = hdr.findIndex(
      (h) =>
        (h.includes('don gia') || h.includes('gia nhap') || h.includes('gia von') || h.includes('price')) &&
        !h.includes('si') &&
        !h.includes('chung') &&
        !h.includes('web')
    );
    if (colGia < 0) {
      colGia = hdr.findIndex((h) => h.includes('gia') && !h.includes('thanh tien') && !h.includes('si') && !h.includes('chung') && !h.includes('web'));
    }
    colThanhTien = hdr.findIndex((h) => h.includes('thanh tien') || h.includes('total'));
    if (colTen < 0) colTen = hdr.findIndex((h) => h.includes('san pham'));
  }

  const startIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  for (let ri = startIdx; ri < rows.length; ri++) {
    const row = rows[ri] as unknown[];
    if (!row || row.length === 0) continue;

    let name = colTen >= 0 ? String(row[colTen] || '').trim() : '';
    const sku = colSku >= 0 ? String(row[colSku] || '').trim() : '';

    if (!name) {
      for (let ci = 0; ci < row.length; ci++) {
        const cellVal = String(row[ci] || '').trim();
        if (cellVal && cellVal.length > 1 && !/^\d+$/.test(cellVal) && !/tong|total|subtotal|cong/i.test(normalizeString(cellVal))) {
          name = cellVal;
          break;
        }
      }
    }

    if (!name || /tong cong|total|subtotal|cong /i.test(normalizeString(name))) continue;

    let qty = 1;
    if (colSl >= 0 && row[colSl] !== undefined && row[colSl] !== '') {
      qty = parseFloat(String(row[colSl]).replace(/[^\d.]/g, '')) || 1;
    }

    let price = 0;
    if (colGia >= 0 && row[colGia] !== undefined && row[colGia] !== '') {
      price = parseOcrPriceHelper(row[colGia]);
    } else if (colThanhTien >= 0 && row[colThanhTien] !== undefined && row[colThanhTien] !== '' && qty > 0) {
      const tt = parseOcrPriceHelper(row[colThanhTien]);
      price = Math.round(tt / qty);
    }

    const si = colGiaSi >= 0 ? parseOcrPriceHelper(row[colGiaSi]) : 0;
    const chung = colGiaChung >= 0 ? parseOcrPriceHelper(row[colGiaChung]) : 0;
    const web = colGiaWeb >= 0 ? parseOcrPriceHelper(row[colGiaWeb]) : 0;

    if (!price && !si && !chung && !web) continue;

    sanPham.push({
      ten: name,
      ma: sku || undefined,
      sku: sku || undefined,
      sl: qty,
      donGia: price,
      thanhTien: qty * price,
      si: si || undefined,
      chung: chung || undefined,
      web: web || undefined,
    });
  }

  return {
    ncc: fileName.replace(/\.[^/.]+$/, ''),
    ngay: new Date().toLocaleDateString('vi-VN'),
    sanPham,
    fromSpreadsheet: true,
  };
}

export async function parseSpreadsheetFileToOcrData(file: File): Promise<ChungTuParsedData | null> {
  try {
    const XLSX = await loadXlsx();
    let rows: unknown[][] = [];
    if (isCsvFileName(file.name) || (file.type || '').toLowerCase().includes('csv')) {
      const text = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('Không đọc được CSV'));
        r.readAsText(file, 'UTF-8');
      });
      const wb = XLSX.read(text, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    } else {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.onerror = () => reject(new Error('Không đọc được Excel'));
        r.readAsArrayBuffer(file);
      });
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    }
    return parseExcelRowsToOcrData(rows, file.name);
  } catch (err) {
    console.error('Error parsing spreadsheet file:', err);
    return null;
  }
}

export async function downloadChungTuExcelTemplate() {
  const XLSX = await loadXlsx();
  const rows = [
    ['Ten_SP', 'Ma_SP', 'SL', 'Don_gia', 'Gia_si', 'Gia_chung', 'Gia_web', 'Ghi_chu'],
    ['Hạnh phúc cg', 'HLHP01', 30, 15000, 22000, 28000, 32000, 'Giá bán cột tùy chọn'],
    ['Ngũ Gia Bì', '', 10, 40000, '', '', '', 'Chỉ cần Ten_SP + Don_gia'],
    ['', '', '', '', '', '', '', 'Xóa/sửa theo phiếu thật → Lưu → Nhập vào app'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 36 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ChungTu');
  XLSX.writeFile(wb, `Mau-chung-tu-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadChungTuCsvTemplate() {
  const rows = [
    'Ten_SP,Ma_SP,SL,Don_gia,Gia_si,Gia_chung,Gia_web,Ghi_chu',
    'Hạnh phúc cg,HLHP01,30,15000,22000,28000,32000,',
    'Ngũ Gia Bì,,10,40000,,,,',
    ',,,,,,,Xóa/sửa theo phiếu thật → Lưu CSV UTF-8 → Nhập vào app',
  ].join('\n');
  const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Mau-chung-tu-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
