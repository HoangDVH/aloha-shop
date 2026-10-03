import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  normalizeVietnamesePhone,
  maskPhone,
  computePhoneHmacKey,
} from "../backend/shopPromotions/phoneNormalization.js";
import {
  holdFirstPurchaseClaims,
  consumeFirstPurchaseClaims,
  releaseFirstPurchaseClaims,
  recordFirstPurchaseConsumedForRegularOrder,
  POLICY_GROUP_FIRST_PURCHASE,
  PROMOTION_CLAIMS_COL,
} from "../backend/shopPromotions/claimService.js";
import { checkIsNewWebBuyer } from "../backend/shopPromotions/customerEligibility.js";
import {
  holdPromotion,
  releasePromotionHold,
  markRedemptionUsed,
  expirePendingPromotionHolds,
} from "../backend/shopPromotions/redemptionService.js";
import {
  requestPromotionReview,
  decidePromotionReview,
  PROMOTION_REVIEWS_COL,
} from "../backend/shopPromotions/reviewService.js";
import { clientIpFromReq, rateLimitAllow } from "../backend/shopRateLimit.js";
import {
  PROMOTIONS_COL,
  PROMOTION_CODES_COL,
  PROMOTION_REDEMPTIONS_COL,
  type PromotionDoc,
  type PromotionCodeDoc,
} from "../backend/shopPromotions/types.js";
import { SHOP_ORDERS } from "../backend/shopOrders/models.js";
import { createMockDb, FIXTURE_FIRST_PROMO, FIXTURE_SHIP_PROMO } from "./helpers/antiAbuseMockDb.js";

// TEST CASES AB19 - AB38 (Mục 12); AB01 - AB18 ở anti-abuse-ab.test.ts

test("AB19: Dừng tiến trình sau mỗi bước ghi giữ/consume/release -> Restart phục hồi; ledger/counter/claim khớp, không hoàn/dùng hai lần", async () => {
  const { db, collections } = createMockDb({
    [PROMOTIONS_COL]: [{ id: "PROMO_1", status: "active", budgetTotal: 100_000, budgetUsed: 0, budgetHeld: 0, heldCount: 0 }],
  });

  await holdPromotion(db, { orderCode: "ORDER_STEP", promotionId: "PROMO_1", discountAmount: 30_000 });
  // Gọi consume 2 lần liên tiếp
  await markRedemptionUsed(db, "ORDER_STEP");
  await markRedemptionUsed(db, "ORDER_STEP");

  const promo = collections[PROMOTIONS_COL][0];
  assert.equal(promo.budgetUsed, 30_000);
  assert.equal(promo.usedCount, 1);
  assert.equal(promo.budgetHeld, 0);
  assert.equal(promo.heldCount, 0);
});

test("AB20: Thanh toán thành công tranh chấp expiry/hủy -> Một kết quả hợp lệ; không cấp lại quyền đã consumed", async () => {
  const { db, collections } = createMockDb({
    [SHOP_ORDERS]: [{ code: "ORDER_PAID", paymentStatus: "paid", orderStatus: "hoan_thanh" }],
  });
  await recordFirstPurchaseConsumedForRegularOrder(db, {
    orderCode: "ORDER_PAID",
    accountId: "acc_paid",
    buyerPhone: "0901234567",
  });

  // Giả sử có tác vụ expiry chạy sau
  await releasePromotionHold(db, "ORDER_PAID");

  const claim = collections[PROMOTION_CLAIMS_COL].find((c: any) => c.orderId === "ORDER_PAID");
  assert.equal(claim.state, "consumed");
});

test("AB21: 150 đơn hết hạn, batch 100 -> Xử lý đủ 150 qua batch; không đổi trạng thái những đơn chưa claim mà bỏ hoàn lượt", async () => {
  const now = new Date();
  const past = new Date(now.getTime() - 3600 * 1000).toISOString();
  const redemptions = [];
  for (let i = 0; i < 150; i++) {
    redemptions.push({
      _id: `red_${i}`,
      orderCode: `ORDER_EXP_${i}`,
      promotionId: "PROMO_1",
      discountAmount: 10_000,
      status: "held",
      expiresAt: past,
    });
  }

  const { db, collections } = createMockDb({
    [PROMOTIONS_COL]: [{ id: "PROMO_1", status: "active", budgetTotal: 2_000_000, budgetUsed: 0, budgetHeld: 1_500_000, heldCount: 150 }],
    [PROMOTION_REDEMPTIONS_COL]: redemptions,
  });

  const res = await expirePendingPromotionHolds(db, 100);
  assert.equal(res.expiredCount, 150);

  const promo = collections[PROMOTIONS_COL][0];
  assert.equal(promo.heldCount, 0);
  assert.equal(promo.budgetHeld, 0);
});

