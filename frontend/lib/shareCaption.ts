import type { ShopProduct } from "./api";
import type { AvailablePromotionUI } from "./promotions";

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

export function productPriceText(product: Parameters<typeof publicSharePrice>[0], now = Date.now()) {
  const p = publicSharePrice(product, now);
  if (!p.price) return "Liên hệ ALOHA để được báo giá";
  return p.saving
    ? `Giá ưu đãi: ${money(p.price)}\nGiá trước giảm: ${money(p.reference)} — tiết kiệm ${money(p.saving)} (${p.percent}%)`
    : `Giá: ${money(p.price)}`;
}

export function shareVoucherLines(product: ShopProduct, offers: AvailablePromotionUI[], now = Date.now()) {
  return offers.filter(p => p.benefitType !== "shipping" && p.targetCustomer !== "wholesale" && p.targetCustomer !== "returning_web"
    && (!p.startDate || Date.parse(p.startDate) <= now) && (!p.endDate || Date.parse(p.endDate) > now)
    && (!p.scope || p.scope === "all" || p.scope === "product" && p.productMas?.includes(product.ma)
      || p.scope === "category" && p.categoryIds?.includes(String(product.categoryId))))
    .slice(0, 2).map(p => {
      const conditions = [p.targetCustomer === "new_web" ? "dành cho khách mua lần đầu trên web" : "",
        p.minOrderThreshold ? `đơn ${p.thresholdOperator === ">" ? "trên" : "từ"} ${money(p.minOrderThreshold)}` : "",
        p.maxDiscountVnd ? `giảm tối đa ${money(p.maxDiscountVnd)}` : "", p.claimRequired ? "cần lưu voucher" : "",
        p.endDate ? `đến ${new Date(p.endDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""].filter(Boolean);
      const description = sharePlainText(p.description || "").slice(0, 180);
      return `• ${p.title}${conditions.length ? ` — ${conditions.join(", ")}` : ""}${description ? `. ${description}` : ""}`;
    });
}

export function buildProductCaption(product: ShopProduct, url: string, now = Date.now(), offers: AvailablePromotionUI[] = []) {
  const price = publicSharePrice(product, now);
  const details = (product.attributes || []).filter(a => a.attributeName && a.attributeValue).slice(0, 3)
    .map(a => `• ${sharePlainText(a.attributeName)}: ${sharePlainText(a.attributeValue)}`);
  const description = sharePlainText(product.description || "").slice(0, 180);
  if (description) details.push(description);
  const promo = product.campaignPromo;
  const gifts = price.active ? (promo?.gifts || []).filter(g => g.qty > 0 && g.left !== 0).map(g => `${g.qty} ${g.name}`).join(", ") : "";
  const benefits = gifts ? [`Quà tặng: ${gifts} (theo điều kiện chương trình)`] : [];
  if (price.active && promo && (price.saving || gifts)) {
    benefits.push(`Ưu đãi đến ${new Date(promo.endsAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}`);
    if (promo.perCustomerLimit > 0) benefits.push(`Tối đa ${promo.perCustomerLimit} sản phẩm/khách theo chương trình`);
  }
  if (product.ton <= 0 && product.allowBackorder !== false) benefits.push("Đặt trước — thời gian giao được xác nhận khi đặt hàng");
  const voucherLines = shareVoucherLines(product, offers, now);
  return [product.ten, productPriceText(product, now), details.join("\n"), benefits.join("\n"),
    voucherLines.length ? `Ưu đãi thanh toán theo điều kiện chương trình:\n${voucherLines.join("\n")}` : "",
    `Xem mẫu và đặt hàng tại ALOHA: ${url}`].filter(Boolean).join("\n\n");
}

export function buildArticleCaption(title: string, excerpt: string, url: string, products: Array<{ product: ShopProduct; url: string }> = [], now = Date.now()) {
  const related = products.slice(0, 3).map(({ product, url }) => `${product.ten}\n${productPriceText(product, now)}\n${url}`).join("\n\n");
  return [sharePlainText(title), sharePlainText(excerpt).slice(0, 300), related ? `Sản phẩm liên quan:\n${related}` : "", `Đọc bài viết tại ALOHA: ${url}`].filter(Boolean).join("\n\n");
}
