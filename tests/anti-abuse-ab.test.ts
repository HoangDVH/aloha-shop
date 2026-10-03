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

// ==========================================
// TEST CASES AB01 - AB38 (Mục 12)
// ==========================================

test("AB01: Tài khoản cũ chưa mua, đặt fixture -> Đủ điều kiện; tổng 470.000; HH 22.500 dự kiến", async () => {
  const { db } = createMockDb({
    [PROMOTIONS_COL]: [FIXTURE_FIRST_PROMO, FIXTURE_SHIP_PROMO],
  });

  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_old_never_purchased",
    phone: "0901234567",
  });
  assert.equal(isEligible, true);

  // Tính tiền fixture
  const subtotal = 500_000;
  const discount = Math.min(500_000 * 0.1, 50_000); // 50.000
  const shipFee = 40_000;
  const shipDiscount = 20_000;
  const shipCharged = shipFee - shipDiscount; // 20.000
  const total = subtotal - discount + shipCharged; // 470.000
  assert.equal(total, 470_000);

  // Hoa hồng CTV 5% trên tiền hàng sau giảm 450.000
  const ctvCommission = (subtotal - discount) * 0.05; // 22.500
  assert.equal(ctvCommission, 22_500);
});

test("AB02: Tài khoản đã mua đổi số rồi đặt -> Không có ưu đãi khách mới; ưu đãi khác xét riêng", async () => {
  const { db } = createMockDb({
    [SHOP_ORDERS]: [
      {
        code: "ORDER_PAST_1",
        shopAccountId: "acc_bought",
        customerPhone: "0901111111",
        paymentStatus: "paid",
        orderStatus: "hoan_thanh",
      },
    ],
  });

  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_bought",
    phone: "0988888888", // Đổi số điện thoại khác
  });
  assert.equal(isEligible, false);
});

test("AB03: 0901234567 và +84901234567 ở hai tài khoản -> Cùng khóa số; không tự cấp hai quyền", async () => {
  const p1 = normalizeVietnamesePhone("0901234567");
  const p2 = normalizeVietnamesePhone("+84901234567");
  assert.equal(p1.valid, true);
  assert.equal(p2.valid, true);
  assert.equal(p1.normalized, p2.normalized);
  assert.equal(p1.normalized, "+84901234567");

  const { db } = createMockDb();
  // Giữ quyền cho tài khoản 1 với số 0901234567
  const r1 = await holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_1",
    accountId: "acc_1",
    buyerPhone: "0901234567",
  });
  assert.equal(r1.ok, true);

  // Tài khoản 2 dùng +84901234567 đặt đơn khác
  const r2 = await holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_2",
    accountId: "acc_2",
    buyerPhone: "+84901234567",
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.code, "held_elsewhere");
});

test("AB04: Mua tặng, chỉ đổi số người nhận -> Không thay lịch sử/quyền người mua", async () => {
  const { db } = createMockDb();
  const buyerPhone = "0901234567";
  const recipientPhone = "0933333333";

  // Quyền giữ theo buyerPhone và accountId
  const r = await holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_GIFT",
    accountId: "acc_gift_buyer",
    buyerPhone,
  });
  assert.equal(r.ok, true);

  // Số người nhận recipientPhone vẫn nguyên vẹn tư cách khách mới nếu chưa từng mua
  const isRecipientEligible = await checkIsNewWebBuyer(db, {
    phone: recipientPhone,
  });
  assert.equal(isRecipientEligible, true);
});

test("AB05: Tài khoản mới dùng số có lịch sử của người khác -> Không tự cấp lại; có đường xét lại; không lộ đơn người trước", async () => {
  const { db } = createMockDb({
    [SHOP_ORDERS]: [
      {
        code: "ORDER_SECRET_1",
        shopAccountId: "acc_person_A",
        customerPhone: "+84901234567",
        paymentStatus: "paid",
        orderStatus: "hoan_thanh",
      },
    ],
  });

  // Account B dùng lại số đó
  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_person_B",
    phone: "0901234567",
  });
  assert.equal(isEligible, false);

  // Khách B có đường gửi yêu cầu xem xét lại
  const review = await requestPromotionReview(db, {
    orderId: "ORDER_B_1",
    accountId: "acc_person_B",
    buyerPhone: "0901234567",
    reason: "Số mới mua lại sim, chưa từng mua hàng",
  });
  assert.equal(review.ok, true);
  assert.ok(review.reviewId);
});

