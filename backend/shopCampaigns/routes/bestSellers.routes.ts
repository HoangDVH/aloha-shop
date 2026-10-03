import type { Express } from "express";
import type { Db } from "mongodb";
import { applyShopCors } from "../../shopCors.js";
import { requestShopBuyerEmail } from "../../shopCatalog/catalog/priceContext.js";
import { isShopTestBuyerEmail } from "../../shopOrders/checkoutFlags.js";
import { campaignEnabled } from "../flags.js";
import { getCurrentCampaign } from "../currentCampaign.js";
import { loadAnchorSold } from "../anchorSales.js";

type GetDb = () => Promise<Db>;

/** Dưới mức này không khoe "Đã bán" (số quá nhỏ làm giảm uy tín). */
export const BEST_SELLER_MIN_SOLD = 3;
export const BEST_SELLER_LIMIT = 3;
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; items: BestSeller[] }>();

export type BestSeller = { ma: string; sold: number };

/** Top SP chiến dịch theo số bán thật; hoà thì giữ thứ tự admin xếp trong chiến dịch. */
export function topSellers(mas: string[], sold: Map<string, number>, min = BEST_SELLER_MIN_SOLD, limit = BEST_SELLER_LIMIT): BestSeller[] {
  const order = new Map(mas.map((m, i) => [m, i]));
  return [...new Set(mas)]
    .map((ma) => ({ ma, sold: sold.get(ma) ?? 0 }))
    .filter((x) => x.sold >= min)
    .sort((a, b) => b.sold - a.sold || (order.get(a.ma) ?? 0) - (order.get(b.ma) ?? 0))
    .slice(0, limit);
}

export function registerCampaignBestSellerRoutes(app: Express, getDb: GetDb) {
  app.get("/api/shop/campaigns/best-sellers", async (req, res) => {
    applyShopCors(req, res);
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!campaignEnabled()) return res.json({ ok: true, items: [] });
      const db = await getDb();
      const isTestBuyer = isShopTestBuyerEmail(requestShopBuyerEmail(req));
      const { active } = await getCurrentCampaign(db, Date.now(), { isTestBuyer });
      if (!active) return res.json({ ok: true, items: [] });
      const key = `${active.id}:${active.publishedAt || ""}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL_MS) return res.json({ ok: true, items: hit.items });
      const mas = active.content.products.filter((p) => !p.paused).map((p) => String(p.ma || "").toUpperCase()).filter(Boolean);
      const items = topSellers(mas, await loadAnchorSold(db, active, [...new Set(mas)]));
      if (cache.size > 20) cache.clear();
      cache.set(key, { at: Date.now(), items });
      res.json({ ok: true, items });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải sản phẩm bán chạy" });
    }
  });
}