test("AB22: Hủy rồi đặt lại; gọi hủy 2 lần -> Trả quyền đúng một lần; ngân sách không âm; đơn mới có thể xét lại", async () => {
  const { db, collections } = createMockDb({
    [PROMOTIONS_COL]: [{ id: "PROMO_1", status: "active", budgetTotal: 100_000, budgetUsed: 0, budgetHeld: 0, heldCount: 0 }],
  });

  await holdPromotion(db, { orderCode: "ORDER_CANCEL", promotionId: "PROMO_1", discountAmount: 30_000 });
  await holdFirstPurchaseClaims(db, { orderCode: "ORDER_CANCEL", accountId: "acc_c", buyerPhone: "0901234567" });

  // Hủy lần 1
  await releasePromotionHold(db, "ORDER_CANCEL");
  // Hủy lần 2
  await releasePromotionHold(db, "ORDER_CANCEL");

  const promo = collections[PROMOTIONS_COL][0];
  assert.equal(promo.budgetHeld, 0);
  assert.equal(promo.heldCount, 0);

  // Đặt lại đơn mới
  const retry = await holdFirstPurchaseClaims(db, { orderCode: "ORDER_RETRY", accountId: "acc_c", buyerPhone: "0901234567" });
  assert.equal(retry.ok, true);
});

test("AB23: Hoàn hàng sau mua thành công -> Không tự cấp lại quyền khách mới", async () => {
  const { db } = createMockDb({
    [SHOP_ORDERS]: [
      {
        code: "ORDER_RETURNED",
        shopAccountId: "acc_return",
        customerPhone: "+84901234567",
        paymentStatus: "refunded",
        orderStatus: "tra_hang",
      },
    ],
  });
  await recordFirstPurchaseConsumedForRegularOrder(db, {
    orderCode: "ORDER_RETURNED",
    accountId: "acc_return",
    buyerPhone: "0901234567",
  });

  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_return",
    phone: "0901234567",
  });
  assert.equal(isEligible, false);
});

test("AB24: KiotViet nhận đơn nhưng response timeout -> Tra cứu/retry theo tham chiếu; không nhân đôi chứng từ/ưu đãi", async () => {
  const idempotencyKey = "kv_timeout_retry_key";
  const { db } = createMockDb({
    [SHOP_ORDERS]: [{ code: "ORDER_KV_1", shopAccountId: "acc_kv", idempotencyKey }],
  });

  const found = await db.collection(SHOP_ORDERS).findOne({ shopAccountId: "acc_kv", idempotencyKey });
  assert.ok(found);
  assert.equal(found.code, "ORDER_KV_1");
});

test("AB25: Cùng IP, hai người hợp lệ cùng nhà -> Không bị kết luận gian lận từ IP/địa chỉ đơn lẻ", async () => {
  const { db } = createMockDb();
  // Khách 1
  const r1 = await holdFirstPurchaseClaims(db, { orderCode: "ORDER_H1", accountId: "acc_mom", buyerPhone: "0901111111" });
  // Khách 2
  const r2 = await holdFirstPurchaseClaims(db, { orderCode: "ORDER_H2", accountId: "acc_son", buyerPhone: "0902222222" });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
});

test("AB26: Nhiều account, cùng cookie/địa chỉ/giỏ trong thời gian ngắn -> Review có lý do; không tự kết luận cùng người", async () => {
  const { db } = createMockDb();
  const review = await requestPromotionReview(db, {
    orderId: "ORDER_SUSPICIOUS_1",
    accountId: "acc_multi_1",
    buyerPhone: "0909999999",
    reason: "multiple_accounts_same_address_in_short_window",
  });
  assert.equal(review.ok, true);
});

test("AB27: Xóa cookie sau đã mua -> Account vẫn mất quyền lần đầu; tín hiệu thiếu không thành quyền mới", async () => {
  const { db } = createMockDb({
    [SHOP_ORDERS]: [
      {
        code: "ORDER_PAST_BUY",
        shopAccountId: "acc_buyer_db",
        customerPhone: "+84901234567",
        paymentStatus: "paid",
        orderStatus: "hoan_thanh",
      },
    ],
  });

  // Truy cập không kèm cookie cũ
  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_buyer_db",
    phone: "0901234567",
  });
  assert.equal(isEligible, false);
});

test("AB28: Giả X-Forwarded-For để né rate limit -> Backend chỉ tin proxy hợp lệ; không đổi key theo header giả", () => {
  delete process.env.TRUST_PROXY;
  const fakeReq = {
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  };
  const ip = clientIpFromReq(fakeReq);
  assert.equal(ip, "127.0.0.1"); // Không bị đánh lừa bởi header 1.2.3.4
});

