/**
 * Clawback hoa hồng đã paid_out khi hoàn/trả — nợ CTV trên app nội bộ.
 */
import type { Db } from "mongodb";
import { normalizeCtvCode, SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { SHOP_COMMISSIONS } from "./commissionModels.js";
import { SHOP_ORDERS } from "./models.js";

export const SHOP_CTV_LEDGER = "aloha_shop_ctv_ledger";
export const SHOP_ACCOUNTS_CTV_DEBT_FIELD = "ctvBalanceDebt";

export async function ensureCtvLedgerIndexes(shopDb: Db): Promise<void> {
  try {
    await shopDb.collection(SHOP_CTV_LEDGER).createIndex(
      { ctvCode: 1, createdAt: -1 },
      { background: true }
    );
    await shopDb.collection(SHOP_CTV_LEDGER).createIndex(
      { orderCode: 1, ma: 1, type: 1 },
      { background: true }
    );
  } catch (e) {
    console.warn("[ctv-ledger] indexes", e);
  }
}

/**
 * Tạo bút toán clawback cho mọi dòng HH paid_out của đơn (hoặc 1 mã SP).
 * Idempotent: đã có clawback cùng orderCode+ma+type thì bỏ qua.
 */
export async function clawbackPaidOutCommissions(
  shopDb: Db,
  orderCode: string,
  opts?: { ma?: string; reason?: string; source?: string }
): Promise<{ clawed: number; amount: number }> {
  const code = String(orderCode || "").trim();
  if (!code) return { clawed: 0, amount: 0 };
  await ensureCtvLedgerIndexes(shopDb);

  const filter: Record<string, unknown> = {
    orderCode: code,
    status: "paid_out",
  };
  if (opts?.ma) filter.ma = String(opts.ma).trim().toUpperCase();

  const rows = await shopDb.collection(SHOP_COMMISSIONS).find(filter).toArray();
  const now = new Date().toISOString();
  let clawed = 0;
  let amount = 0;
  const reason = String(opts?.reason || "order_return").slice(0, 200);
  const source = String(opts?.source || "return").slice(0, 80);

  for (const row of rows) {
    const ctv = normalizeCtvCode(String((row as any).ctvCode || ""));
    const ma = String((row as any).ma || "").trim().toUpperCase();
    const amt = Math.max(0, Math.round(Number((row as any).amount) || 0));
    if (!ctv || !ma || amt <= 0) continue;

    const existing = await shopDb.collection(SHOP_CTV_LEDGER).findOne({
      type: "clawback",
      orderCode: code,
      ma,
      ctvCode: ctv,
    });
    if (existing) continue;

    await shopDb.collection(SHOP_CTV_LEDGER).insertOne({
      type: "clawback",
      orderCode: code,
      ma,
      ctvCode: ctv,
      amount: -amt,
      absAmount: amt,
      reason,
      source,
      commissionId: (row as any)._id || null,
      recovered: false,
      createdAt: now,
      updatedAt: now,
    });

    await shopDb.collection(SHOP_COMMISSIONS).updateOne(
      { _id: (row as any)._id },
      {
        $set: {
          clawbackAt: now,
          clawbackAmount: amt,
          clawbackReason: reason,
          needsManualCommissionReview: true,
          updatedAt: now,
        },
      }
    );

    // Cộng nợ CTV trên account (nếu có collection accounts)
    try {
      await shopDb.collection(SHOP_ACCOUNTS).updateOne(
        { ctvCode: ctv },
        {
          $inc: { [SHOP_ACCOUNTS_CTV_DEBT_FIELD]: amt },
          $set: { updatedAt: now },
        }
      );
    } catch {
      /* ignore nếu schema khác */
    }

    clawed += 1;
    amount += amt;
  }

  if (clawed > 0) {
    await shopDb.collection(SHOP_ORDERS).updateOne(
      { $or: [{ code }, { id: code }] },
      {
        $set: {
          needsManualCommissionReview: true,
          commissionClawbackAt: now,
          updatedAt: now,
        },
      }
    );
  }

  return { clawed, amount };
}
