import type { Db } from "mongodb";
import { normalizeVietnamesePhone } from "./phoneNormalization.js";

export const PROMOTION_CLAIMS_COL = "aloha_shop_promotion_claims";
export const POLICY_GROUP_FIRST_PURCHASE = "first_web_purchase";

export type ClaimIdentityType = "account" | "phone";
export type ClaimState = "held" | "consumed" | "released";

export interface PromotionClaimDoc {
  _id?: any;
  policyGroup: string; // "first_web_purchase"
  identityType: ClaimIdentityType; // "account" | "phone"
  identityKey: string; // accountId hoặc E.164 phone
  orderId: string; // orderCode
  state: ClaimState;
  leaseUntil?: string; // ISO string
  version: number;
  createdAt: string;
  updatedAt: string;
}

export async function ensureClaimIndexes(shopDb: Db): Promise<void> {
  const col = shopDb.collection<PromotionClaimDoc>(PROMOTION_CLAIMS_COL);
  await col.createIndex(
    { policyGroup: 1, identityType: 1, identityKey: 1, state: 1 },
    { name: "claim_policy_identity_state_idx" }
  );
  await col.createIndex({ orderId: 1 }, { name: "claim_order_idx" });
}

export interface HoldClaimResult {
  ok: boolean;
  error?: string;
  code?: "already_consumed" | "held_elsewhere" | "invalid_phone" | "claim_conflict";
}

/**
 * Giữ quyền khách mới cho cả Account ID và Số điện thoại người mua.
 * Khóa hiện hành theo (policyGroup, identityType, identityKey) (mục 6.1).
 * Giữ cả hai khóa cho cùng orderId ổn định; nếu một khóa thuộc đơn khác thì toàn bộ thao tác thất bại.
 */