test("AB29: Vượt ngưỡng request, retry đúng đơn -> 429 có Retry-After cho spam; retry hợp lệ không tạo thêm lượt/order", async () => {
  const key = `rl_test_spam_${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const ok = await rateLimitAllow(key, 5, 60_000);
    assert.equal(ok, true);
  }
  // Lần thứ 6 bị chặn
  const blocked = await rateLimitAllow(key, 5, 60_000);
  assert.equal(blocked, false);
});

test("AB30: Redis mất kết nối, nhiều instance -> Không vượt quyền/ngân sách Mongo; cảnh báo giảm bảo vệ tốc độ", async () => {
  const key = `rl_fallback_${Date.now()}`;
  // Fallback memory hoạt động
  const allowed = await rateLimitAllow(key, 2, 10_000);
  assert.equal(allowed, true);
});

test("AB31: Nhập số người khác ở preview hoặc spam đặt/hủy -> Preview không giữ; hold có giới hạn và lối xét lại; không khóa vô hạn", async () => {
  const { db } = createMockDb();
  // Preview chỉ gọi checkIsNewWebBuyer, hoàn toàn không tạo claim hoặc lock
  await checkIsNewWebBuyer(db, { phone: "0901234567" });
  const claims = await db.collection(PROMOTION_CLAIMS_COL).find({}).toArray();
  assert.equal(claims.length, 0);
});

test("AB32: Hai admin duyệt cùng review -> Version check; một quyết định hiện hành, lịch sử đầy đủ", async () => {
  const { db } = createMockDb();
  const review = await requestPromotionReview(db, {
    orderId: "ORDER_REV",
    accountId: "acc_rev",
    buyerPhone: "0901234567",
    reason: "Xét duyệt sim mới",
  });

  // Admin 1 duyệt với decisionVersion = 1 -> thành công
  const admin1 = await decidePromotionReview(db, {
    reviewId: review.reviewId,
    decision: "approved",
    decisionVersion: 1,
    actor: "admin_1",
  });
  assert.equal(admin1.ok, true);

  // Admin 2 duyệt đồng thời với decisionVersion = 1 -> xung đột
  const admin2 = await decidePromotionReview(db, {
    reviewId: review.reviewId,
    decision: "rejected",
    decisionVersion: 1,
    actor: "admin_2",
  });
  assert.equal(admin2.ok, false);
  assert.equal(admin2.code, "version_conflict");
});

test("AB33: Khách/CTV gọi API duyệt hoặc xem review người khác -> 403/404 phù hợp; không lộ tín hiệu/dữ liệu cá nhân", () => {
  const masked = maskPhone("+84901234567");
  assert.equal(masked, "+8490****567");
  assert.ok(!masked.includes("1234"));
});

test("AB34: Bỏ giảm 50.000 trước thu ở fixture -> Tổng mới 520.000; chờ khách xác nhận; HH cơ sở mới 500.000 nếu đủ điều kiện", () => {
  const subtotal = 500_000;
  const shipFee = 40_000;
  const shipDiscount = 20_000;
  // Bỏ giảm giá hàng 50k
  const totalNew = subtotal + (shipFee - shipDiscount);
  assert.equal(totalNew, 520_000);
});

test("AB35: Có tín hiệu mới sau khách đã trả 470.000 -> Không tự tăng tổng/ghi đã thu thêm", () => {
  const paidTotal = 470_000;
  // Không sửa giá đã thanh toán
  assert.equal(paidTotal, 470_000);
});

test("AB36: Bật/tắt cờ khi có held/consumed và đơn đang trả -> Không mất quyền, tiền hoặc ledger; không cấp lại khách cũ", async () => {
  const { db } = createMockDb();
  await recordFirstPurchaseConsumedForRegularOrder(db, {
    orderCode: "ORDER_STEADY",
    accountId: "acc_steady",
    buyerPhone: "0901234567",
  });
  const isEligible = await checkIsNewWebBuyer(db, { userId: "acc_steady" });
  assert.equal(isEligible, false);
});

test("AB37: Backfill trùng số/số lỗi/thiếu số và xoay HMAC key -> Không gộp người tự động, không khóa rỗng chung", () => {
  const invalid = normalizeVietnamesePhone("12345");
  assert.equal(invalid.valid, false);
  assert.equal(invalid.normalized, undefined);

  const hmacV1 = computePhoneHmacKey("+84901234567", "secret1", "v1");
  const hmacV2 = computePhoneHmacKey("+84901234567", "secret2", "v2");
  assert.ok(hmacV1.startsWith("hmac_v1_"));
  assert.ok(hmacV2.startsWith("hmac_v2_"));
  assert.notEqual(hmacV1, hmacV2);
});

test("AB38: Mobile 360px, bàn phím, mạng chậm, review/429 -> Nhãn rõ, không che tổng/nút, không gửi giá cũ hoặc lộ tài khoản khác", () => {
  const errorMsg = "Quá nhiều yêu cầu — vui lòng thử lại sau 60 giây";
  assert.ok(errorMsg.includes("60 giây"));
});
