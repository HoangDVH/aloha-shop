import './helpers/noRedis.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicVouchers } from '../backend/shopCampaigns/routes/public.routes.js';
import { claimVoucher } from '../backend/shopPromotions/wallet/walletClaim.js';
import { ensureWalletIndexes } from '../backend/shopPromotions/wallet/walletService.js';
import { evaluatePromotions } from '../backend/shopPromotions/evaluator.js';
import { loadBuyerPromotions } from '../backend/shopPromotions/wallet/walletRules.js';
import { evaluateGoodsPromotions } from '../backend/shopPromotions/checkoutPromotions.js';
import { CAMPAIGNS_COL } from '../backend/shopCampaigns/types.js';
import { PROMOTIONS_COL } from '../backend/shopPromotions/types.js';
import { promo } from './helpers/walletFixtures.js';
import { daiLeContent } from './helpers/campaignFixtures.js';
import { createMockDb } from './helpers/antiAbuseMockDb.js';
import { openTestDb, TEST_MONGO_SKIP } from './helpers/testMongo.js';

const NOW='2026-10-15T06:00:00.000Z';
const scoped=(id='OCT20')=>promo(id,{title:'Giảm 10% đặt trước 20/10',discountType:'percentage',discountValue:10,maxDiscountVnd:200000,
  minOrderThreshold:0,scope:'product',productMas:['CBGCMM','GSDL','SDGN'],startDate:'2026-10-01T00:00:00.000Z',endDate:'2026-10-20T16:59:59.999Z',claimRequired:true});

test('campaign display includes public active product vouchers without a campaign link, once, and exposes scope',async()=>{
  const rows=[scoped(),promo('NEW',{targetCustomer:'new_web'}),{...scoped('PAUSED'),status:'paused'},
    {...scoped('PRIVATE'),isPublic:false},{...scoped('EXPIRED'),endDate:'2026-10-14T00:00:00.000Z'},
    {...scoped('FUTURE'),startDate:'2026-10-16T00:00:00.000Z'},{...scoped('WHOLESALE'),targetCustomer:'wholesale'},
    {...scoped('EMPTY'),productMas:[]}];
  const {db}=createMockDb({[PROMOTIONS_COL]:rows});
  const list=await publicVouchers(db,['NEW','OCT20'],NOW,true);
  assert.deepEqual(list.map(p=>p.id),['NEW','OCT20']);
  assert.equal(list[1].scope,'product');
  assert.deepEqual(list[1].productMas,['CBGCMM','GSDL','SDGN']);
  assert.deepEqual((await publicVouchers(db,['NEW'],NOW,false)).map(p=>p.id),['OCT20']);
  assert.deepEqual((await publicVouchers(db,['NEW'],NOW,true,false)).map(p=>p.id),['NEW'],'draft preview does not acquire unrelated vouchers');
});

test('20/10 reduces only eligible goods; a new-customer voucher is an alternative, not an extra 5%',()=>{
  const event=scoped();
  const newBuyer=promo('NEW',{discountType:'percentage',discountValue:5,minOrderThreshold:0,targetCustomer:'new_web'});
  const quote=(items:any[])=>evaluatePromotions({promotions:[event,newBuyer],items,buyer:{isWholesale:false,isNewWebBuyer:true},now:new Date(NOW)});
  assert.equal(quote([{ma:'GSDL',price:250000,quantity:1}]).discountTotal,25000);
  const mixed=quote([{ma:'GSDL',price:250000,quantity:1},{ma:'OTHER',price:100000,quantity:1}]);
  assert.equal(mixed.applied?.promotionId,'OCT20');
  assert.equal(mixed.discountTotal,25000);
  assert.equal(mixed.lineDiscounts.OTHER,0);
  const other=evaluatePromotions({promotions:[event],items:[{ma:'OTHER',price:100000,quantity:1}],now:new Date(NOW)});
  assert.equal(other.discountTotal,0);
});

test('Mongo: public scoped voucher outside campaign links can be saved; paused/private cannot',{skip:TEST_MONGO_SKIP},async()=>{
  process.env.SHOP_CAMPAIGN_ENABLED='1'; process.env.SHOP_VOUCHER_WALLET_ENABLED='1';
  const ctx=await openTestDb('campaign_product_voucher');
  try{
    const content=daiLeContent({startAt:'2026-10-01T00:00:00.000Z',endAt:'2026-10-20T16:59:59.999Z'});
    content.voucherIds=[];
    await ctx.db.collection(CAMPAIGNS_COL).insertOne({_id:'CMP' as any,status:'published',published:content,publishedAt:NOW});
    await ctx.db.collection(PROMOTIONS_COL).insertMany([scoped(),{...scoped('PRIVATE'),isPublic:false}]);
    await ensureWalletIndexes(ctx.db);
    const viewer={accountId:'A',account:{roles:['customer']},phone:'0901234567',email:'a@example.invalid',status:{retail:true,locked:false,isTestBuyer:false}};
    const buyerInput={...viewer,now:new Date(NOW)};
    const before=await loadBuyerPromotions(ctx.db,buyerInput);
    assert(!before.promotions.some(p=>p.id==='OCT20'),'visible is not automatically saved');
    assert.equal((await claimVoucher(ctx.db,viewer,'OCT20',Date.parse(NOW))).ok,true);
    const after=await loadBuyerPromotions(ctx.db,buyerInput);
    assert(after.promotions.some(p=>p.id==='OCT20'));
    const quote=await evaluateGoodsPromotions(ctx.db,{items:[{ma:'GSDL',price:250000,quantity:1},{ma:'OTHER',price:100000,quantity:1}],
      buyer:{...after.buyerContext,isWholesale:false},promotions:after.promotions,now:new Date(NOW)});
    assert.equal(quote.discountTotal,25000);
    assert.equal((await claimVoucher(ctx.db,viewer,'PRIVATE',Date.parse(NOW))).ok,false);
    await ctx.db.collection(PROMOTIONS_COL).updateOne({id:'OCT20'},{$set:{status:'paused'}});
    assert.equal((await claimVoucher(ctx.db,viewer,'OCT20',Date.parse(NOW))).ok,false);
    assert.deepEqual(await publicVouchers(ctx.db,[],NOW,true),[]);
  }finally{await ctx.close();}
});
