import type { Db } from "mongodb";
import { SHOP_ORDERS } from "../shopOrders/models.js";
import { PROMOTION_REDEMPTIONS_COL } from "./types.js";

/**
 * Kiểm tra xem khách hàng có phải là khách mới mua hàng lần đầu trên website không.
 * Nếu đã có bất kỳ đơn hàng nào thành công (paid, cod delivered, etc.)
 * hoặc có lượt giữ ưu đãi lần đầu chưa giải phóng -> false.
 */
export async function checkIsNewWebBuyer(
  shopDb: Db,
  buyer: { phone?: string; email?: string; userId?: string }
): Promise<boolean> {
  const phone = String(buyer.phone || "").trim().replace(/\D/g, "");
  const email = String(buyer.email || "").trim().toLowerCase();
  const userId = String(buyer.userId || "").trim();

  // Nếu không có bất kỳ thông tin định danh nào, tạm thời coi là chưa xác định
  if (!phone && !email && !userId) {
    return true;
  }

  const identityQueries: Array<Record<string, unknown>> = [];
  if (phone) {
    identityQueries.push({ customerPhone: phone });
    // Cũng kiểm tra định dạng số điện thoại khác
    identityQueries.push({ customerPhone: `0${phone.replace(/^84/, "")}` });
  }
  if (email) {
    identityQueries.push({ customerEmail: email });
    identityQueries.push({ "account.email": email });
  }
  if (userId) {
    identityQueries.push({ shopAccountId: userId });
  }

  if (!identityQueries.length) return true;

  // 1. Kiểm tra đơn hàng cũ đã từng hoàn tất hoặc đã thanh toán
  const pastSuccessfulOrder = await shopDb.collection(SHOP_ORDERS).findOne({
    $or: identityQueries,
    $and: [
      {
        orderStatus: {
          $nin: ["da_huy", "huy", "that_bai", "cancelled"],
        },
      },
      {
        $or: [
          { paymentStatus: "paid" },
          { orderStatus: { $in: ["hoan_thanh", "da_giao", "dang_giao"] } },
          { done: true },
        ],
      },
    ],
  });

  if (pastSuccessfulOrder) {
    return false;
  }

  // 2. Kiểm tra xem có đang giữ (held) lượt của ưu đãi lần đầu cho đơn hàng nào khác không
  const activeHeldRedemption = await shopDb.collection(PROMOTION_REDEMPTIONS_COL).findOne({
    $or: [
      ...(phone ? [{ buyerPhone: phone }] : []),
      ...(email ? [{ buyerEmail: email }] : []),
      ...(userId ? [{ buyerId: userId }] : []),
    ],
    status: { $in: ["held", "used"] },
  });

  if (activeHeldRedemption) {
    return false;
  }

  return true;
}
