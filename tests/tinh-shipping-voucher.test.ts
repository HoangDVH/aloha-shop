import test from "node:test";
import assert from "node:assert/strict";
import { allowsTinhShipping, isWholesaleTinh, isWholesaleHcm } from "../backend/shopPromotions/tinhShipping.js";
import { applyBuyerRules } from "../backend/shopPromotions/wallet/walletRules.js";
import { viewerClaimError } from "../backend/shopPromotions/wallet/walletClaim.js";
import { evaluateShippingPromotions } from "../backend/shopPromotions/evaluator.js";
import { promo } from "./helpers/walletFixtures.js";

const account = { _id: "tinh", active: true, roles: ["si"], siStatus: "active", siRegion: "TINH" };
const ship = promo("SHIP50", { benefitType: "shipping", targetCustomer: "all", regionId: "all", discountValue: 50000,
  minOrderThreshold: 2000000, claimRequired: true, allowWholesaleTinh: true });
const ctx = { status: { retail: false, locked: false, isTestBuyer: false }, campaignVoucherIds: new Set([ship.id]),
  saved: new Set<string>(), walletOn: true, account };

test("HCM receives opted-in 30k shipping at 1.026m, capped by actual fee; pickup stays excluded", () => {
  const hcm = { ...account, siRegion: "HCM" };
  const voucher = { ...ship, allowWholesaleHcm: true, discountValue: 30000, minOrderThreshold: 1000000, claimRequired: false, targetCustomer: "retail" as const };
  assert.equal(isWholesaleHcm(hcm), true);
  assert.equal(allowsTinhShipping(voucher, hcm), true);
  assert.equal(applyBuyerRules([voucher], { ...ctx, account: hcm }).promotions.length, 1);
  assert.equal(allowsTinhShipping({ ...voucher, benefitType: "goods" }, hcm), false);
  assert.equal(allowsTinhShipping(voucher, { ...hcm, active: false }), false);
  const input = { promotions: [voucher], items: [{ ma: "POT", quantity: 38, price: 27000 }],
    buyer: { isWholesale: true, isWholesaleHcm: true }, shippingFee: 45000, freeShipApplied: false,
    deliveryMethod: "giao_tan_noi", matchRegion: () => ({ status: "matched" as const, regionId: "all", regionVersion: 1, source: "name" as const }), now: new Date() };
  assert.equal(evaluateShippingPromotions(input).applied?.discountAmount, 30000);
  assert.equal(evaluateShippingPromotions({ ...input, shippingFee: 18000 }).applied?.discountAmount, 18000);
  assert.equal(evaluateShippingPromotions({ ...input, deliveryMethod: "nhan_cua_hang" }).applied, undefined);
  assert.equal(applyBuyerRules([{ ...voucher, claimRequired: true }], { ...ctx, account: hcm }).notices[0].needsClaim, true);
});
test("approved TINH can use opted-in campaign shipping after saving; money-off vouchers stay retail-only", () => {
  const unsaved = applyBuyerRules([ship], ctx);
  assert.equal(unsaved.promotions.length, 0);
  assert.equal(unsaved.notices[0].needsClaim, true);
  const saved = applyBuyerRules([ship], { ...ctx, saved: new Set([ship.id]) });
  assert.equal(saved.promotions.length, 1);
  const goods = { ...ship, benefitType: "goods" as const };
  assert.equal(applyBuyerRules([goods], { ...ctx, saved: new Set([ship.id]) }).promotions.length, 0);
});
test("exception never opens campaign shipping to HCM, pending, locked or CTV-only accounts", () => {
  for (const user of [{ ...account, siRegion: "HCM" }, { ...account, siStatus: "cho_duyet" }, { ...account, active: false }, { ...account, roles: ["ctv"] }]) {
    assert.equal(isWholesaleTinh(user), false);
    assert.equal(allowsTinhShipping(ship, user), false);
    assert.equal(applyBuyerRules([ship], { ...ctx, account: user, saved: new Set([ship.id]) }).promotions.length, 0);
  }
  assert.equal(allowsTinhShipping({ ...ship, allowWholesaleTinh: false }, account), false);
});
test("TINH wallet claim is permitted only for flagged shipping voucher, retaining login/lock gates", () => {
  const previous = [process.env.SHOP_CAMPAIGN_ENABLED, process.env.SHOP_VOUCHER_WALLET_ENABLED];
  process.env.SHOP_CAMPAIGN_ENABLED = "1"; process.env.SHOP_VOUCHER_WALLET_ENABLED = "1";
  try {
    const viewer = { accountId: "tinh", account, email: "", phone: "", status: ctx.status };
    assert.equal(viewerClaimError(viewer, ship.id, ship), null);
    assert.notEqual(viewerClaimError(viewer, ship.id, { ...ship, benefitType: "goods" }), null);
    assert.notEqual(viewerClaimError({ ...viewer, accountId: null }, ship.id, ship), null);
    assert.notEqual(viewerClaimError({ ...viewer, status: { ...ctx.status, locked: true } }, ship.id, ship), null);
  } finally {
    for (const [i, key] of ["SHOP_CAMPAIGN_ENABLED", "SHOP_VOUCHER_WALLET_ENABLED"].entries()) {
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
    }
  }
});
test("31 pots at 65k and ship fee 119400 receive 50k support; summary total becomes 2084400", () => {
  const result = evaluateShippingPromotions({ promotions: [{ ...ship, targetCustomer: "retail" }],
    items: [{ ma: "JW", quantity: 31, price: 65000 }], buyer: { isWholesale: true, isWholesaleTinh: true },
    shippingFee: 119400, freeShipApplied: false, deliveryMethod: "giao_tan_noi",
    matchRegion: () => ({ status: "matched", regionId: "all", regionVersion: 1, source: "name" }), now: new Date() });
  assert.equal(result.applied?.discountAmount, 50000);
  assert.equal(31 * 65000 + 119400 - (result.applied?.discountAmount || 0), 2084400);
  const under = evaluateShippingPromotions({ promotions: [ship], items: [{ ma: "JW", quantity: 1, price: 65000 }],
    buyer: { isWholesale: true, isWholesaleTinh: true }, shippingFee: 119400, freeShipApplied: false,
    deliveryMethod: "giao_tan_noi", matchRegion: () => ({ status: "matched", regionId: "all", regionVersion: 1, source: "name" }), now: new Date() });
  assert.equal(under.applied, undefined);
});
