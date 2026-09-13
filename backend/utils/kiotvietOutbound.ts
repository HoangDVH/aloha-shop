/**
 * src/utils/kiotvietOutbound.ts
 * ============================================================
 * MODULE CHUYỂN ĐỔI CHIỀU ĐI (ALOHA ➔ KIOTVIET) CHO FRONTEND VÀ BACKEND
 * ============================================================
 */

import { Order, Product, Supplier } from '../services/database';

export interface KiotVietPurchaseOrderDetail {
  productId?: number;
  productCode: string;
  productName?: string;
  quantity: number;
  price: number;
  discount?: number;
  discountRatio?: number;
  note?: string;
}

export interface KiotVietPurchaseOrderPayload {
  branchId: number;
  purchaseOrderCode?: string;
  supplierId?: number;
  supplierCode?: string;
  supplierName?: string;
  description: string;
  isDraft: boolean;
  purchaseOrderDetails: KiotVietPurchaseOrderDetail[];
}

/**
 * Chuyển đổi một Đơn Thu Mua (Order trong aloha_orders) sang Payload KiotViet API
 */
export function buildKiotVietPurchaseOrderPayload(
  order: Order,
  opts: {
    branchId: number;
    isDraft?: boolean;
    supplierId?: number;
    supplierCode?: string;
    supplierName?: string;
  }
): KiotVietPurchaseOrderPayload {
  const isDraft = Boolean(opts.isDraft ?? false);
  const rawItems = (order.items || []) as any[];
  const details: KiotVietPurchaseOrderDetail[] = [];
  const defectiveList: string[] = [];

  for (const it of rawItems) {
    const ma = String(it.g || it.ma || it.productCode || it.code || '').trim().toUpperCase();
    const sl = Number(it.sl ?? it.quantity ?? 0) || 0;
    const hangLoi = Number(it.hangLoi || 0) || 0;
    const gia = Number(it.giaNcc ?? it.price ?? it.donGia ?? 0) || 0;
    const ck = Number(it.ck ?? it.discount ?? 0) || 0;

    if (hangLoi > 0) {
      defectiveList.push(`${it.tenNcc || it.ten || ma} (${ma}) × ${hangLoi}`);
    }

    const actualQty = Math.max(0, sl - hangLoi);
    if (actualQty <= 0) continue;

    // 1. Nếu là Combo / Hàng thùng có danh sách dòng con `spRows`
    if (Array.isArray(it.spRows) && it.spRows.length > 0) {
      for (const sp of it.spRows) {
        const childMa = String(sp.j || sp.ma || sp.productCode || '').trim().toUpperCase();
        const perParent = Number(sp.n ?? sp.soLuong ?? 1) || 1;
        const childQty = perParent * actualQty;
        const childPrice = Number(sp.l ?? sp.price ?? sp.giaVon ?? 0) || 0;

        if (childMa && childQty > 0) {
          details.push({
            productCode: childMa,
            productName: sp.k || sp.ten || undefined,
            quantity: childQty,
            price: childPrice,
            discount: 0,
            discountRatio: 0,
            note: `Tách từ combo ${ma} (SL gốc: ${actualQty})`,
          });
        }
      }
    }
    // 2. Nếu là hàng đơn lẻ thông thường
    else if (ma) {
      const discountAmount =
        ck > 0 && ck <= 100
          ? Math.round((gia * actualQty * ck) / 100)
          : ck > 100
            ? ck
            : 0;

      details.push({
        productCode: ma,
        productName: it.tenNcc || it.ten || undefined,
        quantity: actualQty,
        price: gia,
        discount: discountAmount,
        discountRatio: ck <= 100 ? ck : 0,
        note: it.note || undefined,
      });
    }
  }

  if (details.length === 0) {
    throw new Error('Đơn hàng không có sản phẩm hợp lệ để nhập kho (hoặc tất cả đều là hàng lỗi).');
  }

  let noteDesc = String(order.note || order.description || '').trim();
  if (defectiveList.length > 0) {
    noteDesc += (noteDesc ? ' | ' : '') + `[Hàng lỗi hoàn trả: ${defectiveList.join(', ')}]`;
  }
  const fullDescription = `[ALOHA Thu Mua] Mã đơn: ${order.ma || order.id || 'PO'}. ${noteDesc}`.trim();

  return {
    branchId: opts.branchId,
    purchaseOrderCode: order.maKiotViet || undefined,
    supplierId: opts.supplierId,
    supplierCode: opts.supplierCode || order.nccMa || undefined,
    supplierName: opts.supplierName || order.ncc || undefined,
    description: fullDescription,
    isDraft: isDraft,
    purchaseOrderDetails: details,
  };
}

/**
 * Chuyển đổi Sản phẩm từ Aloha Product sang KiotViet Product Payload
 */
export function buildKiotVietProductPayload(
  prod: Product,
  opts?: { categoryId?: number }
) {
  const code = String(prod.ma || prod.id || '').trim().toUpperCase();
  const name = String(prod.ten || '').trim();
  const basePrice = Number(prod.giaBan ?? prod.giaChung ?? 0) || 0;
  const unit = String(prod.dvt || 'Cái').trim();
  const categoryId = Number(opts?.categoryId ?? prod.categoryId) || undefined;
  const weight = Number(prod.trongLuong || 0) || 0;
  const barCode = String(prod.barcode || '').trim() || undefined;

  let productType = 2;
  if (prod.loaiHang === 'combo' || prod.loai === 'Combo - đóng gói') productType = 1;
  else if (prod.loaiHang === 'dichvu' || prod.loai === 'Dịch vụ') productType = 3;

  let productFormulas = undefined;
  if (Array.isArray(prod.hangThanhPhan) && prod.hangThanhPhan.length > 0) {
    productFormulas = prod.hangThanhPhan.map((c: any) => ({
      materialCode: String(c.ma || c.code || '').trim().toUpperCase(),
      quantity: Number(c.soLuong ?? c.sl ?? 1) || 1,
      materialPrice: Number(c.giaVon ?? c.gia ?? 0) || undefined,
    })).filter((f: any) => Boolean(f.materialCode));
  }

  const imagesRaw = Array.isArray(prod.images) ? prod.images : (prod.anh ? [prod.anh] : []);
  const images = imagesRaw.filter((u) => typeof u === 'string' && u.startsWith('http'));

  const payload: any = {
    code: code || undefined,
    name: name,
    fullName: name,
    categoryId: categoryId,
    basePrice: basePrice,
    cost: Number(prod.giaVon || 0) || 0,
    unit: unit,
    weight: weight,
    barCode: barCode,
    allowsSale: prod.allowsSale !== false,
    isActive: prod.isActive !== false,
    productType: productType,
    hasVariants: false,
    conversionValue: Number(prod.conversionValue) || 1,
  };

  if (images.length > 0) payload.images = images;
  if (productFormulas && productFormulas.length > 0) payload.productFormulas = productFormulas;

  return payload;
}
