import test from 'node:test';
import assert from 'node:assert/strict';
import { holdPromotion } from '../backend/shopPromotions/redemptionService.js';
import { createMockDb } from './helpers/antiAbuseMockDb.js';
import { promo } from './helpers/walletFixtures.js';

for(const status of ['held','used'])test(`a different buyer cannot borrow a ${status} reservation using the same client key`,async()=>{
  const old={id:'RED_A',promotionId:'V',orderCode:'ORDER_A',buyerId:'A',customerKey:'acc:A',idempotencyKey:'CLIENT_KEY',status,discountAmount:10000};
  const {db,collections}=createMockDb({aloha_shop_promotions:[promo('V',{heldCount:1,budgetHeld:10000,budgetTotal:10000})],aloha_shop_promotion_redemptions:[old]});
  const result=await holdPromotion(db,{promotionId:'V',orderCode:'ORDER_B',buyerId:'B',customerKey:'acc:B',idempotencyKey:'CLIENT_KEY',discountAmount:10000});
  assert.equal(result.ok,false,'budget is exhausted; the old reservation belongs to A');
  assert.equal(collections.aloha_shop_promotion_redemptions.length,1);
});

for(const changes of [{orderCode:'ORDER_B'},{discountAmount:20000},{buyerId:'B',customerKey:'acc:B'},{promotionCode:'OTHER'}])test(`reservation replay rejects changed request ${JSON.stringify(changes)}`,async()=>{
  const old={id:'RED_A',promotionId:'V',orderCode:'ORDER_A',buyerId:'A',customerKey:'acc:A',idempotencyKey:'CLIENT_KEY',status:'held',discountAmount:10000};
  const {db}=createMockDb({aloha_shop_promotion_redemptions:[old]});
  const result=await holdPromotion(db,{promotionId:'V',orderCode:'ORDER_A',buyerId:'A',customerKey:'acc:A',idempotencyKey:'CLIENT_KEY',discountAmount:10000,...changes});
  assert.equal(result.ok,false);
});

test('same buyer and exact order replay returns the original reservation without increasing budget',async()=>{
  const old={id:'RED_A',promotionId:'V',orderCode:'ORDER_A',buyerId:'A',customerKey:'acc:A',idempotencyKey:'CLIENT_KEY',status:'held',discountAmount:10000};
  const {db}=createMockDb({aloha_shop_promotion_redemptions:[old]});
  assert.deepEqual(await holdPromotion(db,{promotionId:'V',orderCode:'ORDER_A',buyerId:'A',customerKey:'acc:A',idempotencyKey:'CLIENT_KEY',discountAmount:10000}),{ok:true,redemptionId:'RED_A'});
});
