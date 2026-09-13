/**
 * Đổi mã hàng loạt WEB-… → kvOrderCode (DH…), giữ legacyCodes.
 */
import type { Db } from "mongodb";
import { SHOP_ORDERS } from "./models.js";
import { SHOP_COMMISSIONS } from "./commissionModels.js";
import { SHOP_CTV_LEDGER } from "./commissionClawback.js";

export type MigrateWebCodesResult = {
  ok: boolean;
  dryRun: boolean;
  candidates: number;
  migrated: Array<{ from: string; to: string }>;
  skipped: Array<{ code: string; reason: string }>;
  errors: Array<{ code: string; error: string }>;
};

export async function migrateWebOrderCodes(
  shopDb: Db,
  opts?: { dryRun?: boolean; limit?: number; codes?: string[] }
): Promise<MigrateWebCodesResult> {
  const dryRun = opts?.dryRun !== false;
  const limit = Math.min(200, Math.max(1, Number(opts?.limit) || 50));
  const filter: Record<string, unknown> = {
    code: { $regex: /^WEB-/i },
    kvOrderCode: { $exists: true, $nin: [null, ""] },
  };
  if (opts?.codes?.length) {
    filter.code = { $in: opts.codes.map((c) => String(c).trim()).filter(Boolean) };
  }

  const rows = await shopDb
    .collection(SHOP_ORDERS)
    .find(filter)
    .limit(limit)
    .toArray();

  const migrated: Array<{ from: string; to: string }> = [];
  const skipped: Array<{ code: string; reason: string }> = [];
  const errors: Array<{ code: string; error: string }> = [];

  for (const row of rows) {
    const from = String((row as any).code || "").trim();
    const to = String((row as any).kvOrderCode || "").trim();
    if (!from || !to) {
      skipped.push({ code: from || "?", reason: "missing_kvOrderCode" });
      continue;
    }
    if (from === to) {
      skipped.push({ code: from, reason: "already_dh" });
      continue;
    }
    const clash = await shopDb.collection(SHOP_ORDERS).findOne({
      code: to,
      _id: { $ne: (row as any)._id },
    });
    if (clash) {
      skipped.push({ code: from, reason: `target_exists:${to}` });
      continue;
    }

    if (dryRun) {
      migrated.push({ from, to });
      continue;
    }

    try {
      const legacy = Array.isArray((row as any).legacyCodes)
        ? [...(row as any).legacyCodes]
        : [];
      if (!legacy.includes(from)) legacy.push(from);

      await shopDb.collection(SHOP_ORDERS).updateOne(
        { _id: (row as any)._id },
        {
          $set: {
            code: to,
            id: to,
            legacyCodes: legacy,
            codeMigratedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }
      );

      await shopDb
        .collection(SHOP_COMMISSIONS)
        .updateMany({ orderCode: from }, { $set: { orderCode: to, updatedAt: new Date().toISOString() } });

      try {
        await shopDb
          .collection(SHOP_CTV_LEDGER)
          .updateMany({ orderCode: from }, { $set: { orderCode: to, updatedAt: new Date().toISOString() } });
      } catch {
        /* collection may not exist yet */
      }

      try {
        await shopDb.collection("aloha_shop_order_notify_sent").updateMany(
          { orderCode: from },
          { $set: { orderCode: to } }
        );
      } catch {
        /* ignore */
      }

      try {
        await shopDb.collection("aloha_shop_stock_holds").updateMany(
          { $or: [{ orderCode: from }, { orderId: from }] },
          { $set: { orderCode: to, orderId: to } }
        );
      } catch {
        /* ignore */
      }

      migrated.push({ from, to });
    } catch (e: any) {
      errors.push({ code: from, error: String(e?.message || e) });
    }
  }

  return {
    ok: errors.length === 0,
    dryRun,
    candidates: rows.length,
    migrated,
    skipped,
    errors,
  };
}
