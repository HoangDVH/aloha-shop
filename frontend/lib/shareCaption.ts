import type { ShopProduct } from "./api";
import { voucherCustomerTitle } from "./voucherFormat";
import type { AvailablePromotionUI } from "./promotions";
import { productMatchesVoucher } from "./productVoucherScope";
import type { PublicSharePreview } from "../../shared/publicSharePreview";

const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
export const sharePlainText = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
export const shareCaptionWithLink = (caption: string, url: string) => caption.includes(url) ? caption.trim() : `${caption.trim()}\n\n${url}`.trim();

export function publicSharePrice(product: Pick<ShopProduct, "gia" | "webPrice" | "priceKind" | "campaignPromo">, now = Date.now()) {
  const base = Math.max(0, Number(product.webPrice ?? (product.priceKind === "si" || product.priceKind === "si_missing" ? 0 : product.gia)) || 0);
  const p = product.campaignPromo;
  const active = Boolean(p && p.kind !== "teaser" && Date.parse(p.endsAt) > now && p.remaining !== 0);
  const sale = active && p?.kind === "flash" && p.slotOpen && Number(p.salePrice) > 0 && Number(p.salePrice) < p.listPrice;
  const price = sale ? Number(p!.salePrice) : base;
  const reference = sale ? Number(p!.listPrice) : active ? Number(p?.compareAtPrice) || 0 : 0;
  const saving = price > 0 && reference > price ? reference - price : 0;
  return { price, reference: saving ? reference : 0, saving, percent: saving ? Math.round(saving / reference * 100) : 0, active };
}

export function productPriceText(product: Parameters<typeof publicSharePrice>[0], now = Date.now(), unit = "") {
  const p = publicSharePrice(product, now);
  if (!p.price) return "Liên hệ ALOHA để được báo giá";
  const suffix = unit ? `/${sharePlainText(unit)}` : "";
  return p.saving
    ? `Giá ưu đãi: ${money(p.price)}${suffix}\nGiá trước giảm: ${money(p.reference)} — tiết kiệm ${money(p.saving)} (${p.percent}%)`
    : `Giá: ${money(p.price)}${suffix}`;
}

export function shareVoucherLines(product: ShopProduct, offers: AvailablePromotionUI[], now = Date.now()) {
  return offers.filter(p => p.benefitType !== "shipping" && p.targetCustomer !== "wholesale" && p.targetCustomer !== "returning_web"
    && (!p.startDate || Date.parse(p.startDate) <= now) && (!p.endDate || Date.parse(p.endDate) > now)
    && productMatchesVoucher(product, p, now))
    .slice(0, 2).map(p => {
      const conditions = [p.targetCustomer === "new_web" ? "dành cho khách mua lần đầu trên web" : "",
        p.minOrderThreshold ? `đơn ${p.thresholdOperator === ">" ? "trên" : "từ"} ${money(p.minOrderThreshold)}` : "",
        p.maxDiscountVnd ? `giảm tối đa ${money(p.maxDiscountVnd)}` : "", p.claimRequired ? "cần lưu voucher" : ""].filter(Boolean);
      return `• ${sharePlainText(p.title)}${conditions.length ? ` — ${conditions.join(", ")}` : ""}`;
    });
}

export function buildProductCaption(product: ShopProduct, url: string, now = Date.now(), preview?: PublicSharePreview) {
  const price = publicSharePrice(product, now);
  const valid = preview?.ma.toUpperCase() === product.ma.toUpperCase() && Date.parse(preview.expiresAt) > now
    && Number.isFinite(preview.price) && preview.price > 0 && Number.isFinite(preview.finalPrice)
    && preview.finalPrice >= 0 && preview.finalPrice <= preview.price && Number.isFinite(preview.reference) && preview.reference >= preview.price;
  const offer = valid ? preview : undefined;
  const final = offer?.finalPrice ?? price.price;
  const reference = offer?.reference ?? (price.reference || price.price);
  const percent = final < reference ? Math.round((reference - final) / reference * 100) : 0;
  const program = offer?.campaignName ? `ưu đãi ${sharePlainText(offer.campaignName)} ` : "";
  const unit = sharePlainText(product.dvt || "cái");
  const voucher = offer?.voucher;
  const audience = voucher?.targetCustomer === "new_web" ? ", dành cho khách mua lần đầu trên web"
    : voucher?.targetCustomer === "returning_web" ? ", dành cho khách đã mua thành công trên web" : "";
  return [
    `${sharePlainText(product.ten)}${percent > 0 ? ` — ${program}GIẢM ĐẾN ${percent}%!` : ""}`,
    !price.price && !offer ? "Liên hệ ALOHA để được báo giá" : final < reference
      ? `Giá ${money(reference)} chỉ còn ${money(final)}/${unit}` : `Giá ${money(final)}/${unit}`,
    voucher ? `Khi áp dụng voucher “${sharePlainText(voucherCustomerTitle(voucher.title))}” đặt hàng TẠI WEB${audience}${voucher.claimRequired ? ", cần lưu voucher" : ""}.` : "",
    "Chưa gồm phí vận chuyển.",
    `Xem chi tiết & đặt mua tại: ${url}`,
    final < reference ? "Mua ngay để nhận mức giá ưu đãi tốt nhất!" : "Mua ngay tại ALOHA!",
  ].filter(Boolean).join("\n");
}

export function buildArticleCaption(title: string, excerpt: string, url: string, products: Array<{ product: ShopProduct; url: string }> = [], now = Date.now()) {
  const related = products.slice(0, 3).map(({ product, url }) => `${product.ten}\n${productPriceText(product, now)}\n${url}`).join("\n\n");
  return [sharePlainText(title), sharePlainText(excerpt).slice(0, 300), related ? `Sản phẩm liên quan:\n${related}` : "", `Đọc bài viết tại ALOHA: ${url}`].filter(Boolean).join("\n\n");
}
