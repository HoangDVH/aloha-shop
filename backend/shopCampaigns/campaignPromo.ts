import type { ActiveCampaign } from "./currentCampaign.js";
import { isSelling, nextSlotOpen, openSlotWindow } from "./campaignPhase.js";
import { productGifts, type CampaignGift, type CampaignProduct, type CampaignPromo, type CampaignSlot } from "./types.js";

type PromoItem = { ma: string; gia?: number; webPrice?: number; ten?: string };

/** Số liệu suất thật (điền ở phần flash sale); thiếu thì để null, UI không hiện. */
export type FlashStockLookup = (
  p: CampaignProduct,
  counterId: string | null
) => { remaining: number; soldPct: number; sold: number } | null;

export type GiftMeta = { name: string; image?: string; value?: number };
/** Tên quà theo mã (bản cũ chỉ có tên) hoặc kèm ảnh / giá web. */
export type GiftDetails = Map<string, string | GiftMeta>;
/** Suất quà còn lại theo khoá `${mã SP chính}:${mã quà}`. */
export type GiftLeft = Map<string, number>;

type Candidate = { p: CampaignProduct; slot: CampaignSlot | null; open: boolean; opensAt: number | null };

function candidatesFor(active: ActiveCampaign, ma: string, nowMs: number): Candidate[] {
  const slots = new Map(active.content.slots.map((s) => [s.key, s]));
  return active.content.products
    .filter((p) => p.ma === ma && !p.paused)
    .map((p) => {
      const slot = p.slotKey ? slots.get(p.slotKey) || null : null;
      const open = Boolean(openSlotWindow(slot, nowMs));
      return { p, slot, open, opensAt: slot && !open ? nextSlotOpen(slot, nowMs) : null };
    });
}

/** Ưu tiên dòng khung đang mở, rồi dòng cả ngày, sau đó dòng mở sớm nhất. */
function bestCandidate(list: Candidate[]): Candidate | null {
  const open = list.find((c) => c.open && c.slot) || list.find((c) => c.open);
  if (open) return open;
  return [...list].sort((a, b) => (a.opensAt ?? Infinity) - (b.opensAt ?? Infinity))[0] || null;
}

/** Dòng chiến dịch đang áp cho 1 mã — card và đơn hàng dùng chung để giá / quà khách thấy khớp lúc đặt. */
export function promoRowFor(active: ActiveCampaign, ma: string, nowMs: number): CampaignProduct | null {
  return bestCandidate(candidatesFor(active, ma, nowMs))?.p || null;
}

function promoKind(c: Candidate, selling: boolean, anchor: number): CampaignPromo["kind"] | null {
  if (c.p.salePrice > 0) return selling ? "flash" : "teaser";
  if (productGifts(c.p).length) return "gift";
  return c.p.dealHot || anchor > 0 ? "deal" : null;
}

/** 1 quà: "Tặng 1 Hộp quà"; nhiều quà: "Tặng kèm 3 quà" (danh sách chi tiết ở `gifts`). */
function giftLabelOf(gifts: CampaignPromo["gifts"]): string | null {
  if (!gifts.length) return null;
  if (gifts.length === 1) return `Tặng ${gifts[0].qty} ${gifts[0].name}`;
  return `Tặng kèm ${gifts.length} quà`;
}

function giftView(g: CampaignGift, parentMa: string, details: GiftDetails, left?: GiftLeft): CampaignPromo["gifts"][number] {
  const d = details.get(g.ma);
  const meta: GiftMeta | undefined = typeof d === "string" ? { name: d } : d;
  const l = left?.get(`${parentMa}:${g.ma}`);
  return {
    ma: g.ma,
    name: meta?.name || g.ma,
    qty: g.qty,
    ...(meta?.image ? { image: meta.image } : {}),
    ...(meta?.value && meta.value > 0 ? { value: meta.value } : {}),
    ...(l != null ? { left: Math.max(0, l) } : {}),
  };
}

export function buildCampaignPromo(
  active: ActiveCampaign,
  item: PromoItem,
  nowMs: number,
  giftNames: GiftDetails,
  stock?: FlashStockLookup,
  giftLeft?: GiftLeft
): CampaignPromo | null {
  const c = bestCandidate(candidatesFor(active, String(item.ma || "").toUpperCase(), nowMs));
  if (!c) return null;
  const selling = isSelling(active.phase);
  const listPrice = Math.round(Number(item.webPrice ?? item.gia) || 0);
  const anchorRaw = Math.round(Number(c.p.compareAtPrice) || 0);
  const anchor = selling && !(c.p.salePrice > 0) && listPrice > 0 && anchorRaw > listPrice ? anchorRaw : 0;
  const kind = promoKind(c, selling, anchor);
  if (!kind) return null;
  if (c.p.salePrice > 0 && !(c.p.salePrice < listPrice)) return null;
  const s = selling && ((kind === "flash" && c.open) || anchor > 0) ? stock?.(c.p, null) : null;
  const gifts = productGifts(c.p).map((g) => giftView(g, c.p.ma, giftNames, giftLeft));
  return {
    campaignId: active.id,
    kind,
    salePrice: c.p.salePrice > 0 ? c.p.salePrice : null,
    listPrice,
    compareAtPrice: anchor || null,
    endsAt: selling ? active.content.info.endAt : active.content.info.startAt,
    slotKey: c.p.slotKey || null,
    slotOpen: selling && c.open,
    opensAt: c.opensAt ? new Date(c.opensAt).toISOString() : null,
    remaining: s ? s.remaining : null,
    soldPct: s ? s.soldPct : null,
    soldQty: s ? s.sold : null,
    giftLabel: giftLabelOf(gifts),
    gifts,
    perCustomerLimit: c.p.perCustomerLimit,
  };
}

/** Gắn `campaignPromo` (null nếu không thuộc chiến dịch) — card thường giữ nguyên. */
export function attachCampaignPromos<T extends PromoItem>(
  items: T[],
  active: ActiveCampaign | null,
  nowMs: number,
  giftNames: GiftDetails = new Map(),
  stock?: FlashStockLookup,
  giftLeft?: GiftLeft
): Array<T & { campaignPromo: CampaignPromo | null }> {
  return items.map((it) => ({
    ...it,
    campaignPromo: active ? buildCampaignPromo(active, it, nowMs, giftNames, stock, giftLeft) : null,
  }));
}
