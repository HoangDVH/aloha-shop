import type { Db } from "mongodb";
import { SHOP_ORDERS, type ShopOrderDetail } from "../../shopOrders/models.js";
import { syncBus } from "../../syncBus.js";
import { FLASH_COUNTERS_COL } from "../types.js";
import { settleFlashHolds, settleGiftHolds } from "./flashCounters.js";
import type { CampaignHolds, FlashHold, GiftHold } from "./flashTypes.js";

/** Mã sản phẩm là đoạn cuối của id bộ đếm (`…:ALLDAY:MA`, `gift:camp:parent:MA`). */
const maOf = (counterId: string) => counterId.slice(counterId.lastIndexOf(":") + 1);

function qtyBy(details: ShopOrderDetail[], pick: (d: ShopOrderDetail) => boolean): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of details) if (pick(d)) out.set(d.productCode, (out.get(d.productCode) || 0) + d.quantity);
  return out;
}

function keepWithin<T extends { counterId: string; qty: number }>(holds: T[], avail: Map<string, number>): T[] {
  return holds.map((h) => {
    const ma = maOf(h.counterId);
    const keep = Math.min(h.qty, Math.max(0, avail.get(ma) || 0));
    avail.set(ma, (avail.get(ma) || 0) - keep);
    return { ...h, qty: keep };
  });
}

function diffOf<T extends { counterId: string; qty: number }>(before: T[], after: T[]): T[] {
  return before.map((h, i) => ({ ...h, qty: h.qty - after[i].qty })).filter((h) => h.qty > 0);
}

/**
 * `details` là dòng đã đồng bộ từ KiotViet, đã gắn lại `flash` / `isGift` theo mã + giá của dòng cũ.
 * Nhân viên giảm số lượng / bỏ dòng trên KiotViet rồi đồng bộ tiền: suất đang giữ vượt số còn lại
 * được trả về bộ đếm (flash + quà), `flashSavings` tính lại. Ghi đơn trước (có điều kiện trên holds cũ)
 * rồi mới trả suất, nên gọi lặp / song song chỉ trả 1 lần và không bộ đếm nào âm.
 */
export async function trimCampaignHolds(db: Db, orderCode: string, details: ShopOrderDetail[]): Promise<boolean> {
  const col = db.collection(SHOP_ORDERS);
  const order = await col.findOne({ code: orderCode, "campaignHolds.state": "held" }, { projection: { campaignHolds: 1 } });
  const holds = order?.campaignHolds as CampaignHolds | undefined;
  if (!order || !holds) return false;
  const nextFlash = keepWithin<FlashHold>(holds.flash, qtyBy(details, (d) => Boolean(d.flash)));
  const nextGifts = keepWithin<GiftHold>(holds.gifts, qtyBy(details, (d) => Boolean(d.isGift)));
  const freedFlash = diffOf(holds.flash, nextFlash);
  const freedGifts = diffOf(holds.gifts, nextGifts);
  if (!freedFlash.length && !freedGifts.length) return false;
  const flashSavings = details.reduce(
    (n, d) => n + (d.flash ? Math.max(0, d.flash.listPrice - d.flash.salePrice) * d.quantity : 0),
    0
  );
  const r = await col.updateOne(
    { _id: order._id, "campaignHolds.state": "held", "campaignHolds.flash": holds.flash, "campaignHolds.gifts": holds.gifts },
    {
      $set: {
        "campaignHolds.flash": nextFlash.filter((h) => h.qty > 0),
        "campaignHolds.gifts": nextGifts.filter((h) => h.qty > 0),
        flashSavings,
      },
    }
  );
  if (r.modifiedCount !== 1) return false;
  await settleFlashHolds(db, freedFlash, "released");
  await settleGiftHolds(db, freedGifts, "released");
  syncBus.publish([FLASH_COUNTERS_COL], "flash-trim", { ids: [orderCode] });
  return true;
}
