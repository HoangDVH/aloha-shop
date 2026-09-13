/**
 * Lấy chú thích số lượng & ĐVT con trực tiếp từ hangThanhPhan của sản phẩm Thùng
 * Ví dụ: hangThanhPhan = [{ soLuong: 40, dvt: "CÂY" }] => "= 40 CÂY"
 */
export function getThungSubtext(
  itemOrProd: any,
  productsMapOrList?: Map<string, any> | any[]
): string | null {
  if (!itemOrProd) return null;

  let prod = itemOrProd;
  const ma = String(itemOrProd.ma || itemOrProd.maHang || itemOrProd.code || '').trim().toUpperCase();

  if ((!prod.hangThanhPhan || !prod.hangThanhPhan.length) && ma && productsMapOrList) {
    if (productsMapOrList instanceof Map) {
      prod = productsMapOrList.get(ma) || prod;
    } else if (Array.isArray(productsMapOrList)) {
      prod = productsMapOrList.find((p: any) => String(p.ma || p.code || '').trim().toUpperCase() === ma) || prod;
    }
  }

  const currentDvt = String(prod?.dvt || prod?.unit || itemOrProd?.dvt || itemOrProd?.unit || '').trim().toUpperCase();
  const loai = String(prod?.loaiHang || itemOrProd?.loaiHang || '').toLowerCase();

  if (currentDvt !== 'THÙNG' && !currentDvt.includes('THÙNG') && loai !== 'hangthung') {
    return null;
  }

  if (Array.isArray(prod?.hangThanhPhan) && prod.hangThanhPhan.length > 0) {
    const parts = prod.hangThanhPhan.map((c: any) => `${c.sl || c.soLuong || 1} ${c.dvt || 'CÂY'}`);
    return `= ${parts.join(' + ')}`;
  }

  return null;
}

/**
 * Tẩy sạch các hậu tố dạng "(THÙNG 40)", "THÙNG 40 CÂY", "(40 CÂY)" khỏi tên sản phẩm con lẻ
 */
export function cleanChildProductName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(\s*thùng\s*[\d\s,.\-+xX*câycáibịchchậu]+\)/gi, '')
    .replace(/\s*-\s*thùng\s*[\d\s,.\-+xX*câycáibịchchậu]+/gi, '')
    .replace(/\s*thùng\s*[\d\s,.\-+xX*câycáibịchchậu]+/gi, '')
    .replace(/\s*\(\s*[\d\s,.\-+xX*]+\s*(cây|cái|bịch|chậu|c)\s*\)/gi, '')
    .replace(/\s*\(\s*T\d+\s*\)/gi, '')
    .replace(/\s*-\s*mã\s*T\d+/gi, '')
    .replace(/\s*\(\s*cây\s*\)/gi, '')
    .replace(/\s*\(\s*cái\s*\)/gi, '')
    .replace(/\s*\(\s*thùng\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
