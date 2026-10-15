import test from 'node:test';
import assert from 'node:assert/strict';
import { requireShopAuth } from '../backend/shopAuth/routes.js';
import { signShopAccessToken } from '../backend/shopAuth/tokens.js';
import { evaluateOrderPromotions } from '../backend/shopOrders/create/orderPromotions.js';
import { evaluateGoodsPromotions } from '../backend/shopPromotions/checkoutPromotions.js';
import { loadBuyerPromotions } from '../backend/shopPromotions/wallet/walletRules.js';
import { createMockDb } from './helpers/antiAbuseMockDb.js';
import { promo } from './helpers/walletFixtures.js';
import { registrationShopRoles, storedShopRoles, isWholesaleAccount } from '../backend/shopAuth/roles.js';

const account={_id:'AUDIT_W',active:true,email:'audit@example.invalid',phone:'0901234567',roles:['customer','si'],siStatus:'active',siRegion:'HCM'};
test('registration cannot grant wholesale roles and stored legacy aliases remain wholesale',()=>{
  assert.deepEqual(registrationShopRoles(['si','wholesale','admin']),['customer']);
  assert.deepEqual(registrationShopRoles(['ctv','si']),['ctv']);
  assert.deepEqual(storedShopRoles(['si','wholesale','si','admin']),['si']);
  assert.equal(isWholesaleAccount({roles:['wholesale']}),true);
  assert.equal(isWholesaleAccount({roles:['customer']}),false);
});
test('authentication preserves stored wholesale role even if old JWT omits it',async()=>{
  process.env.JWT_SHOP_ACCESS_SECRET='local-wholesale-regression';
  const {db}=createMockDb({aloha_shop_accounts:[account]});
  const req:any={headers:{authorization:`Bearer ${signShopAccessToken({sub:account._id,email:account.email,roles:['customer']})}`}};
  let next=false;
  await requireShopAuth(async()=>db)(req,{status(){throw Error('Auth unexpectedly failed');}} as any,()=>{next=true;});
  assert(next);
  assert(req.shopAuth.roles.includes('si'));
});

test('retail and wholesale voucher totals agree at quote and order creation despite stale token roles',async()=>{
  process.env.SHOP_CAMPAIGN_ENABLED='0';
  process.env.SHOP_SHIP_VOUCHER_ENABLED='0';
  for(const wholesale of [true,false])for(const targetCustomer of ['retail','wholesale'] as const){
    const current={...account,roles:wholesale?['customer','si']:['customer']};
    const {db}=createMockDb({aloha_shop_accounts:[current],aloha_shop_promotions:[promo('V',{targetCustomer,discountValue:10000,minOrderThreshold:0,claimRequired:false})]});
    const buyerPromos=await loadBuyerPromotions(db,{now:new Date(),account:current,accountId:current._id,phone:current.phone,email:current.email});
    const quote=await evaluateGoodsPromotions(db,{items:[{ma:'P',price:100000,quantity:1}],buyer:{...buyerPromos.buyerContext,isWholesale:wholesale},promotions:buyerPromos.promotions,now:new Date()});
    const order=await evaluateOrderPromotions(db,db,{account:current,roles:wholesale?['customer']:['customer','si'],accountId:current._id,body:{},customerPhone:current.phone,buyerEmail:current.email,
      deliveryMethod:'nhan_cua_hang',orderDetails:[{productCode:'P',quantity:1,price:100000}],subtotal:100000,
      quote:{ok:true,quoteToken:'',quoteVerified:null,shippingFee:0,totalWeightGram:0,freeShipApplied:false},address:{province:'',district:''}});
    assert(order.ok);
    assert.equal(order.discount,quote.discountTotal);
    assert.equal(order.discount,(targetCustomer==='wholesale')===wholesale?10000:0);
  }
});
