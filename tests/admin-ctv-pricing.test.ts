import test from "node:test";
import assert from "node:assert/strict";
import { holdCommissionsForOrder } from "../backend/shopOrders/commission.js";
import { splitLineDiscounts } from "../backend/shopOrders/create/orderPromotions.js";
import { calculateTierPrice } from "../frontend/lib/volumePricing.js";
import { getCtvConversions } from "../backend/shopOrders/ctvMe/conversions.service.js";

function fixture() {
  const commissions = new Map<string, any>();
  const db: any = { collection(name: string) { return {
    async findOne() {
      if (name === "aloha_shop_settings") return { defaultCommissionRate: 5, phoneRepeatSoftWarn: false };
      if (name === "aloha_shop_accounts") return { id: "affiliate", ctvStatus: "active" };
      return null;
    },
    async updateOne(filter: any, update: any) {
      if (name === "aloha_shop_commissions") commissions.set(`${filter.ma}:${filter.ctvCode}`, update.$set);
      return { modifiedCount: 1 };
    },
  }; } };
  return { db, commissions };
}

test("admin order totals and CTV net use volume price then goods voucher; shipping never changes commission", async () => {
  for (const qty of [1, 4, 5, 9, 10, 15]) for (const percent of [0, 5, 7]) for (const shipFee of [0, 18000, 45000]) {
    const { db, commissions } = fixture();
    const tier = calculateTierPrice(150000, qty);
    const subtotal = tier.unitPrice * qty;
    const discount = Math.round(subtotal * percent / 100);
    const details = [{ productCode: "P", productName: "Plant", price: tier.unitPrice, quantity: qty, ctvCode: "CTV_A" }];
    splitLineDiscounts(details, { P: discount });
    const shipDiscount = subtotal >= 2000000 ? Math.min(shipFee, 50000) : subtotal >= 1000000 ? Math.min(shipFee, 30000) : 0;
    const total = subtotal - discount + shipFee - shipDiscount;
    const result = await holdCommissionsForOrder(db, db, { code: "TEST", createdAt: new Date().toISOString(), deliveredAt: new Date().toISOString(), orderDetails: details, total, shippingFee: shipFee - shipDiscount });
    assert.equal(result.created, 1);
    const row = commissions.get("P:CTV_A");
    assert.equal(row.lineTotal, subtotal - discount);
    assert.equal(row.amount, Math.round((subtotal - discount) * 0.05));
    assert.equal(total, row.lineTotal + shipFee - shipDiscount);
  }
});

test("split flash and regular rows of the same SKU retain all CTV commission", async () => {
  const { db, commissions } = fixture();
  const details = [
    { productCode: "P", productName: "Plant", price: 100000, quantity: 2, ctvCode: "CTV_A" },
    { productCode: "P", productName: "Plant", price: 135000, quantity: 8, ctvCode: "CTV_A" },
  ];
  splitLineDiscounts(details, { P: 64000 });
  const result = await holdCommissionsForOrder(db, db, { code: "TEST", createdAt: new Date().toISOString(), deliveredAt: new Date().toISOString(), orderDetails: details });
  assert.equal(result.created, 1);
  assert.equal(commissions.get("P:CTV_A").qty, 10);
  assert.equal(commissions.get("P:CTV_A").lineTotal, 1216000);
  assert.equal(commissions.get("P:CTV_A").amount, 60800);
});

test("same SKU credited to different CTVs stays separate; gifts do not earn commission", async () => {
  const { db, commissions } = fixture();
  const result = await holdCommissionsForOrder(db, db, {
    code: "TEST", createdAt: new Date().toISOString(), deliveredAt: new Date().toISOString(),
    orderDetails: [
      { productCode: "P", price: 135000, quantity: 4, discount: 27000, ctvCode: "CTV_A" },
      { productCode: "P", price: 135000, quantity: 6, discount: 40500, ctvCode: "CTV_B" },
      { productCode: "GIFT", price: 100000, quantity: 1, ctvCode: "CTV_A", isGift: true },
    ],
  });
  assert.equal(result.created, 2);
  assert.equal(commissions.get("P:CTV_A").amount, 25650);
  assert.equal(commissions.get("P:CTV_B").amount, 38475);
  assert.equal(commissions.has("GIFT:CTV_A"), false);
});

test("CTV conversions return saved final order total and commission without recomputing catalog prices", async () => {
  const now = new Date().toISOString();
  const order = { code: "TEST", createdAt: now, orderStatus: "hoan_thanh", paymentStatus: "paid", total: 1297500, totalPayment: 1297500,
    orderDetails: [{ productCode: "P", productName: "Plant", price: 135000, quantity: 10, discount: 67500 }] };
  const db: any = { collection(name: string) { return {
    async findOne() { return null; },
    find() { return {
      sort() { return this; }, limit() { return this; }, project() { return this; },
      async toArray() {
        if (name === "aloha_shop_orders") return [order];
        if (name === "aloha_shop_commissions") return [{ orderCode: "TEST", amount: 64125, ma: "P", status: "held" }];
        // The current catalog has a different price; historical order values must stay unchanged.
        if (name === "aloha_products") return [{ ma: "P", ten: "Plant", giaWeb: 999000 }];
        return [];
      },
    }; },
  }; } };
  const result = await getCtvConversions(async () => db, { shopDb: db, ctvCode: "CTV_A" } as any, {});
  assert.equal(result.data[0].total, 1297500);
  assert.equal(result.data[0].totalCommission, 64125);
});
