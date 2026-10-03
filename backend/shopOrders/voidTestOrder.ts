/**
 * Huỷ đơn test: huỷ Đặt hàng / Hoá đơn trên KiotViet (KV không cho xoá cứng qua API),
 * giữ đơn trên web ở trạng thái "Đã huỷ" + nhãn [TEST-WEB] để không tính bán chạy / hoa hồng.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { shopOrderLookupFilter } from "./findShopOrder.js";
import { cancelShopOrderOnKiotViet } from "./kvOrderCancel.js";
import { cancelShopInvoiceOnKiotViet } from "./kvPush.js";
import { voidCommissionsForOrder } from "./commission.js";
import { releaseShopStockHolds } from "./stockHold.js";
import { releasePromotionHold } from "../shopPromotions/redemptionService.js";
import { undoCampaignHoldsForPurge } from "../shopCampaigns/orderCampaign.js";
import { syncBus } from "../syncBus.js";

const PAID_STATES = new Set(["paid", "underpaid", "processing"]);
const SHIPPED_STATES = new Set(["dang_giao", "hoan_thanh"]);
const LOCK_MS = 2 * 60_000;

const hasRef = (v: unknown) => v != null && v !== "";

/** Lý do không cho huỷ đơn test; null = được huỷ. Tiền đã vào hoặc hàng đã đi thì phải xử lý tay. */
export function voidTestBlockReason(o: Record<string, any>): string | null {
  if (o.voidedTestAt) return "Đã huỷ đơn test";
  if (PAID_STATES.has(String(o.paymentStatus || "")) || o.paidAt) return "Đơn đã nhận tiền";
  if (SHIPPED_STATES.has(String(o.orderStatus || "")) || o.done === true) return "Đơn đã giao hoặc đang giao";
  if (String(o.shipment?.status || "") === "created") return "Đã tạo vận đơn";
  return null;
}

export type VoidTestResult =
  | { ok: true; code: string; kvCancelled: string[] }
  | { ok: false; status: number; error: string };

export async function voidTestOrder(args: {
  shopDb: Db;
  mainDb: Db;
  ref: string;
  confirmCode: string;
  actor: string;
}): Promise<VoidTestResult> {
  const { shopDb, mainDb, ref, confirmCode, actor } = args;
  const col = shopDb.collection(SHOP_ORDERS);
  const doc = (await col.findOne(shopOrderLookupFilter(ref))) as Record<string, any> | null;
  if (!doc) return { ok: false, status: 404, error: "Không tìm thấy đơn" };

  const codes = [doc.code, doc.kvOrderCode].filter(Boolean).map((c) => String(c).trim().toUpperCase());
  if (!codes.includes(String(confirmCode || "").trim().toUpperCase())) {
    return { ok: false, status: 400, error: "Mã xác nhận không khớp với mã đơn" };
  }
  const block = voidTestBlockReason(doc);
  if (block) return { ok: false, status: 400, error: `Không huỷ được: ${block}` };

  const lockAt = new Date();
  const locked = await col.updateOne(
    {
      _id: doc._id,
      voidedTestAt: { $exists: false },
      $or: [{ voidTestLockAt: { $exists: false } }, { voidTestLockAt: { $lt: new Date(lockAt.getTime() - LOCK_MS) } }],
    },
    { $set: { voidTestLockAt: lockAt } }
  );
  if (!locked.modifiedCount) return { ok: false, status: 409, error: "Đơn đang được huỷ, vui lòng đợi" };

  const code = String(doc.code);
  const kvCancelled: string[] = [];
  try {
    if (hasRef(doc.kvOrderId) && !doc.kvOrderCancelledAt) {
      const r = await cancelShopOrderOnKiotViet(mainDb, doc.kvOrderId);
      if (!r.ok) {
        return { ok: false, status: 502, error: `KiotViet chưa huỷ được đặt hàng ${doc.kvOrderCode || doc.kvOrderId}: ${r.error}` };
      }
      await col.updateOne({ _id: doc._id }, { $set: { kvOrderCancelledAt: new Date().toISOString() } });
      kvCancelled.push(`Đặt hàng ${doc.kvOrderCode || doc.kvOrderId}`);
    }
    if (hasRef(doc.kvInvoiceId) && !doc.kvInvoiceCancelledAt) {
      try {
        await cancelShopInvoiceOnKiotViet(mainDb, doc.kvInvoiceId);
      } catch (e: any) {
        const done = kvCancelled.length ? `Đã huỷ ${kvCancelled.join(", ")} nhưng ` : "";
        return {
          ok: false,
          status: 502,
          error: `${done}KiotViet chưa huỷ được hoá đơn ${doc.kvInvoiceCode || doc.kvInvoiceId}: ${e?.message || e}. Bấm huỷ lại để thử tiếp.`,
        };
      }
      kvCancelled.push(`Hoá đơn ${doc.kvInvoiceCode || doc.kvInvoiceId}`);
    }

    const now = new Date().toISOString();
    const note = String(doc.customerNote || "");
    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          isTest: true,
          customerNote: note.toUpperCase().includes("[TEST-WEB]") ? note : `[TEST-WEB] ${note}`.trim().slice(0, 255),
          paymentStatus: "cancelled",
          orderStatus: "huy",
          status: "huy",
          statusValue: "Đã hủy (đơn test)",
          voidedTestAt: now,
          voidedTestBy: actor,
          updatedAt: now,
          ...(hasRef(doc.kvInvoiceId) ? { kvInvoiceCancelledAt: doc.kvInvoiceCancelledAt || now, kvInvoiceMode: null } : {}),
        },
      }
    );
    await voidCommissionsForOrder(shopDb, code, { reason: "void_test" }).catch(() => 0);
    await releaseShopStockHolds(shopDb, code).catch(() => 0);
    await releasePromotionHold(shopDb, code).catch(() => undefined);
    await undoCampaignHoldsForPurge(shopDb, code).catch(() => undefined);
    syncBus.publish(["shop_orders"], "void-test", { ids: [code] });
    return { ok: true, code, kvCancelled };
  } finally {
    await col.updateOne({ _id: doc._id }, { $unset: { voidTestLockAt: "" } }).catch(() => undefined);
  }
}
