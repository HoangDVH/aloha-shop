import type { Db } from "mongodb";
import type { ShopOrderDetail } from "../../shopOrders/models.js";
import { subtractHeldFromPublicItems } from "../../shopOrders/stockHold.js";
import type { ActiveCampaign } from "../currentCampaign.js";
import { isSelling } from "../campaignPhase.js";
import { promoRowFor } from "../campaignPromo.js";
import { productGifts, type CampaignProduct } from "../types.js";
import { counterSnapshot, type CounterSpec } from "../flash/flashCounters.js";
import { FLASH_MESSAGES } from "../flash/flashTypes.js";

/** 1 quà kèm 1 mã: mỗi sản phẩm mua được `perUnit` quà, tới khi hết suất quà hoặc hết tồn quà. */
export type GiftOffer = {
  parentMa: string;
  giftMa: string;
  giftName: string;
  perUnit: number;
  spec: CounterSpec;
  /** min(suất quà còn lại, tồn quà còn bán được). */
  remaining: number;
};

/** Mã SP chính → các quà của nó (theo thứ tự admin xếp). Mỗi quà có suất riêng. */
export type GiftOffers = Map<string, GiftOffer[]>;

export const giftCounterId = (campaignId: string, parentMa: string, giftMa: string) =>
  `gift:${campaignId}:${parentMa}:${giftMa}`;

async function giftStock(db: Db, mas: string[]): Promise<Map<string, { ton: number; name: string }>> {
  const docs = await db
    .collection("aloha_products")
    .find({ deletedAt: null, ma: { $in: mas } }, { projection: { ma: 1, ten: 1, ton: 1, onHand: 1, kvTon: 1 } })
    .toArray();
  const items = docs.map((d: any) => ({
    ma: String(d.ma).toUpperCase(),
    ten: String(d.ten || d.ma),
    ton: Math.max(0, Math.floor(Number(d.ton ?? d.onHand ?? d.kvTon) || 0)),
  }));
  const available = await subtractHeldFromPublicItems(db, items);
  return new Map(available.map((i) => [i.ma, { ton: i.ton, name: i.ten }]));
}

export async function loadGiftOffers(db: Db, active: ActiveCampaign, mas: string[], nowMs: number): Promise<GiftOffers> {
  if (!isSelling(active.phase)) return new Map();
  const picked = [...new Set(mas)].map((ma) => promoRowFor(active, ma, nowMs)).filter((p): p is CampaignProduct => Boolean(p));
  const rows = picked.flatMap((p) => productGifts(p).map((g) => ({ parentMa: p.ma, g })));
  if (!rows.length) return new Map();
  const specs = rows.map(({ parentMa, g }) => ({
    parentMa,
    g,
    spec: { id: giftCounterId(active.id, parentMa, g.ma), kind: "gift" as const, campaignId: active.id, ma: g.ma, quota: g.quota },
  }));
  const [counters, stock] = await Promise.all([
    counterSnapshot(db, specs.map((s) => s.spec.id)),
    giftStock(db, [...new Set(rows.map((r) => r.g.ma))]),
  ]);
  const out: GiftOffers = new Map();
  for (const { parentMa, g, spec } of specs) {
    const c = counters.get(spec.id);
    const s = stock.get(g.ma);
    const left = Math.max(0, spec.quota - (c?.sold || 0) - (c?.held || 0));
    const list = out.get(parentMa) || [];
    list.push({ parentMa, giftMa: g.ma, giftName: s?.name || g.ma, perUnit: Math.max(1, g.qty), spec, remaining: Math.min(left, s?.ton ?? 0) });
    out.set(parentMa, list);
  }
  return out;
}

/**
 * Thêm dòng quà 0đ (chỉ server tạo), mỗi quà một dòng. Số quà theo số lượng mua, không vượt suất / tồn
 * của chính quà đó; quà nào hết thì bỏ quà đó (đơn vẫn tạo được) và báo trước ở báo giá.
 */
export function buildGiftLines(
  details: ShopOrderDetail[],
  offers: GiftOffers,
  campaignName: string
): { lines: ShopOrderDetail[]; notices: string[] } {
  const qtyByMa = new Map<string, number>();
  for (const d of details) if (!d.isGift) qtyByMa.set(d.productCode, (qtyByMa.get(d.productCode) || 0) + d.quantity);
  const lines: ShopOrderDetail[] = [];
  const notices: string[] = [];
  for (const [ma, bought] of qtyByMa) {
    for (const o of offers.get(ma) || []) {
      const want = bought * o.perUnit;
      const qty = Math.min(want, o.remaining);
      if (qty <= 0) {
        notices.push(FLASH_MESSAGES.giftOut(o.giftName));
        continue;
      }
      if (qty < want) notices.push(FLASH_MESSAGES.giftLimited(o.giftName, qty));
      lines.push({
        productCode: o.giftMa,
        productName: o.giftName,
        quantity: qty,
        price: 0,
        discount: 0,
        isGift: true,
        gift: { campaignId: o.spec.campaignId, counterId: o.spec.id, giftFor: ma },
        note: `Quà tặng chương trình ${campaignName} (kèm ${ma})`.slice(0, 200),
      });
    }
  }
  return { lines, notices: [...new Set(notices)] };
}
