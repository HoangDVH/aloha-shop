import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb, TEST_MONGO_SKIP } from './helpers/testMongo.js';
import { holdFirstPurchaseClaims, consumeFirstPurchaseClaims, releaseFirstPurchaseClaims, PROMOTION_CLAIMS_COL } from '../backend/shopPromotions/claimService.js';
import { renameRedemptionOrderCode, releasePromotionHold, markRedemptionUsed } from '../backend/shopPromotions/redemptionService.js';
import { checkIsNewWebBuyer } from '../backend/shopPromotions/customerEligibility.js';
import { resolveVoucherBuyer } from '../backend/shopPromotions/voucherBuyer.js';
import { applyBuyerRules } from '../backend/shopPromotions/wallet/walletRules.js';
import { promo } from './helpers/walletFixtures.js';

test('real Mongo: concurrent first-order discounts share one account/phone entitlement', {skip:TEST_MONGO_SKIP}, async()=>{
  const ctx=await openTestDb('first_purchase_race');
  try {
    const results=await Promise.all(Array.from({length:20},(_,i)=>holdFirstPurchaseClaims(ctx.db,{orderCode:`ORDER_${i}`,accountId:'A',buyerPhone:'0901234567'})));
    assert.equal(results.filter(r=>r.ok).length,1);
    const rows=await ctx.db.collection(PROMOTION_CLAIMS_COL).find({state:'held'}).toArray();
    assert.equal(rows.length,2);
    assert.equal(new Set(rows.map(r=>r.orderId)).size,1);
  }finally{await ctx.close();}
});

test('held first-purchase entitlement blocks all new-customer vouchers and only exposes own order code', {skip:TEST_MONGO_SKIP},async()=>{
  const ctx=await openTestDb('first_purchase_notice');
  try {
    await holdFirstPurchaseClaims(ctx.db,{orderCode:'DH_PRIVATE_A',accountId:'A',buyerPhone:'0901234567'});
    const own=await resolveVoucherBuyer(ctx.db,{userId:'A',phone:'0901234567'});
    const shared=await resolveVoucherBuyer(ctx.db,{userId:'B',phone:'+84901234567'});
    assert.equal(own.newBuyer,true);
    assert.equal(own.isNewWebBuyer,false);
    assert.match(own.newVoucherBlockReason!,/DH_PRIVATE_A/);
    assert.equal(shared.isNewWebBuyer,false);
    assert(!shared.newVoucherBlockReason!.includes('DH_PRIVATE_A'));
    const result=applyBuyerRules([
      promo('NEW_5',{targetCustomer:'new_web'}),promo('NEW_10',{targetCustomer:'new_web'}),
      promo('NEW_SHIP',{targetCustomer:'new_web',benefitType:'shipping'}),promo('NORMAL',{targetCustomer:'all'}),
    ],{...own,status:{retail:true,locked:false,isTestBuyer:false},campaignVoucherIds:new Set(),saved:new Set(),walletOn:false});
    assert.deepEqual(result.promotions.map(p=>p.id),['NORMAL']);
    assert.equal(result.notices.length,3);
    assert(result.notices.every(n=>n.ineligibleReason===own.newVoucherBlockReason && !n.needsClaim));
    await releaseFirstPurchaseClaims(ctx.db,'DH_PRIVATE_A');
    assert.equal((await resolveVoucherBuyer(ctx.db,{userId:'A',phone:'0901234567'})).isNewWebBuyer,true);
  }finally{await ctx.close();}
});

test('real Mongo: replay keeps one entitlement; consumed rights cannot be reacquired for the same order', {skip:TEST_MONGO_SKIP},async()=>{
  const ctx=await openTestDb('first_purchase_replay');
  try {
    const input={orderCode:'A',accountId:'A',buyerPhone:'0901234567'};
    assert.equal((await holdFirstPurchaseClaims(ctx.db,input)).ok,true);
    assert.equal((await holdFirstPurchaseClaims(ctx.db,input)).ok,true);
    assert.equal(await ctx.db.collection(PROMOTION_CLAIMS_COL).countDocuments({}),2);
    await consumeFirstPurchaseClaims(ctx.db,'A');
    assert.equal((await holdFirstPurchaseClaims(ctx.db,input)).ok,false);
    assert.equal(await ctx.db.collection(PROMOTION_CLAIMS_COL).countDocuments({state:'consumed'}),2);
  }finally{await ctx.close();}
});

test('real Mongo: accounts sharing local/international phone cannot each reserve a new-customer discount', {skip:TEST_MONGO_SKIP},async()=>{
  const ctx=await openTestDb('first_purchase_phone');
  try {
    const results=await Promise.all(Array.from({length:12},(_,i)=>holdFirstPurchaseClaims(ctx.db,{orderCode:`ORDER_${i}`,accountId:`A${i}`,buyerPhone:i%2?'0901234567':'+84901234567'})));
    assert.equal(results.filter(r=>r.ok).length,1);
    const held=await ctx.db.collection(PROMOTION_CLAIMS_COL).find({state:'held'}).toArray();
    assert.equal(held.length,2,'losing account reservations must be released');
    assert.equal(new Set(held.map(r=>r.orderId)).size,1);
  }finally{await ctx.close();}
});

test('real Mongo: KiotViet order rename carries entitlement through cancel and successful payment', {skip:TEST_MONGO_SKIP},async()=>{
  const ctx=await openTestDb('first_purchase_rename');
  try {
    assert.equal((await holdFirstPurchaseClaims(ctx.db,{orderCode:'WEB_A',accountId:'A',buyerPhone:'0901234567'})).ok,true);
    await renameRedemptionOrderCode(ctx.db,'WEB_A','DH_A');
    await releasePromotionHold(ctx.db,'DH_A');
    assert.equal(await checkIsNewWebBuyer(ctx.db,{userId:'A',phone:'0901234567'}),true);
    assert.equal((await holdFirstPurchaseClaims(ctx.db,{orderCode:'WEB_B',accountId:'A',buyerPhone:'0901234567'})).ok,true);
    await renameRedemptionOrderCode(ctx.db,'WEB_B','DH_B');
    await markRedemptionUsed(ctx.db,'DH_B');
    await releaseFirstPurchaseClaims(ctx.db,'DH_B');
    assert.equal(await checkIsNewWebBuyer(ctx.db,{userId:'A',phone:'0901234567'}),false);
    assert.equal((await holdFirstPurchaseClaims(ctx.db,{orderCode:'WEB_C',accountId:'A',buyerPhone:'0901234567'})).ok,false);
    const rows=await ctx.db.collection(PROMOTION_CLAIMS_COL).find({}).toArray();
    assert.equal(rows.length,2,'released identity records must be reused');
    assert(rows.every(r=>r.state==='consumed' && r.orderId==='DH_B'));
    await consumeFirstPurchaseClaims(ctx.db,'DH_B');
  }finally{await ctx.close();}
});
