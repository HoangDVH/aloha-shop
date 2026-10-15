import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb, TEST_MONGO_SKIP } from './helpers/testMongo.js';
import { holdPromotion, releasePromotionHold } from '../backend/shopPromotions/redemptionService.js';
import { ensureRedemptionIndexes } from '../backend/shopPromotions/voucherHistory.js';
import { PROMOTIONS_COL, PROMOTION_CODES_COL, PROMOTION_REDEMPTIONS_COL, PROMOTION_CUSTOMER_USAGE_COL } from '../backend/shopPromotions/types.js';
import { promo } from './helpers/walletFixtures.js';

for(const differentOrders of [false,true])test(`real Mongo: concurrent ${differentOrders?'different orders':'exact retries'} with one buyer/key reserve only once`,{skip:TEST_MONGO_SKIP},async()=>{
  const ctx=await openTestDb(`reservation_${differentOrders?'conflict':'replay'}`);
  try{
    const db=ctx.db;
    await ensureRedemptionIndexes(db);
    await db.collection(PROMOTIONS_COL).insertOne(promo('V',{budgetTotal:10000000,usageLimitPerCustomer:1000}));
    await db.collection(PROMOTION_CODES_COL).insertOne({code:'CODE',active:true,maxUses:1000,heldCount:0,usedCount:0});
    const results=await Promise.all(Array.from({length:20},(_,i)=>holdPromotion(db,{promotionId:'V',promotionCode:'CODE',buyerId:'A',customerKey:'acc:A',
      idempotencyKey:'KEY',orderCode:differentOrders?`ORDER_${i}`:'ORDER',discountAmount:10000})));
    if(differentOrders)assert.equal(results.filter(r=>r.ok).length,1);
    else assert(results.every(r=>r.ok));
    const rows=await db.collection(PROMOTION_REDEMPTIONS_COL).find({}).toArray();
    assert.equal(rows.length,1);
    const promotion=await db.collection(PROMOTIONS_COL).findOne({id:'V'});
    assert.equal(promotion?.heldCount,1);
    assert.equal(promotion?.budgetHeld,10000);
    assert.equal((await db.collection(PROMOTION_CODES_COL).findOne({code:'CODE'}))?.heldCount,1);
    assert.equal((await db.collection(PROMOTION_CUSTOMER_USAGE_COL).findOne({_id:'V:acc:A'} as any))?.count,1);
    await releasePromotionHold(db,rows[0].orderCode);
    const released=await db.collection(PROMOTIONS_COL).findOne({id:'V'});
    assert.equal(released?.heldCount,0);
    assert.equal(released?.budgetHeld,0);
  }finally{await ctx.close();}
});

test('real Mongo: two buyers may use the same client key but each needs their own budget and reservation',{skip:TEST_MONGO_SKIP},async()=>{
  const ctx=await openTestDb('reservation_two_buyers');
  try{
    await ctx.db.collection(PROMOTIONS_COL).insertOne(promo('V',{budgetTotal:20000}));
    const results=await Promise.all(['A','B'].map(buyerId=>holdPromotion(ctx.db,{promotionId:'V',buyerId,customerKey:`acc:${buyerId}`,idempotencyKey:'SAME',orderCode:`ORDER_${buyerId}`,discountAmount:10000})));
    assert(results.every(r=>r.ok));
    assert.equal(await ctx.db.collection(PROMOTION_REDEMPTIONS_COL).countDocuments({}),2);
    const promotion=await ctx.db.collection(PROMOTIONS_COL).findOne({id:'V'});
    assert.equal(promotion?.heldCount,2);
    assert.equal(promotion?.budgetHeld,20000);
  }finally{await ctx.close();}
});
