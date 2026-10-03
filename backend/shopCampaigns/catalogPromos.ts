import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import type { Request } from "express";
import { requestShopBuyerEmail } from "../shopCatalog/catalog/priceContext.js";
import { isShopTestBuyerEmail } from "../shopOrders/checkoutFlags.js";
import { campaignEnabled } from "./flags.js";
import { getCurrentCampaign, type ActiveCampaign } from "./currentCampaign.js";
import { productGifts } from "./types.js";
import { attachCampaignPromos, type FlashStockLookup, type GiftDetails, type GiftLeft } from "./campaignPromo.js";
import { counterSnapshot } from "./flash/flashCounters.js";
import { giftCounterId } from "./gifts/giftLines.js";
import type { CatalogDealInfo } from "../shopCatalog/catalog/publicProduct.js";

const GIFT_NAME_TTL_MS = 60_000;
const GIFT_LEFT_TTL_MS = 10_000;
const giftNameCache = new Map<string, { at: number; names: GiftDetails }>();
const giftLeftCache = new Map<string, { at: number; left: GiftLeft }>();

/** Tên, ảnh, giá web của sản phẩm quà ("Tặng 1 Túi giấy · trị giá 17K") — cache theo chiến dịch 60 giây. */
async function giftNamesFor(db: Db, active: ActiveCampaign): Promise<GiftDetails> {
  const hit = giftNameCache.get(active.id);
  if (hit && Date.now() - hit.at < GIFT_NAME_TTL_MS) return hit.names;
  const mas = [...new Set(active.content.products.flatMap((p) => productGifts(p).map((g) => g.ma)))];
  const names: GiftDetails = new Map();
  if (mas.length) {
    const rows = await db
      .collection("aloha_products")
      .find({ ma: { $in: mas } }, { projection: { ma: 1, ten: 1, anh: 1, images: 1, giaWeb: 1, giaBan: 1 } })
      .toArray();
    for (const r of rows) {
      const image = String(r.anh || (Array.isArray(r.images) ? r.images[0] : "") || "").trim();
      const value = Math.round(Number(r.giaWeb ?? r.giaBan) || 0);
      names.set(String(r.ma).toUpperCase(), { name: String(r.ten || r.ma), ...(image ? { image } : {}), ...(value > 0 ? { value } : {}) });
    }
  }
  giftNameCache.set(active.id, { at: Date.now(), names });
  return names;
}

/** Suất quà còn lại thật (quota − đã bán − đang giữ) — cache 10 giây vì chỉ để hiển thị. */
async function giftLeftFor(db: Db, active: ActiveCampaign): Promise<GiftLeft> {
  const hit = giftLeftCache.get(active.id);
  if (hit && Date.now() - hit.at < GIFT_LEFT_TTL_MS) return hit.left;
  const specs = active.content.products.flatMap((p) =>
    productGifts(p).filter((g) => g.quota > 0).map((g) => ({ key: `${p.ma}:${g.ma}`, id: giftCounterId(active.id, p.ma, g.ma), quota: g.quota }))
  );
  const snap = await counterSnapshot(db, specs.map((s) => s.id));
  const left: GiftLeft = new Map();
  for (const s of specs) {
    const c = snap.get(s.id);
    left.set(s.key, Math.max(0, s.quota - (c ? Number(c.sold) + Number(c.held) : 0)));
  }
  giftLeftCache.set(active.id, { at: Date.now(), left });
  return left;
}

let stockLookupFactory: ((db: Db, active: ActiveCampaign, nowMs: number) => Promise<FlashStockLookup | undefined>) | null = null;

/** Phần flash sale đăng ký nguồn "Còn x suất" thật tại đây. */
export function setFlashStockLookupFactory(f: typeof stockLookupFactory): void {
  stockLookupFactory = f;
}

/**
 * Mã SP (in hoa, đã sắp xếp) thuộc chiến dịch người xem đang thấy — shop coi như mang nhãn «Ưu đãi»
 * mà không ghi `webBadge`, nên hết chiến dịch / bỏ SP khỏi chiến dịch là nhãn tự mất.
 */
export async function campaignDealMas(db: Db, req: Request): Promise<string[]> {
  if (!campaignEnabled()) return [];
  const isTestBuyer = isShopTestBuyerEmail(requestShopBuyerEmail(req));
  const { active } = await getCurrentCampaign(db, Date.now(), { isTestBuyer });
  if (!active) return [];
  const mas = active.content.products.filter((p) => !p.paused).map((p) => String(p.ma || "").trim().toUpperCase());
  return [...new Set(mas.filter(Boolean))].sort();
}

/** Hậu tố khoá cache: đổi danh sách SP chiến dịch → cache danh sách «Ưu đãi» tự làm mới. */
export function dealMasCacheSuffix(mas: string[]): string {
  return mas.length ? `~${createHash("sha1").update(mas.join(",")).digest("hex").slice(0, 12)}` : "";
}

/** Giá sale / giá gạch / quà của từng SP chiến dịch — để sort «Giảm giá» đưa SP đang ưu đãi lên đầu. */
export async function campaignDealInfo(db: Db, req: Request): Promise<Map<string, CatalogDealInfo>> {
  const out = new Map<string, CatalogDealInfo>();
  if (!campaignEnabled()) return out;
  const isTestBuyer = isShopTestBuyerEmail(requestShopBuyerEmail(req));
  const { active } = await getCurrentCampaign(db, Date.now(), { isTestBuyer });
  if (!active) return out;
  for (const p of active.content.products) {
    const ma = String(p.ma || "").trim().toUpperCase();
    if (!ma || p.paused) continue;
    out.set(ma, {
      salePrice: Math.max(0, Math.round(Number(p.salePrice) || 0)),
      compareAtPrice: Math.max(0, Math.round(Number(p.compareAtPrice) || 0)),
      hasGift: productGifts(p).length > 0,
    });
  }
  return out;
}

export function dealInfoCacheSuffix(deals: Map<string, CatalogDealInfo>): string {
  return dealMasCacheSuffix(
    [...deals].map(([ma, d]) => `${ma}:${d.salePrice}:${d.compareAtPrice}:${d.hasGift ? 1 : 0}`).sort()
  );
}

export type CampaignPromoResult<T> = { items: T[]; noStore: boolean };

/**
 * Gắn `campaignPromo` cho danh sách sản phẩm công khai sau bước cache.
 * Cờ tắt thì trả nguyên dữ liệu cũ (không thêm trường).
 */
export async function withCampaignPromos<T extends { ma: string; gia?: number; webPrice?: number }>(
  db: Db,
  req: Request,
  items: T[]
): Promise<CampaignPromoResult<T>> {
  if (!campaignEnabled() || !items.length) return { items, noStore: false };
  const nowMs = Date.now();
  const isTestBuyer = isShopTestBuyerEmail(requestShopBuyerEmail(req));
  const { active } = await getCurrentCampaign(db, nowMs, { isTestBuyer });
  if (!active) return { items: attachCampaignPromos(items, null, nowMs), noStore: false };
  const [names, stock, giftLeft] = await Promise.all([
    giftNamesFor(db, active),
    stockLookupFactory ? stockLookupFactory(db, active, nowMs) : Promise.resolve(undefined),
    giftLeftFor(db, active).catch(() => undefined),
  ]);
  return {
    items: attachCampaignPromos(items, active, nowMs, names, stock, giftLeft),
    noStore: active.content.info.testOnly,
  };
}