export async function holdFirstPurchaseClaims(
  shopDb: Db,
  args: {
    orderCode: string;
    accountId: string;
    buyerPhone: string;
    ttlMinutes?: number;
  }
): Promise<HoldClaimResult> {
  const { orderCode, accountId, buyerPhone, ttlMinutes = 60 } = args;

  const phoneRes = normalizeVietnamesePhone(buyerPhone);
  if (!phoneRes.valid || !phoneRes.normalized) {
    return {
      ok: false,
      error: phoneRes.error || "Số điện thoại người mua không hợp lệ để áp dụng ưu đãi khách mới",
      code: "invalid_phone",
    };
  }

  const cleanAccountId = String(accountId || "").trim();
  if (!cleanAccountId) {
    return {
      ok: false,
      error: "Cần tài khoản hợp lệ để giữ quyền khách mới",
      code: "invalid_phone",
    };
  }

  const phoneKey = phoneRes.normalized;
  const col = shopDb.collection<PromotionClaimDoc>(PROMOTION_CLAIMS_COL);
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();

  // 1. Kiểm tra xem account hoặc phone đã từng tiêu thụ quyền (consumed) chưa
  const consumedClaim = await col.findOne({
    policyGroup: POLICY_GROUP_FIRST_PURCHASE,
    $or: [
      { identityType: "account", identityKey: cleanAccountId },
      { identityType: "phone", identityKey: phoneKey },
    ],
    state: "consumed",
  });

  if (consumedClaim) {
    return {
      ok: false,
      error: "Bạn đã từng mua hàng hoặc quyền khách mới đã được sử dụng",
      code: "already_consumed",
    };
  }

  // 2. Kiểm tra xem có đang bị giữ (held) bởi đơn khác và còn trong thời hạn lease không
  const activeHeldClaim = await col.findOne({
    policyGroup: POLICY_GROUP_FIRST_PURCHASE,
    orderId: { $ne: orderCode },
    state: "held",
    $and: [
      {
        $or: [
          { identityType: "account", identityKey: cleanAccountId },
          { identityType: "phone", identityKey: phoneKey },
        ],
      },
      {
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: null },
          { leaseUntil: { $gt: nowIso } },
        ],
      },
    ],
  });

  if (activeHeldClaim) {
    return {
      ok: false,
      error: "Quyền ưu đãi khách mới đang được giữ tại một đơn hàng khác",
      code: "held_elsewhere",
    };
  }

  // 3. Giữ khóa Account
  const accountClaimDoc: PromotionClaimDoc = {
    policyGroup: POLICY_GROUP_FIRST_PURCHASE,
    identityType: "account",
    identityKey: cleanAccountId,
    orderId: orderCode,
    state: "held",
    leaseUntil,
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    // 3. Giữ khóa Account
    const accountRes = await col.findOneAndUpdate(
      {
        policyGroup: POLICY_GROUP_FIRST_PURCHASE,
        identityType: "account",
        identityKey: cleanAccountId,
        $or: [
          { state: "released" },
          { orderId: orderCode },
          { state: "held", leaseUntil: { $lte: nowIso } },
        ],
      },
      {
        $set: {
          orderId: orderCode,
          state: "held",
          leaseUntil,
          updatedAt: nowIso,
        },
        $inc: { version: 1 },
        $setOnInsert: {
          policyGroup: POLICY_GROUP_FIRST_PURCHASE,
          identityType: "account",
          identityKey: cleanAccountId,
          createdAt: nowIso,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    // 4. Giữ khóa Phone
    // Kiểm tra concurrency trên phone
    const phoneResUpdate = await col.findOneAndUpdate(
      {
        policyGroup: POLICY_GROUP_FIRST_PURCHASE,
        identityType: "phone",
        identityKey: phoneKey,
        $or: [
          { state: "released" },
          { orderId: orderCode },
          { state: "held", leaseUntil: { $lte: nowIso } },
        ],
      },
      {
        $set: {
          orderId: orderCode,
          state: "held",
          leaseUntil,
          updatedAt: nowIso,
        },
        $inc: { version: 1 },
        $setOnInsert: {
          policyGroup: POLICY_GROUP_FIRST_PURCHASE,
          identityType: "phone",
          identityKey: phoneKey,
          createdAt: nowIso,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    return { ok: true };
  } catch (e: any) {
    if (e?.code === 11000 || String(e?.message || "").includes("11000") || String(e?.message || "").includes("duplicate")) {
      // Rollback claim account nếu phone bị tranh chấp
      await col.updateOne(
        {
          policyGroup: POLICY_GROUP_FIRST_PURCHASE,
          identityType: "account",
          identityKey: cleanAccountId,
          orderId: orderCode,
          state: "held",
        },
        {
          $set: { state: "released", updatedAt: new Date().toISOString() },
        }
      ).catch(() => {});

      return {
        ok: false,
        error: "Quyền ưu đãi khách mới đang được giữ tại một đơn hàng khác",
        code: "claim_conflict",
      };
    }
    throw e;
  }
}

/**
 * Tiêu thụ quyền (held → consumed) khi đơn hàng thanh toán thành công hoặc COD giao thành công.
 */
export async function consumeFirstPurchaseClaims(
  shopDb: Db,
  orderCode: string
): Promise<{ ok: boolean; modifiedCount: number }> {
  const col = shopDb.collection<PromotionClaimDoc>(PROMOTION_CLAIMS_COL);
  const nowIso = new Date().toISOString();

  const r = await col.updateMany(
    {
      policyGroup: POLICY_GROUP_FIRST_PURCHASE,
      orderId: orderCode,
      state: "held",
    },
    {
      $set: {
        state: "consumed",
        updatedAt: nowIso,
      },
      $inc: { version: 1 },
    }
  );

  return { ok: true, modifiedCount: r.modifiedCount };
}

/**
 * Giải phóng quyền (held → released) khi đơn hàng bị hủy hoặc hết hạn thanh toán.
 */
export async function releaseFirstPurchaseClaims(
  shopDb: Db,
  orderCode: string
): Promise<{ ok: boolean; modifiedCount: number }> {
  const col = shopDb.collection<PromotionClaimDoc>(PROMOTION_CLAIMS_COL);
  const nowIso = new Date().toISOString();

  const r = await col.updateMany(
    {
      policyGroup: POLICY_GROUP_FIRST_PURCHASE,
      orderId: orderCode,
      state: "held",
    },
    {
      $set: {
        state: "released",
        updatedAt: nowIso,
      },
      $inc: { version: 1 },
    }
  );

  return { ok: true, modifiedCount: r.modifiedCount };
}

/**
 * Ghi nhận tiêu thụ quyền khách mới cho đơn mua thành công KHÔNG dùng mã giảm giá (mục 4 & AB09).
 */
export async function recordFirstPurchaseConsumedForRegularOrder(
  shopDb: Db,
  args: {
    orderCode: string;
    accountId?: string;
    buyerPhone?: string;
  }
): Promise<void> {
  const { orderCode, accountId, buyerPhone } = args;
  const col = shopDb.collection<PromotionClaimDoc>(PROMOTION_CLAIMS_COL);
  const nowIso = new Date().toISOString();

  if (accountId) {
    await col.updateOne(
      {
        policyGroup: POLICY_GROUP_FIRST_PURCHASE,
        identityType: "account",
        identityKey: accountId,
      },
      {
        $set: {
          orderId: orderCode,
          state: "consumed",
          updatedAt: nowIso,
        },
        $setOnInsert: {
          policyGroup: POLICY_GROUP_FIRST_PURCHASE,
          identityType: "account",
          identityKey: accountId,
          version: 1,
          createdAt: nowIso,
        },
      },
      { upsert: true }
    );
  }

  if (buyerPhone) {
    const p = normalizeVietnamesePhone(buyerPhone);
    if (p.valid && p.normalized) {
      await col.updateOne(
        {
          policyGroup: POLICY_GROUP_FIRST_PURCHASE,
          identityType: "phone",
          identityKey: p.normalized,
        },
        {
          $set: {
            orderId: orderCode,
            state: "consumed",
            updatedAt: nowIso,
          },
          $setOnInsert: {
            policyGroup: POLICY_GROUP_FIRST_PURCHASE,
            identityType: "phone",
            identityKey: p.normalized,
            version: 1,
            createdAt: nowIso,
          },
        },
        { upsert: true }
      );
    }
  }
}