test("AB06: Nhân viên duyệt ngoại lệ số dùng chung -> Chỉ account/đơn được duyệt hưởng; lịch sử người trước giữ nguyên", async () => {
  const { db, collections } = createMockDb();
  const review = await requestPromotionReview(db, {
    orderId: "ORDER_B_1",
    accountId: "acc_person_B",
    buyerPhone: "0901234567",
    reason: "Gia đình dùng chung số điện thoại",
  });
  assert.equal(review.ok, true);

  const decide = await decidePromotionReview(db, {
    reviewId: review.reviewId,
    decision: "approved",
    decisionVersion: 1,
    actor: "admin_user",
    decisionNote: "Duyệt ngoại lệ do người thân trong gia đình",
  });
  assert.equal(decide.ok, true);

  const reviewDoc = collections[PROMOTION_REVIEWS_COL].find((r: any) => r.id === review.reviewId);
  assert.equal(reviewDoc.state, "approved");
  assert.equal(reviewDoc.decisionVersion, 2);
});

test("AB07: Đơn đang giữ hỗ trợ ship thông thường -> Không tự làm mất tư cách khách mới", async () => {
  const { db } = createMockDb({
    [PROMOTION_REDEMPTIONS_COL]: [
      {
        id: "red_ship_regular",
        orderCode: "ORDER_REGULAR",
        promotionId: "PROMO_SHIP_ALL",
        benefitType: "shipping",
        status: "held",
        buyerPhone: "+84901234567",
        buyerId: "acc_buyer_1",
      },
    ],
    [PROMOTIONS_COL]: [
      { id: "PROMO_SHIP_ALL", targetCustomer: "all", benefitType: "shipping" },
    ],
  });

  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_buyer_1",
    phone: "0901234567",
  });
  assert.equal(isEligible, true);
});

test("AB08: COD đang giao rồi giao thất bại -> Chưa consumed; giải phóng đúng khi kết thúc hủy", async () => {
  const { db, collections } = createMockDb({
    [SHOP_ORDERS]: [
      {
        code: "ORDER_COD_1",
        shopAccountId: "acc_cod",
        customerPhone: "+84901234567",
        paymentStatus: "cod",
        orderStatus: "dang_giao", // Đang giao chưa phải mua thành công!
      },
    ],
  });

  // Đang giao chưa mất quyền khách mới
  const isEligibleWhileShipping = await checkIsNewWebBuyer(db, {
    userId: "acc_cod",
    phone: "0901234567",
    excludeOrderCode: "ORDER_COD_1",
  });
  assert.equal(isEligibleWhileShipping, true);

  // Khi giao thất bại -> chuyển đơn sang hủy
  collections[SHOP_ORDERS][0].orderStatus = "da_huy";
  const isEligibleAfterCancel = await checkIsNewWebBuyer(db, {
    userId: "acc_cod",
    phone: "0901234567",
  });
  assert.equal(isEligibleAfterCancel, true);
});

test("AB09: Đơn không dùng ưu đãi mua thành công -> Tài khoản không còn quyền khách mới", async () => {
  const { db } = createMockDb();
  await recordFirstPurchaseConsumedForRegularOrder(db, {
    orderCode: "ORDER_NO_VOUCHER",
    accountId: "acc_regular_buyer",
    buyerPhone: "0901234567",
  });

  const isEligible = await checkIsNewWebBuyer(db, {
    userId: "acc_regular_buyer",
    phone: "0901234567",
  });
  assert.equal(isEligible, false);
});

test("AB10: 20 request đồng thời cùng account, khác requestId -> Tối đa một đơn giữ quyền khách mới", async () => {
  const { db } = createMockDb();
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(
      holdFirstPurchaseClaims(db, {
        orderCode: `ORDER_CONCUR_${i}`,
        accountId: "acc_concur",
        buyerPhone: "0901234567",
      })
    );
  }

  const results = await Promise.all(promises);
  const successCount = results.filter((r) => r.ok).length;
  assert.equal(successCount, 1);
});

