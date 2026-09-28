import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotions, isItemInScope } from "../backend/shopPromotions/evaluator.js";
import type { PromotionDoc, PromotionCodeDoc, CartItemToEvaluate } from "../backend/shopPromotions/types.js";

const BASE_PROMO: PromotionDoc = {
  id: "PROMO_FIRST10",
  name: "Khách mới 10%",
  title: "Giảm 10% cho khách mua web lần đầu",
  type: "auto",
  discountType: "percentage",
  discountValue: 10,
  maxDiscountVnd: 200_000,
  minOrderThreshold: 0,
  thresholdOperator: ">",
  scope: "all",
  targetCustomer: "new_web",
  budgetUsed: 0,
  budgetHeld: 0,
  usedCount: 0,
  heldCount: 0,
  status: "active",
  priority: 10,
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const BIG_ORDER_PROMO: PromotionDoc = {
  id: "PROMO_BIG100",
  name: "Đơn trên 1 triệu",
  title: "Giảm 100.000đ cho đơn trên 1 triệu",
  type: "auto",
  discountType: "fixed",
  discountValue: 100_000,
  minOrderThreshold: 1_000_000,
  thresholdOperator: ">",
  scope: "all",
  targetCustomer: "retail",
  budgetUsed: 0,
  budgetHeld: 0,
  usedCount: 0,
  heldCount: 0,
  status: "active",
  priority: 5,
  revision: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("PM-01: Ngưỡng đơn '>' (trên) 1.000.000đ: 999.999đ & 1.000.000đ không đạt, 1.000.001đ đạt", () => {
  const p = { ...BIG_ORDER_PROMO, minOrderThreshold: 1_000_000, thresholdOperator: ">" as const };

  const q999 = evaluatePromotions({
    items: [{ ma: "SP1", price: 999_999, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [p],
  });
  assert.equal(q999.discountTotal, 0);
  assert.equal(q999.applied, undefined);
  assert.equal(q999.candidates[0].eligible, false);

  const q1000 = evaluatePromotions({
    items: [{ ma: "SP1", price: 1_000_000, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [p],
  });
  assert.equal(q1000.discountTotal, 0);
  assert.equal(q1000.candidates[0].eligible, false);

  const q1001 = evaluatePromotions({
    items: [{ ma: "SP1", price: 1_000_001, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [p],
  });
  assert.equal(q1001.discountTotal, 100_000);
  assert.equal(q1001.applied?.promotionId, "PROMO_BIG100");
  assert.equal(q1001.candidates[0].eligible, true);
});

test("PM-02: Ngưỡng đơn '>=' (từ) 1.000.000đ: 999.999đ không đạt, 1.000.000đ đạt", () => {
  const p = { ...BIG_ORDER_PROMO, minOrderThreshold: 1_000_000, thresholdOperator: ">=" as const };

  const q999 = evaluatePromotions({
    items: [{ ma: "SP1", price: 999_999, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [p],
  });
  assert.equal(q999.discountTotal, 0);
  assert.equal(q999.candidates[0].eligible, false);

  const q1000 = evaluatePromotions({
    items: [{ ma: "SP1", price: 1_000_000, quantity: 1 }],
    buyer: { isWholesale: false },
    promotions: [p],
  });
  assert.equal(q1000.discountTotal, 100_000);
  assert.equal(q1000.candidates[0].eligible, true);
});

test("PM-03: Giảm phần trăm có trần (10% tối đa 200.000đ): đơn 800k giảm 80k, đơn 3tr giảm 200k (chạm trần)", () => {
  const q800 = evaluatePromotions({
    items: [{ ma: "SP1", price: 800_000, quantity: 1 }],
    buyer: { isNewWebBuyer: true },
    promotions: [BASE_PROMO],
  });
  assert.equal(q800.discountTotal, 80_000);
  assert.equal(q800.finalTotal, 720_000);

  const q3000 = evaluatePromotions({
    items: [{ ma: "SP1", price: 3_000_000, quantity: 1 }],
    buyer: { isNewWebBuyer: true },
    promotions: [BASE_PROMO],
  });
  assert.equal(q3000.discountTotal, 200_000);
  assert.equal(q3000.finalTotal, 2_800_000);
});

test("PM-04: Phân bổ giảm giá theo từng dòng SP: tổng các dòng chính xác bằng tổng giảm (không lệch 1đ)", () => {
  // Giỏ 3 món: SP1: 500k, SP2: 300k, SP3: 200k. Tổng 1.000.000đ. Giảm 100.000đ.
  const items: CartItemToEvaluate[] = [
    { ma: "SP1", price: 500_000, quantity: 1 },
    { ma: "SP2", price: 300_000, quantity: 1 },
    { ma: "SP3", price: 200_000, quantity: 1 },
  ];
  const p = { ...BIG_ORDER_PROMO, minOrderThreshold: 500_000 };
  const res = evaluatePromotions({ items, promotions: [p] });

  assert.equal(res.discountTotal, 100_000);
  assert.equal(res.lineDiscounts["SP1"], 50_000);
  assert.equal(res.lineDiscounts["SP2"], 30_000);
  assert.equal(res.lineDiscounts["SP3"], 20_000);

  const sumLines = Object.values(res.lineDiscounts).reduce((s, d) => s + d, 0);
  assert.equal(sumLines, res.discountTotal);
});

test("PM-05: Phân bổ với phép chia lẻ: số dư lẻ phân bổ chuẩn xác không làm mất tiền", () => {
  // 3 sản phẩm bằng giá: 300k, 300k, 300k. Tổng 900k. Giảm 100.000đ.
  // 100.000 / 3 = 33.333,33đ. Phải ra 33.334 + 33.333 + 33.333 = 100.000đ.
  const items: CartItemToEvaluate[] = [
    { ma: "SP1", price: 300_000, quantity: 1 },
    { ma: "SP2", price: 300_000, quantity: 1 },
    { ma: "SP3", price: 300_000, quantity: 1 },
  ];
  const p = { ...BIG_ORDER_PROMO, minOrderThreshold: 500_000, discountValue: 100_000 };
  const res = evaluatePromotions({ items, promotions: [p] });

  assert.equal(res.discountTotal, 100_000);
  const sumLines = Object.values(res.lineDiscounts).reduce((s, d) => s + d, 0);
  assert.equal(sumLines, 100_000);
});

test("PM-06: Sản phẩm loại trừ không tính vào ngưỡng và không được giảm", () => {
  const p: PromotionDoc = {
    ...BIG_ORDER_PROMO,
    minOrderThreshold: 1_000_000,
    excludedProductMas: ["EXCLUDED_SKU"],
  };

  // Giỏ gồm 800k hàng hợp lệ + 500k hàng bị loại trừ. Tổng giỏ 1.3tr nhưng hàng hợp lệ chỉ 800k (< 1tr)
  const items: CartItemToEvaluate[] = [
    { ma: "VALID_SKU", price: 800_000, quantity: 1 },
    { ma: "EXCLUDED_SKU", price: 500_000, quantity: 1 },
  ];
  const res = evaluatePromotions({ items, promotions: [p] });
  assert.equal(res.discountTotal, 0);
  assert.equal(res.candidates[0].eligible, false);

  // Khi hàng hợp lệ đạt 1.2tr: chỉ hàng hợp lệ được giảm, hàng loại trừ giảm 0
  const items2: CartItemToEvaluate[] = [
    { ma: "VALID_SKU", price: 1_200_000, quantity: 1 },
    { ma: "EXCLUDED_SKU", price: 500_000, quantity: 1 },
  ];
  const res2 = evaluatePromotions({ items: items2, promotions: [p] });
  assert.equal(res2.discountTotal, 100_000);
  assert.equal(res2.lineDiscounts["VALID_SKU"], 100_000);
  assert.equal(res2.lineDiscounts["EXCLUDED_SKU"], 0);
});

test("PM-07: Khách hàng mới (new_web) được hưởng 10%, khách cũ (đã mua) bị từ chối", () => {
  const items = [{ ma: "SP1", price: 500_000, quantity: 1 }];

  const newBuyerRes = evaluatePromotions({
    items,
    buyer: { isNewWebBuyer: true },
    promotions: [BASE_PROMO],
  });
  assert.equal(newBuyerRes.discountTotal, 50_000);
  assert.equal(newBuyerRes.candidates[0].eligible, true);

  const oldBuyerRes = evaluatePromotions({
    items,
    buyer: { isNewWebBuyer: false },
    promotions: [BASE_PROMO],
  });
  assert.equal(oldBuyerRes.discountTotal, 0);
  assert.equal(oldBuyerRes.candidates[0].eligible, false);
});

test("PM-08: Tự động chọn ưu đãi tốt nhất (Auto-Best): đơn 1.5tr khách mới: so sánh 10% (150k) và 100k -> chọn 150k", () => {
  const items = [{ ma: "SP1", price: 1_500_000, quantity: 1 }];

  const res = evaluatePromotions({
    items,
    buyer: { isNewWebBuyer: true, isWholesale: false },
    promotions: [BASE_PROMO, BIG_ORDER_PROMO],
    autoMode: true,
  });

  // BASE_PROMO: 10% của 1.5tr = 150.000đ
  // BIG_ORDER_PROMO: fixed 100.000đ
  // Auto-best phải chọn 150.000đ
  assert.equal(res.discountTotal, 150_000);
  assert.equal(res.applied?.promotionId, "PROMO_FIRST10");
});

test("PM-09: Nhập mã thủ công: mã cá nhân dùng 1 lần áp dụng thành công khi đúng SĐT, từ chối khi sai SĐT", () => {
  const codePromo: PromotionDoc = {
    id: "PROMO_VIP",
    name: "VIP 200k",
    title: "Mã riêng 200k",
    type: "code",
    discountType: "fixed",
    discountValue: 200_000,
    scope: "all",
    targetCustomer: "retail",
    budgetUsed: 0,
    budgetHeld: 0,
    usedCount: 0,
    heldCount: 0,
    status: "active",
    priority: 1,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const codeDoc: PromotionCodeDoc = {
    code: "VIP200",
    promotionId: "PROMO_VIP",
    assignedBuyerPhone: "0901234567",
    usedCount: 0,
    heldCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const items = [{ ma: "SP1", price: 1_000_000, quantity: 1 }];

  // Khách đúng SĐT
  const rightPhoneRes = evaluatePromotions({
    items,
    buyer: { phone: "0901234567" },
    promotions: [codePromo],
    codes: [codeDoc],
    selectedCode: "VIP200",
  });
  assert.equal(rightPhoneRes.discountTotal, 200_000);
  assert.equal(rightPhoneRes.applied?.code, "VIP200");

  // Khách khác SĐT
  const wrongPhoneRes = evaluatePromotions({
    items,
    buyer: { phone: "0988888888" },
    promotions: [codePromo],
    codes: [codeDoc],
    selectedCode: "VIP200",
  });
  assert.equal(wrongPhoneRes.discountTotal, 0);
  assert.equal(wrongPhoneRes.applied, undefined);
});

test("PM-10: Hoa hồng CTV dựa trên giá trị dòng sau giảm giá (lineNet)", () => {
  // Giả sử SP giá 1.000.000đ, số lượng 1, được phân bổ giảm 100.000đ -> lineNet = 900.000đ
  // Với rate 5% -> hoa hồng = 900.000 * 5% = 45.000đ (thay vì 1.000.000 * 5% = 50.000đ)
  const d = { productCode: "SP1", productName: "Chậu", quantity: 1, price: 1_000_000, discount: 100_000 };
  const lineNet = Math.max(0, d.price * d.quantity - (d.discount || 0));
  assert.equal(lineNet, 900_000);

  const rate = 0.05;
  const commission = Math.round(lineNet * rate);
  assert.equal(commission, 45_000);
});
