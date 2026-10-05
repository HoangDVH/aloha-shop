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

/** Nhãn ngắn của voucher (PDP: "Giảm 30k đơn 350k", "Hỗ trợ phí ship 30K đơn 1tr"...). */
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
      return { label: `Khách mới giảm ${pctText(p)}`, type: "goods" };
    }
    return { label: `Khách mới giảm ${formatCompactVnd(p.discountValue)}`, type: "goods" };
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
