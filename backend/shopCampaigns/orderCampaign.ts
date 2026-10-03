import type { Db } from "mongodb";
import { SHOP_ORDERS, type ShopOrderDetail } from "../shopOrders/models.js";
import { normalizeVietnamesePhone } from "../shopPromotions/phoneNormalization.js";
import { syncBus } from "../syncBus.js";
import { campaignEnabled, flashSaleEnabled } from "./flags.js";
import { getCurrentCampaign } from "./currentCampaign.js";
import { resolveRetailStatus } from "./retail.js";
import { applyFlashOffers } from "./flash/flashPricing.js";
import { limitOf, loadFlashOffers } from "./flash/flashOffers.js";
import {
  customerDocId,
  holdCounter,
  holdFlashLines,
  settleCounter,
  settleFlashHolds,
  settleGiftHolds,
  unsellCounter,
  type CounterSpec,
  type FlashHoldRequest,
} from "./flash/flashCounters.js";
import { beginHoldOperation, runHoldOperation } from "./flash/settleOperation.js";
import { buildGiftLines, loadGiftOffers } from "./gifts/giftLines.js";
import { anchorSavingsOf } from "./anchorSales.js";
import type { CampaignHolds, GiftHold } from "./flash/flashTypes.js";
import { FLASH_COUNTERS_COL } from "./types.js";

export type CampaignBuyer = {
  accountId?: string | null;
  account?: Record<string, unknown> | null;
  phone?: string;
  email?: string;
};

export type CampaignHoldPlan = {
  campaignId: string;
  flash: FlashHoldRequest[];
  gifts: { spec: CounterSpec; qty: number }[];
};

export type CampaignPricing = {
  details: ShopOrderDetail[];
  notices: string[];
  flashSavings: number;
  /** Giá trước KM − giá web (chỉ hiển thị, không trừ vào tiền hàng). */
  anchorSavings: number;
  plan: CampaignHoldPlan | null;
};

/** Khoá giới hạn mỗi khách: tài khoản + SĐT (lách bằng tài khoản phụ cùng SĐT vẫn bị tính). */
export function campaignCustomerKeys(buyer: CampaignBuyer): string[] {
  const keys: string[] = [];
  if (buyer.accountId) keys.push(`acc:${buyer.accountId}`);
  const n = normalizeVietnamesePhone(String(buyer.phone || ""));
  if (n.valid && n.normalized) keys.push(`tel:${n.normalized}`);
  return keys;
}

function holdPlanOf(campaignId: string, details: ShopOrderDetail[], limits: Map<string, number>, quotas: Map<string, CounterSpec>): CampaignHoldPlan {
  const flash = new Map<string, FlashHoldRequest>();
  const gifts = new Map<string, { spec: CounterSpec; qty: number }>();
  for (const d of details) {
    if (d.flash) {
      const spec = quotas.get(d.flash.counterId)!;
      const cur = flash.get(spec.id) || { spec, qty: 0, limit: limits.get(spec.id) ?? 1 };
      cur.qty += d.quantity;
      flash.set(spec.id, cur);
    } else if (d.isGift && d.gift) {
      const spec = quotas.get(d.gift.counterId)!;
      const cur = gifts.get(spec.id) || { spec, qty: 0 };
      cur.qty += d.quantity;
      gifts.set(spec.id, cur);
    }
  }
  return { campaignId, flash: [...flash.values()], gifts: [...gifts.values()] };
}

/**
 * Giá chiến dịch cho giỏ / đơn (đã có giá catalog): giá sale trong suất + dòng quà 0đ.
 * Chỉ khách lẻ, tài khoản không khoá, chiến dịch đang bán; đọc trạng thái mới nhất (bỏ cache)
 * để tạm dừng khẩn cấp có hiệu lực ngay khi báo giá / tạo đơn.
 */
export async function priceWithCampaign(db: Db, input: ShopOrderDetail[], buyer: CampaignBuyer, nowMs = Date.now()): Promise<CampaignPricing> {
  const details = input.filter((d) => !d.isGift).map((d) => ({ ...d, flash: undefined, gift: undefined }));
  const none: CampaignPricing = { details, notices: [], flashSavings: 0, anchorSavings: 0, plan: null };
  if (!campaignEnabled() || !flashSaleEnabled() || !details.length) return none;
  const status = await resolveRetailStatus(db, { account: buyer.account, phone: buyer.phone, email: buyer.email });
  if (!status.retail || status.locked) return none;
  const { active } = await getCurrentCampaign(db, nowMs, { isTestBuyer: status.isTestBuyer }, { fresh: true });
  if (!active) return none;
  const mas = [...new Set(details.map((d) => d.productCode))];
  const keys = campaignCustomerKeys(buyer);
  const [offers, giftOffers] = await Promise.all([
    loadFlashOffers(db, active, nowMs, mas, keys),
    loadGiftOffers(db, active, mas, nowMs),
  ]);
  const flash = applyFlashOffers(details, offers);
  const gifts = buildGiftLines(flash.details, giftOffers, active.content.info.name);
  const all = [...flash.details, ...gifts.lines];
  const specs = new Map<string, CounterSpec>();
  const limits = new Map<string, number>();
  for (const o of offers.values()) {
    specs.set(o.counterId, { id: o.counterId, kind: "flash", campaignId: active.id, ma: o.ma, quota: o.quota });
    limits.set(o.counterId, limitOf(o.perCustomerLimit));
  }
  for (const g of [...giftOffers.values()].flat()) specs.set(g.spec.id, g.spec);
  const plan = holdPlanOf(active.id, all, limits, specs);
  const hasHolds = plan.flash.length > 0 || plan.gifts.length > 0;
  return {
    details: all,
    notices: [...flash.notices, ...gifts.notices],
    flashSavings: flash.flashSavings,
    anchorSavings: anchorSavingsOf(active, flash.details, nowMs),
    plan: hasHolds ? plan : null,
  };
}

