import type { Db } from "mongodb";
import type { ShopOrderDetail } from "../models.js";
import type { StepFail } from "./stepResult.js";
import {
  holdCampaignPlan,
  priceWithCampaign,
  type CampaignBuyer,
  type CampaignHoldPlan,
} from "../../shopCampaigns/orderCampaign.js";
import { FLASH_MESSAGES, type CampaignHolds } from "../../shopCampaigns/flash/flashTypes.js";

export type CampaignPriced = {
  ok: true;
  details: ShopOrderDetail[];
  notices: string[];
  flashSavings: number;
  anchorSavings: number;
  plan: CampaignHoldPlan | null;
};

export function goodsSubtotal(details: ShopOrderDetail[]): number {
  return details.reduce((n, d) => n + d.price * d.quantity, 0);
}

/** Client không được tự gửi dòng quà; quà chỉ do server tạo lại. */
export function dropClientGiftLines(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.filter((d: any) => d?.isGift !== true);
}

/**
 * Giá sale + quà cho đơn. Khách gửi `expectedSubtotal` (tổng hàng đã thấy ở bước báo giá);
 * server tính ra cao hơn (hết khung giờ / hết suất) thì trả 409 để khách xác nhận giá mới.
 */
export async function priceOrderWithCampaign(
  db: Db,
  details: ShopOrderDetail[],
  buyer: CampaignBuyer,
  expectedSubtotal: unknown
): Promise<CampaignPriced | StepFail> {
  const r = await priceWithCampaign(db, details, buyer);
  const expected = Number(expectedSubtotal);
  const subtotal = goodsSubtotal(r.details);
  if (Number.isFinite(expected) && expected > 0 && subtotal > Math.round(expected)) {
    return {
      ok: false,
      status: 409,
      body: {
        code: "price_changed",
        error: r.notices[0] || FLASH_MESSAGES.slotEnded,
        notices: r.notices,
        details: r.details,
        subtotal,
      },
    };
  }
  return { ok: true, ...r };
}

/** Giữ suất ngay trước khi lưu đơn; hết suất giữa chừng thì khách báo giá lại. */
export async function holdOrderCampaign(
  db: Db,
  plan: CampaignHoldPlan | null,
  buyer: CampaignBuyer
): Promise<{ ok: true; holds: CampaignHolds | null } | StepFail> {
  if (!plan) return { ok: true, holds: null };
  const r = await holdCampaignPlan(db, plan, buyer);
  if (r.ok === false) {
    return {
      ok: false,
      status: 409,
      body: { code: "price_changed", error: FLASH_MESSAGES.soldOut, notices: [FLASH_MESSAGES.soldOut] },
    };
  }
  return { ok: true, holds: (r as { holds: CampaignHolds }).holds };
}