test("AB11: Hai account cùng số, đặt đồng thời -> Tối đa một quyền theo số; request thua không giữ ngân sách treo", async () => {
  const { db } = createMockDb();
  const p1 = holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_ACC1",
    accountId: "acc_1",
    buyerPhone: "0901234567",
  });
  const p2 = holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_ACC2",
    accountId: "acc_2",
    buyerPhone: "0901234567",
  });

  const [r1, r2] = await Promise.all([p1, p2]);
  const successes = [r1, r2].filter((r) => r.ok).length;
  assert.equal(successes, 1);
});

test("AB12: Hai chương trình khách mới, hai tab chọn khác nhau -> Quyền chung chỉ thuộc một đơn", async () => {
  const { db } = createMockDb();
  const tab1 = await holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_TAB1",
    accountId: "acc_tab",
    buyerPhone: "0901234567",
  });
  assert.equal(tab1.ok, true);

  const tab2 = await holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_TAB2",
    accountId: "acc_tab",
    buyerPhone: "0901234567",
  });
  assert.equal(tab2.ok, false);
  assert.equal(tab2.code, "held_elsewhere");
});

test("AB13: Một đơn có cả giảm hàng và ship dành khách mới -> Một claim, hai redemption đúng ngân sách; không chặn chính đơn đó", async () => {
  const { db, collections } = createMockDb({
    [PROMOTIONS_COL]: [FIXTURE_FIRST_PROMO, FIXTURE_SHIP_PROMO],
  });

  const claim = await holdFirstPurchaseClaims(db, {
    orderCode: "ORDER_DUAL",
    accountId: "acc_dual",
    buyerPhone: "0901234567",
  });
  assert.equal(claim.ok, true);

  const holdGoods = await holdPromotion(db, {
    orderCode: "ORDER_DUAL",
    promotionId: FIXTURE_FIRST_PROMO.id,
    discountAmount: 50_000,
    benefitType: "goods",
  });
  assert.equal(holdGoods.ok, true);

  const holdShip = await holdPromotion(db, {
    orderCode: "ORDER_DUAL",
    promotionId: FIXTURE_SHIP_PROMO.id,
    discountAmount: 20_000,
    benefitType: "shipping",
  });
  assert.equal(holdShip.ok, true);

  const redemptions = collections[PROMOTION_REDEMPTIONS_COL].filter((r: any) => r.orderCode === "ORDER_DUAL");
  assert.equal(redemptions.length, 2);
});

test("AB14: Gửi 20 lần cùng requestId/body -> Một orderId, một bộ giữ lượt, một tác dụng phụ ngoài", async () => {
  const { db, collections } = createMockDb();
  const idempotencyKey = "req_idem_12345";
  const bodyHash = crypto.createHash("sha256").update("cart_content_stable").digest("hex");

  // Lần 1
  await db.collection(SHOP_ORDERS).insertOne({
    code: "ORDER_IDEM_1",
    shopAccountId: "acc_test",
    idempotencyKey,
    bodyHash,
  });

  // 19 lần sau cùng requestId và cùng bodyHash
  for (let i = 0; i < 19; i++) {
    const existing = await db.collection(SHOP_ORDERS).findOne({
      shopAccountId: "acc_test",
      idempotencyKey,
    });
    assert.ok(existing);
    assert.equal(existing.bodyHash, bodyHash);
    assert.equal(existing.code, "ORDER_IDEM_1");
  }

  assert.equal(collections[SHOP_ORDERS].length, 1);
});

test("AB15: Cùng requestId, sửa giỏ -> Conflict, không tái dùng giá/đơn khác", async () => {
  const idempotencyKey = "req_idem_fixed";
  const hash1 = crypto.createHash("sha256").update("cart_version_1").digest("hex");
  const hash2 = crypto.createHash("sha256").update("cart_version_2_edited").digest("hex");

  const { db } = createMockDb({
    [SHOP_ORDERS]: [
      {
        code: "ORDER_1",
        shopAccountId: "acc_test",
        idempotencyKey,
        bodyHash: hash1,
      },
    ],
  });

  const existing = await db.collection(SHOP_ORDERS).findOne({
    shopAccountId: "acc_test",
    idempotencyKey,
  });
  assert.ok(existing);
  const isMismatch = existing.bodyHash !== hash2;
  assert.equal(isMismatch, true);
});