/** Giữ suất flash + suất quà cho đơn; thiếu suất thì hoàn lại hết (khách báo giá lại). */
export async function holdCampaignPlan(
  db: Db,
  plan: CampaignHoldPlan,
  buyer: CampaignBuyer
): Promise<{ ok: true; holds: CampaignHolds } | { ok: false }> {
  const flash = await holdFlashLines(db, plan.flash, campaignCustomerKeys(buyer));
  if (!flash.ok) return { ok: false };
  const gifts: GiftHold[] = [];
  for (const g of plan.gifts) {
    if (await holdCounter(db, g.spec, g.qty)) {
      gifts.push({ counterId: g.spec.id, qty: g.qty });
      continue;
    }
    await settleFlashHolds(db, flash.holds, "released");
    await settleGiftHolds(db, gifts, "released");
    return { ok: false };
  }
  syncBus.publish([FLASH_COUNTERS_COL], "flash-hold", { ids: plan.flash.map((f) => f.spec.ma) });
  return {
    ok: true,
    holds: { campaignId: plan.campaignId, state: "held", flash: flash.holds, gifts, heldAt: new Date().toISOString() },
  };
}

/** Nhả ngay các suất vừa giữ khi đơn chưa kịp lưu (lỗi bước sau). */
export async function releaseUnsavedHolds(db: Db, holds: CampaignHolds | null): Promise<void> {
  if (!holds) return;
  await settleFlashHolds(db, holds.flash, "released");
  await settleGiftHolds(db, holds.gifts, "released");
}

async function flipState(db: Db, orderCode: string, from: CampaignHolds["state"], to: CampaignHolds["state"]) {
  const doc = await db.collection(SHOP_ORDERS).findOneAndUpdate(
    { code: orderCode, "campaignHolds.state": from },
    { $set: { "campaignHolds.state": to, "campaignHolds.settledAt": new Date().toISOString() } },
    { returnDocument: "before", projection: { campaignHolds: 1 } }
  );
  return (doc?.campaignHolds as CampaignHolds | undefined) || null;
}

/**
 * Đơn thanh toán / giao thành công → `sold`; huỷ / hết hạn / đẩy KV lỗi → `released`.
 * Chỉ lần đổi trạng thái thành công mới cập nhật bộ đếm, nên gọi lặp (xác nhận tay + tự động) vẫn đúng 1 lần;
 * chết giữa chừng thì worker làm nốt theo operationId.
 */
export async function settleCampaignHolds(db: Db, orderCode: string, target: "sold" | "released"): Promise<boolean> {
  const started = await beginHoldOperation(db, orderCode, "held", target);
  if (!started) return false;
  await runHoldOperation(db, orderCode, started.holds, started.op);
  syncBus.publish([FLASH_COUNTERS_COL], "flash-settle", { ids: [orderCode] });
  return true;
}

/** Xoá đơn test: nhả suất đang giữ, hoàn cả suất đã bán để báo cáo không còn tính. */
export async function undoCampaignHoldsForPurge(db: Db, orderCode: string): Promise<void> {
  if (await settleCampaignHolds(db, orderCode, "released")) return;
  const holds = await flipState(db, orderCode, "sold", "released");
  if (!holds) return;
  for (const f of holds.flash) await unsellCounter(db, f.counterId, f.qty, f.customerIds);
  for (const g of holds.gifts) await unsellCounter(db, g.counterId, g.qty);
}

/**
 * Tiền tới sau khi suất đã nhả: còn suất thì chiếm lại và chuyển `sold`; hết thì đánh dấu
 * xử lý tay (không bán vượt số lượng, không mất tiền khách).
 */
export async function reclaimAfterLatePayment(db: Db, orderCode: string): Promise<"reclaimed" | "manual" | "skip"> {
  const holds = await flipState(db, orderCode, "released", "held");
  if (!holds || (!holds.flash.length && !holds.gifts.length)) return "skip";
  const taken: { id: string; qty: number }[] = [];
  const all = [...holds.flash.map((f) => ({ id: f.counterId, qty: f.qty })), ...holds.gifts.map((g) => ({ id: g.counterId, qty: g.qty }))];
  for (const h of all) {
    const r = await db.collection(FLASH_COUNTERS_COL).updateOne(
      { _id: h.id as any, $expr: { $lte: [{ $add: ["$sold", "$held", h.qty] }, "$quota"] } },
      { $inc: { held: h.qty } }
    );
    if (r.modifiedCount === 1) {
      taken.push(h);
      continue;
    }
    for (const t of taken) await settleCounter(db, t.id, t.qty, "released");
    await db.collection(SHOP_ORDERS).updateOne(
      { code: orderCode },
      { $set: { "campaignHolds.state": "released", "campaignHolds.needsReview": true } }
    );
    return "manual";
  }
  for (const f of holds.flash) {
    for (const key of f.customerIds) {
      await db.collection(FLASH_COUNTERS_COL).updateOne({ _id: customerDocId(f.counterId, key) as any }, { $inc: { held: f.qty } });
    }
  }
  await settleCampaignHolds(db, orderCode, "sold");
  return "reclaimed";
}
