/** Định dạng chữ trên vé / nhãn voucher, dùng chung cho PDP, kho voucher và checkout. */

/** Voucher túi mù: khoảng %, tỉ lệ trúng từng mức và mức khách đã bóc (nếu có). */
export type MysteryInfo = {
  min: number;
  max: number;
  tiers: { percent: number; chance: number }[];
  drawnPercent?: number;
};

export type VoucherLike = {
  benefitType?: "goods" | "shipping";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  targetCustomer?: string;
  mystery?: MysteryInfo;
};

/** Túi mù chưa bóc. */
export function isUnopenedMystery(p: Pick<VoucherLike, "mystery">): boolean {
  return Boolean(p.mystery && !p.mystery.drawnPercent);
}

/** "12%" — túi mù chưa bóc ghi khoảng "10–15%", đã bóc ghi mức trúng. */
export function pctText(p: Pick<VoucherLike, "discountValue" | "mystery">): string {
  if (p.mystery?.drawnPercent) return `${p.mystery.drawnPercent}%`;
  if (p.mystery) return `${p.mystery.min}–${p.mystery.max}%`;
  return `${p.discountValue}%`;
}

/** Gắn mức khách đã bóc (từ ví) vào voucher túi mù để mọi nhãn hiện đúng % của khách. */
export function withDrawn<T extends VoucherLike & { id: string }>(v: T, drawn?: Record<string, number>): T {
  const pct = v.mystery ? drawn?.[v.id] : undefined;
  return pct ? { ...v, discountValue: pct, mystery: { ...v.mystery!, drawnPercent: pct } } : v;
}

