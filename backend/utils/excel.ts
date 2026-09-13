import type { Product } from '../services/database';

export async function parseKiotVietExcel(fileBuffer: ArrayBuffer): Promise<Partial<Product>[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  return rows.map((row: any) => {
    const getVal = (possibleHeaders: string[]) => {
      for (const h of possibleHeaders) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === h.trim().toLowerCase());
        if (foundKey) return row[foundKey];
      }
      return undefined;
    };

    const ma = String(getVal(['Mã hàng', 'Ma hang', 'Mã sản phẩm', 'Mã SP', 'Mã hàng (*)']) || '').trim();
    const ten = String(getVal(['Tên hàng', 'Ten hang', 'Tên sản phẩm', 'Tên SP', 'Tên hàng (*)']) || '').trim();
    const nhom = String(getVal(['Nhóm hàng', 'Nhom hang', 'Nhóm sản phẩm', 'Nhóm SP', 'Nhóm hàng (*)']) || 'Mặc định').trim();
    const dvt = String(getVal(['Đơn vị tính', 'Don vi tinh', 'ĐVT']) || 'Cái').trim();

    const giaVonVal = getVal(['Giá vốn', 'Gia von', 'Giá nhập', 'Gia nhap']);
    const giaVon = typeof giaVonVal === 'number' ? giaVonVal : parseFloat(String(giaVonVal || '0').replace(/[^0-9.-]/g, '')) || 0;

    const giaBanVal = getVal(['Giá bán', 'Gia ban', 'Giá bán lẻ', 'Gia ban le', 'Giá bán (*)']);
    const giaBan = typeof giaBanVal === 'number' ? giaBanVal : parseFloat(String(giaBanVal || '0').replace(/[^0-9.-]/g, '')) || 0;

    const tonVal = getVal(['Tồn kho', 'Ton kho', 'Số lượng', 'So luong', 'Tồn', 'Ton', 'Tồn kho (*)']);
    const ton = typeof tonVal === 'number' ? tonVal : parseFloat(String(tonVal || '0').replace(/[^0-9.-]/g, '')) || 0;

    const barcodeVal = getVal(['Mã vạch', 'Ma vach', 'Barcode', 'Mã vạch (*)']);
    const barcode = barcodeVal ? String(barcodeVal).trim() : undefined;

    return {
      ma,
      ten,
      nhom,
      dvt,
      giaVon,
      giaNhap: giaVon,
      giaBan,
      ton,
      barcode
    };
  }).filter(p => p.ma);
}

export async function exportKiotVietExcel(products: Product[]): Promise<void> {
  const XLSX = await import('xlsx');
  const data = products.map(p => ({
    'Mã hàng': p.ma,
    'Mã vạch': p.barcode || '',
    'Tên hàng': p.ten,
    'Nhóm hàng': p.nhom || 'Mặc định',
    'Đơn vị tính': p.dvt || 'Cái',
    'Giá vốn': p.giaVon || 0,
    'Giá bán': p.giaBan || 0,
    'Tồn kho': p.ton || 0,
    'Trạng thái': 'Đang kinh doanh'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách sản phẩm');
  XLSX.writeFile(workbook, `KiotViet_San_Pham_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Prefetch xlsx khi hover nút Excel */
export function prefetchXlsx() {
  void import('xlsx');
}
