import type { Db } from "mongodb";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { PROMOTIONS_COL, PROMOTION_REDEMPTIONS_COL, type PromotionDoc } from "./types.js";
import { normalizeVietnamesePhone } from "./phoneNormalization.js";
import { PROMOTION_CLAIMS_COL, POLICY_GROUP_FIRST_PURCHASE } from "./claimService.js";

/**
 * Kiểm tra xem khách hàng có phải là khách mới mua hàng lần đầu trên website không.
 * (docs/KE_HOACH_CHONG_LAM_DUNG_UU_DAI_KHONG_OTP.md mục 4, 5, 6)
 *
 * Nguyên tắc:
 * - Khách mới = chưa có lần mua web thành công.
 * - Đơn thành công: chuyển khoản đủ tiền (paymentStatus === "paid"); COD giao thành công (orderStatus in ["hoan_thanh", "da_giao"]).
 *   Đang giao COD ("dang_giao") hoặc cọc CHƯA tiêu thụ quyền (mục 3, 4).
 * - Không dùng mọi redemption để kết luận khách cũ — chỉ xét các redemption thuộc ưu đãi dành cho khách mới (targetCustomer === "new_web").
 * - Kiểm tra bảng giữ quyền `first_web_purchase` (claims) cho cả Account ID và Số điện thoại chuẩn hóa.
 */
export async function checkIsNewWebBuyer(
  shopDb: Db,
  buyer: { phone?: string; email?: string; userId?: string; excludeOrderCode?: string }
): Promise<boolean> {
  const email = String(buyer.email || "").trim().toLowerCase();
  const userId = String(buyer.userId || "").trim();
  const phoneRes = buyer.phone ? normalizeVietnamesePhone(buyer.phone) : null;

  // Nếu không có bất kỳ thông tin định danh nào, tạm thời coi là chưa xác định
  if ((!phoneRes || !phoneRes.valid) && !email && !userId) {
    return true;
  }

  const identityQueries: Array<Record<string, unknown>> = [];
  if (phoneRes && phoneRes.valid && phoneRes.normalized) {
    identityQueries.push({ customerPhone: phoneRes.normalized });
    if (phoneRes.localPhone) {
      identityQueries.push({ customerPhone: phoneRes.localPhone });
    }
  }
  if (email) {
    identityQueries.push({ customerEmail: email });
    identityQueries.push({ "account.email": email });
  }
  if (userId) {
    identityQueries.push({ shopAccountId: userId });
  }

  // 1. Kiểm tra đơn hàng cũ đã từng mua thành công (paid hoặc COD đã giao)
  if (identityQueries.length > 0) {
    const pastSuccessfulOrder = await shopDb.collection(SHOP_ORDERS).findOne({
      $or: identityQueries,
      ...(buyer.excludeOrderCode
        ? { code: { $ne: buyer.excludeOrderCode }, id: { $ne: buyer.excludeOrderCode } }
        : {}),
      $and: [
        {
          orderStatus: {
            $nin: ["da_huy", "huy", "that_bai", "cancelled"],
          },
        },
        {
          $or: [
            { paymentStatus: "paid" },
            { orderStatus: { $in: ["hoan_thanh", "da_giao"] } },
            { done: true },
          ],
        },
      ],
    });

    if (pastSuccessfulOrder) {
      return false;
    }
  }

  const nowIso = new Date().toISOString();

  // 2. Kiểm tra bảng quản lý quyền khách mới (aloha_shop_promotion_claims)
  const claimQueries: Array<Record<string, unknown>> = [];
  if (userId) {
    claimQueries.push({ identityType: "account", identityKey: userId });
  }
  if (phoneRes && phoneRes.valid && phoneRes.normalized) {
    claimQueries.push({ identityType: "phone", identityKey: phoneRes.normalized });
  }

  if (claimQueries.length > 0) {
    // 2.1 Đã consumed quyền khách mới
    const consumedClaim = await shopDb.collection(PROMOTION_CLAIMS_COL).findOne({
      policyGroup: POLICY_GROUP_FIRST_PURCHASE,
      $or: claimQueries,
      state: "consumed",
    });
    if (consumedClaim) {
      return false;
    }

    // 2.2 Đang held quyền ở một đơn hàng khác (còn trong thời hạn lease)
    const activeHeldClaim = await shopDb.collection(PROMOTION_CLAIMS_COL).findOne({
      policyGroup: POLICY_GROUP_FIRST_PURCHASE,
      state: "held",
      ...(buyer.excludeOrderCode ? { orderId: { $ne: buyer.excludeOrderCode } } : {}),
      $and: [
        { $or: claimQueries },
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
      return false;
    }
  }

  // 3. Kiểm tra redemption cũ: CHỈ xét các ưu đãi dành cho khách mới (targetCustomer === "new_web")
  // Không dùng mọi redemption của ưu đãi thông thường (như đơn lớn, ship) để kết luận khách cũ (mục 3)
  const newWebPromoIds = await shopDb
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .find({ targetCustomer: "new_web" }, { projection: { id: 1 } })
    .toArray()
    .then((docs) => docs.map((d) => d.id));

  if (newWebPromoIds.length > 0) {
    const activeHeldRedemption = await shopDb.collection(PROMOTION_REDEMPTIONS_COL).findOne({
      promotionId: { $in: newWebPromoIds },
      $or: [
        ...(phoneRes && phoneRes.valid && phoneRes.normalized
          ? [{ buyerPhone: phoneRes.normalized }, ...(phoneRes.localPhone ? [{ buyerPhone: phoneRes.localPhone }] : [])]
          : []),
        ...(email ? [{ buyerEmail: email }] : []),
        ...(userId ? [{ buyerId: userId }] : []),
      ],
      ...(buyer.excludeOrderCode ? { orderCode: { $ne: buyer.excludeOrderCode } } : {}),
      status: { $in: ["held", "used"] },
    });

    if (activeHeldRedemption) {
      return false;
    }
  }

  return true;
}