/** Rút gọn số tiền: 20000 -> 20k, 300000 -> 300k, 1000000 -> 1tr */
export function formatCompactVnd(val: number): string {
  if (!val || val <= 0) return "0đ";
  if (val >= 1_000_000) {
    const tr = val / 1_000_000;
    return tr % 1 === 0 ? `${tr}tr` : `${tr.toFixed(1).replace(".0", "")}tr`;
  }
  if (val >= 1_000) {
    const k = val / 1_000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1).replace(".0", "")}k`;
  }
  return `${val}đ`;
}

/** "Hỗ trợ phí ship 30K" / "Hỗ trợ phí ship 10%"; không ghi "freeship" vì voucher chỉ trừ một phần phí. */
export function shipSupportText(p: Pick<VoucherLike, "discountType" | "discountValue">): string {
  if (p.discountType === "fixed" && p.discountValue > 0) {
    return `Hỗ trợ phí ship ${formatCompactVnd(p.discountValue).toUpperCase()}`;
  }
  if (p.discountType === "percentage" && p.discountValue > 0) return `Hỗ trợ phí ship ${p.discountValue}%`;
  return "Hỗ trợ phí ship";
}

/** Nhãn ngắn của voucher (PDP: "Giảm 30k đơn 350k", "Giảm 5% cho khách mới", "Hỗ trợ phí ship 30K đơn 1tr"...). */
export function formatVoucherBadge(p: VoucherLike): { label: string; type: "goods" | "shipping" } {
  if (p.benefitType === "shipping") {
    let text = shipSupportText(p);
    if (p.minOrderThreshold && p.minOrderThreshold > 0) {
      text += ` đơn ${formatCompactVnd(p.minOrderThreshold)}`;
    }
    return { label: text, type: "shipping" };
  }
  if (p.targetCustomer === "new_web") {
    if (p.discountType === "percentage") {
      return { label: `Giảm ${pctText(p)} cho khách mới`, type: "goods" };
    }
    return { label: `Giảm ${formatCompactVnd(p.discountValue)} cho khách mới`, type: "goods" };
  }
  if (p.discountType === "fixed") {
    let text = `Giảm ${formatCompactVnd(p.discountValue)}`;
    if (p.minOrderThreshold && p.minOrderThreshold > 0) {
      text += ` đơn ${formatCompactVnd(p.minOrderThreshold)}`;
    }
    return { label: text, type: "goods" };
  }
  let text = `Giảm ${pctText(p)}`;
  if (p.maxDiscountVnd && p.maxDiscountVnd > 0) {
    text += ` tối đa ${formatCompactVnd(p.maxDiscountVnd)}`;
  } else if (p.minOrderThreshold && p.minOrderThreshold > 0) {
    text += ` đơn ${formatCompactVnd(p.minOrderThreshold)}`;
  }
  return { label: text, type: "goods" };
}

/** Giá trị lớn trên vé: "30K", "10%", "SHIP 30K". */
export function voucherHeadline(p: VoucherLike): string {
  if (p.benefitType === "shipping") {
    if (p.discountType === "fixed" && p.discountValue > 0) return `SHIP ${formatCompactVnd(p.discountValue).toUpperCase()}`;
    return p.discountType === "percentage" && p.discountValue > 0 ? `SHIP ${p.discountValue}%` : "HỖ TRỢ SHIP";
  }
  if (p.discountType === "percentage") return pctText(p);
  return formatCompactVnd(p.discountValue).toUpperCase();
}

/**
 * Làm sạch tiêu đề voucher để loại bỏ sự trùng lặp với cuống vé bên trái (chuẩn Shopee / Lazada).
 * Ví dụ:
 * - "Ưu đãi khách mới 5%" -> "Ưu đãi khách mới"
 * - "Giảm 10–15% đặt trước 20/10" -> "Ưu đãi đặt trước 20/10"
 * - "Giảm 10% Siêu Sale 10/10" -> "Siêu Sale 10/10"
 * - "Hỗ trợ phí ship 30k" -> "Hỗ trợ phí vận chuyển"
 */
export function cleanVoucherTitle(v: {
  title?: string;
  benefitType?: "goods" | "shipping";
  targetCustomer?: string;
  mystery?: MysteryInfo;
}): string {
  const raw = (v.title || "").trim();

  // 1. Voucher vận chuyển
  if (v.benefitType === "shipping") {
    if (!raw) return "Hỗ trợ phí vận chuyển";
    const cleaned = raw
      .replace(/\s*\d+[\w%]*$/i, "")
      .replace(/^(hỗ trợ phí ship|phí ship|freeship|miễn phí ship)\s*(\d+[\w%]*)?/i, "")
      .trim();
    if (cleaned && cleaned.length >= 3) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return "Hỗ trợ phí vận chuyển";
  }

  // 2. Khách mới
  const isNew = v.targetCustomer === "new_web" || /khách mới|bạn mới/i.test(raw);

  if (!raw) {
    if (isNew) return "Dành cho khách hàng mới";
    if (v.mystery) return "Voucher túi mù may mắn";
    return "Ưu đãi toàn sàn";
  }

  // 3. Làm sạch số % và số tiền giảm giá lặp lại
  let cleaned = raw
    .replace(/^(giảm|ưu đãi)\s+\d+([\s–-]+\d+)?%?\s*k?\s*[-–:]*\s*/i, "")
    .replace(/\s*[-–:]*\s*\d+([\s–-]+\d+)?%$/i, "")
    .replace(/\s*[-–:]*\s*\d+k$/i, "")
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Làm mượt ngữ nghĩa
  if (/^đặt trước/i.test(cleaned)) {
    cleaned = "Ưu đãi " + cleaned.toLowerCase();
  }

  if (!cleaned || cleaned.length < 3) {
    if (isNew) return "Dành cho khách hàng mới";
    if (v.mystery) return "Voucher túi mù may mắn";
    return "Ưu đãi toàn sàn";
  }

  return cleaned;
}

/** Dòng điều kiện dưới giá trị vé: "Đơn từ 350K · Tối đa 100K". */
export function voucherConditionText(p: VoucherLike): string {
  const parts: string[] = [];
  parts.push(
    p.minOrderThreshold && p.minOrderThreshold > 0
      ? `Đơn từ ${formatCompactVnd(p.minOrderThreshold).toUpperCase()}`
      : "Mọi đơn"
  );
  if (p.discountType === "percentage" && p.maxDiscountVnd && p.maxDiscountVnd > 0) {
    parts.push(`Tối đa ${formatCompactVnd(p.maxDiscountVnd).toUpperCase()}`);
  }
  return parts.join(" · ");
}

/**
 * Nhãn giảm trên card ưu đãi: dưới 500K ghi "-38%", từ 500K ghi "Giảm 150K".
 * Trả "" nếu không giảm.
 */
export function discountTagText(listPrice: number, salePrice: number): string {
  if (!(listPrice > 0) || !(salePrice >= 0) || salePrice >= listPrice) return "";
  const diff = listPrice - salePrice;
  if (listPrice >= 500_000) return `Giảm ${formatCompactVnd(diff).toUpperCase()}`;
  return `-${Math.round((diff / listPrice) * 100)}%`;
}

/** Nút "Dùng ngay": tới danh sách SP voucher áp dụng được (giống Shopee/Lazada/TikTok). */
export function voucherUseHref(voucherId: string): string {
  return `/tim?voucher=${encodeURIComponent(voucherId)}`;
}

/**
 * Gom nhóm voucher theo loại ưu đãi chuẩn sàn TMĐT (Shopee/Lazada):
 * 1. Nhóm Giảm giá đơn hàng / sản phẩm (goods) lên đầu.
 * 2. Nhóm Hỗ trợ phí ship (shipping) nằm tiếp theo sát nhau.
 * Trong từng nhóm:
 * - Sắp xếp theo điều kiện đơn tối thiểu tăng dần (minOrderThreshold: không điều kiện -> 1tr -> 2tr...).
 * - Nếu cùng điều kiện đơn: sắp xếp theo giá trị giảm tăng dần (5% -> 10%...).
 */
export function sortVouchersGrouped<
  T extends {
    benefitType?: "goods" | "shipping" | string;
    minOrderThreshold?: number | null;
    discountValue?: number;
  }
>(vouchers: T[]): T[] {
  return [...vouchers].sort((a, b) => {
    // 1. Phân nhóm: Goods (0) trước, Shipping (1) sau
    const isShipA = a.benefitType === "shipping" ? 1 : 0;
    const isShipB = b.benefitType === "shipping" ? 1 : 0;
    if (isShipA !== isShipB) return isShipA - isShipB;

    // 2. Trong cùng nhóm: Sắp xếp theo mức chi tiêu tối thiểu tăng dần
    const minA = Number(a.minOrderThreshold) || 0;
    const minB = Number(b.minOrderThreshold) || 0;
    if (minA !== minB) return minA - minB;

    // 3. Nếu cùng mốc chi tiêu: Sắp xếp theo giá trị giảm tăng dần
    const valA = Number(a.discountValue) || 0;
    const valB = Number(b.discountValue) || 0;
    return valA - valB;
  });
}
