/**
 * Xuất / In bảng giá (Excel + A4) — dùng chung Hàng hóa, Combo, Cập nhật giá.
 * Link mã/tên → web bán (sitemap shop).
 */
import {
  downloadStyledExcel,
  productDetailUrl,
  type ExcelImageCell,
  type ExcelLinkCell,
} from './exportStyledExcel';
import { ensureShopProductUrlMap } from './shopProductUrl';
import type {
  PriceListKiotExportType,
  PriceListPrintLayout,
  PriceListPrintMode,
} from '../components/ui/PriceListExportPrintButtons';

export type PriceListRow = {
  ma: string;
  ten: string;
  dvt?: string;
  si: number;
  chung: number;
  web: number;
  /** URL ảnh tuyệt đối hoặc CDN (nhúng Excel / in A4). */
  anhUrl?: string;
};

function fmt(n: number): string {
  return (Number(n) || 0).toLocaleString('vi-VN');
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function warnMap(showToast?: (msg: string) => void): Promise<void> {
  const mapCount = await ensureShopProductUrlMap(true);
  if (mapCount < 50) {
    showToast?.('⚠️ Chưa tải được danh sách link web bán — khởi động lại máy chủ app rồi thử lại.');
  }
}

export async function exportCustomerPriceListFromRows(
  rows: PriceListRow[],
  opts?: { showToast?: (msg: string) => void; filenamePrefix?: string }
): Promise<void> {
  if (!rows.length) {
    alert('Không có sản phẩm nào để xuất!');
    return;
  }
  await warnMap(opts?.showToast);
  const prefix = opts?.filenamePrefix || 'ALOHA_BANG_GIA_KHACH';
  await downloadStyledExcel({
    filename: `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheetName: 'BangGiaKhach',
    columns: [
      { header: 'Mã hàng' },
      { header: 'Ảnh', width: 8 },
      { header: 'Tên hàng' },
      { header: 'Giá sỉ', alignRight: true, vnd: true },
      { header: 'Bảng giá chung', alignRight: true, vnd: true },
      { header: 'Giá web', alignRight: true, vnd: true },
    ],
    rows: rows.map((item) => {
      const href = productDetailUrl(item.ma, item.ten);
      const img = String(item.anhUrl || '').trim();
      return [
        { v: item.ma, href, shopMa: item.ma, shopTen: item.ten } as ExcelLinkCell,
        img ? ({ imageUrl: img, size: 36 } as ExcelImageCell) : '',
        { v: item.ten, href, shopMa: item.ma, shopTen: item.ten } as ExcelLinkCell,
        item.si,
        item.chung,
        item.web,
      ];
    }),
  });
  opts?.showToast?.(`📤 Đã xuất bảng giá khách hàng (${rows.length} SP).`);
}

export async function exportKiotPriceBookFromRows(
  rows: PriceListRow[],
  type: PriceListKiotExportType,
  opts?: { showToast?: (msg: string) => void }
): Promise<void> {
  if (!rows.length) {
    alert('Không có sản phẩm nào để xuất!');
    return;
  }
  await warnMap(opts?.showToast);
  const excelRows = rows.map((item) => {
    const targetPrice = type === 'chung' ? item.chung : type === 'si' ? item.si : item.web;
    const href = productDetailUrl(item.ma, item.ten);
    return [
      { v: item.ma, href, shopMa: item.ma, shopTen: item.ten } as ExcelLinkCell,
      { v: item.ten, href, shopMa: item.ma, shopTen: item.ten } as ExcelLinkCell,
      targetPrice,
    ];
  });
  let filename = 'BANG_GIA_WEB_KIOTVIET.xlsx';
  if (type === 'chung') filename = 'BANG_GIA_CHUNG_KIOTVIET.xlsx';
  else if (type === 'si') filename = 'BANG_GIA_SI_KIOTVIET.xlsx';
  await downloadStyledExcel({
    filename,
    sheetName: 'Sheet1',
    columns: [
      { header: 'Mã hàng' },
      { header: 'Tên hàng' },
      { header: 'Giá mới', alignRight: true },
    ],
    rows: excelRows,
  });
  opts?.showToast?.(`📤 Đã xuất file Excel ${filename} (cột rộng + in đậm + link SP).`);
}

export async function printPriceListA4FromRows(
  rows: PriceListRow[],
  opts: {
    printMode: PriceListPrintMode;
    printLayout: PriceListPrintLayout;
    showToast?: (msg: string) => void;
    title?: string;
  }
): Promise<void> {
  if (opts.printMode === 'changed_only') {
    opts.showToast?.('ℹ️ Tab này không có cột giá cũ — in toàn bộ danh sách.');
  }
  if (!rows.length) {
    alert('Không có sản phẩm nào để in!');
    return;
  }
  await warnMap(opts.showToast);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Không thể mở cửa sổ in. Vui lòng tắt trình chặn popup của trình duyệt.');
    return;
  }
  try {
    printWindow.document.write(
      '<!DOCTYPE html><title>Đang chuẩn bị bảng giá…</title><body style="font-family:sans-serif;padding:24px;color:#555">Đang chuẩn bị bảng giá…</body>'
    );
  } catch {
    /* ignore */
  }

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const docTitle =
    opts.printMode === 'customer' ? 'BẢNG GIÁ KHÁCH HÀNG' : opts.title || 'BẢNG GIÁ SẢN PHẨM';

  let html = `<html><head><title>In Bảng Giá</title><style>
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
@media print{@page{size:A4 ${opts.printLayout};margin:1cm}body{background:#fff!important}}
body{font-family:'Segoe UI',Arial,sans-serif;color:#333;margin:20px;font-size:11px;line-height:1.4}
.header-container{display:flex;justify-content:space-between;border-bottom:2px solid #2e7d32;padding-bottom:8px;margin-bottom:15px}
.company-info b{font-size:14px;color:#1b5e20}.company-info div{font-size:10px;color:#555;margin-top:2px}
.doc-title{text-align:right}.doc-title h1{margin:0;font-size:16px;color:#2e7d32;text-transform:uppercase}
.doc-title div{font-size:10px;color:#666;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border:1px solid #aaa;padding:6px 8px;font-size:10px;vertical-align:middle}
th{background:#2e7d32!important;color:#fff!important;font-weight:bold;text-align:center}
.text-center{text-align:center}.text-right{text-align:right}.font-bold{font-weight:bold}
.zebra-row{background:#f9f9f9}
.prod-name-cell{display:flex;align-items:center;gap:8px}
.prod-name-cell img{width:40px;height:40px;object-fit:cover;border-radius:3px;border:1px solid #ccc;flex-shrink:0}
.footer-sig{margin-top:40px;display:flex;justify-content:space-between;text-align:center}
.footer-sig .box{width:30%}.footer-sig .title{font-weight:bold;margin-bottom:60px}
</style></head><body>
<div class="header-container">
  <div class="company-info"><b>CÔNG TY TMĐT SX HOA VIỆT</b><div>ALOHA Thế Giới Chậu Cây — Bảng giá</div></div>
  <div class="doc-title"><h1>${docTitle}</h1><div>Thời gian in: ${todayStr}</div><div>Số lượng sản phẩm: ${rows.length}</div></div>
</div>
<table><thead><tr>
  <th style="width:30px">#</th><th style="width:100px">Mã SP</th><th>Tên sản phẩm</th><th style="width:60px">ĐVT</th>
  <th style="width:110px;background:#283593!important">Giá sỉ</th>
  <th style="width:120px;background:#1b5e20!important">Bảng giá chung</th>
  <th style="width:110px;background:#4a148c!important">Giá web</th>
</tr></thead><tbody>`;

  rows.forEach((item, idx) => {
    const href = productDetailUrl(item.ma, item.ten);
    const imgUrl = String(item.anhUrl || '').trim();
    const nameCell = imgUrl
      ? `<div class="prod-name-cell"><img src="${imgUrl}" alt="" /><a href="${href}" target="_blank" rel="noopener">${escapeHtml(item.ten)}</a></div>`
      : `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(item.ten)}</a>`;
    const rowClass = idx % 2 === 0 ? '' : 'class="zebra-row"';
    html += `<tr ${rowClass}>
      <td class="text-center font-bold">${idx + 1}</td>
      <td class="font-bold"><a href="${href}" target="_blank" rel="noopener">${escapeHtml(item.ma)}</a></td>
      <td>${nameCell}</td>
      <td class="text-center">${escapeHtml(item.dvt || 'Cái')}</td>
      <td class="text-right font-bold">${fmt(item.si)}</td>
      <td class="text-right font-bold">${fmt(item.chung)}</td>
      <td class="text-right font-bold">${fmt(item.web)}</td>
    </tr>`;
  });

  html += `</tbody></table>
<div class="footer-sig">
  <div class="box"><div class="title">Người lập</div></div>
  <div class="box"><div class="title">Kiểm tra</div></div>
  <div class="box"><div class="title">Duyệt</div></div>
</div></body></html>`;

  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch {
        /* ignore */
      }
    }, 400);
  } catch {
    alert('Không ghi được nội dung in.');
  }
}