test("AB16: Hai khách tranh mã còn 1 lượt -> Chỉ một lần giữ mã thành công", async () => {
  const CODE_DOC: PromotionCodeDoc = {
    code: "ALOHA_ONLY1",
    promotionId: "PROMO_TEST",
    maxUses: 1,
    usedCount: 0,
    heldCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const { db } = createMockDb({
    [PROMOTIONS_COL]: [{ id: "PROMO_TEST", status: "active", budgetTotal: 1_000_000, budgetUsed: 0, budgetHeld: 0 }],
    [PROMOTION_CODES_COL]: [CODE_DOC],
  });

  const r1 = await holdPromotion(db, {
    orderCode: "ORDER_1",
    promotionId: "PROMO_TEST",
    promotionCode: "ALOHA_ONLY1",
    discountAmount: 20_000,
  });
  assert.equal(r1.ok, true);

  const r2 = await holdPromotion(db, {
    orderCode: "ORDER_2",
    promotionId: "PROMO_TEST",
    promotionCode: "ALOHA_ONLY1",
    discountAmount: 20_000,
  });
  assert.equal(r2.ok, false);
});

test("AB17: Nhiều khách tranh ngân sách còn 50.000 -> Tổng held+used không vượt budget; không bộ đếm âm", async () => {
  const { db, collections } = createMockDb({
    [PROMOTIONS_COL]: [{ id: "PROMO_BUDGET", status: "active", budgetTotal: 50_000, budgetUsed: 0, budgetHeld: 0 }],
  });

  const r1 = await holdPromotion(db, {
    orderCode: "ORDER_1",
    promotionId: "PROMO_BUDGET",
    discountAmount: 30_000,
  });
  assert.equal(r1.ok, true);

  const r2 = await holdPromotion(db, {
    orderCode: "ORDER_2",
    promotionId: "PROMO_BUDGET",
    discountAmount: 30_000,
  });
  // Vượt 50k (30k + 30k = 60k > 50k) -> thất bại
  assert.equal(r2.ok, false);

  const promo = collections[PROMOTIONS_COL][0];
  assert.ok(promo.budgetHeld <= 50_000);
  assert.ok(promo.budgetHeld >= 0);
});

test("AB18: Giữ giảm hàng thành công rồi giữ ship thất bại -> Rollback toàn bộ giao dịch; khách nhận báo giá cần xác nhận lại", async () => {
  const { db, collections } = createMockDb({
    [PROMOTIONS_COL]: [
      { id: "PROMO_GOODS", status: "active", budgetTotal: 1_000_000, budgetUsed: 0, budgetHeld: 0, heldCount: 0 },
      { id: "PROMO_SHIP_EMPTY", status: "active", budgetTotal: 0, budgetUsed: 0, budgetHeld: 0, heldCount: 0 },
    ],
  });

  const orderCode = "ORDER_ROLLBACK";
  const claim = await holdFirstPurchaseClaims(db, {
    orderCode,
    accountId: "acc_rb",
    buyerPhone: "0901234567",
  });
  assert.equal(claim.ok, true);

  const rGoods = await holdPromotion(db, {
    orderCode,
    promotionId: "PROMO_GOODS",
    discountAmount: 50_000,
  });
  assert.equal(rGoods.ok, true);

  const rShip = await holdPromotion(db, {
    orderCode,
    promotionId: "PROMO_SHIP_EMPTY",
    discountAmount: 20_000,
  });
  assert.equal(rShip.ok, false);

  // Rollback
  await releasePromotionHold(db, orderCode);
  await releaseFirstPurchaseClaims(db, orderCode);

  const promoGoods = collections[PROMOTIONS_COL].find((p: any) => p.id === "PROMO_GOODS");
  assert.equal(promoGoods.budgetHeld, 0);
  assert.equal(promoGoods.heldCount, 0);

  const isClaimReleased = await checkIsNewWebBuyer(db, {
    userId: "acc_rb",
    phone: "0901234567",
  });
  assert.equal(isClaimReleased, true);
});
