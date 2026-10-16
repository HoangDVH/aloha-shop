const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
test('unlinked HCM/TINH buyers validate shipping through the normal checkout before saving a queued review order', async () => {
  for (const siRegion of ['HCM', 'TINH']) {
    let checked = false;
    const exports = {};
    const details = [{ productCode: 'P', productName: 'Pot', price: 2145000, quantity: 1 }];
    const source = fs.readFileSync('backend/shopOrders/orderCreateRoutes.ts', 'utf8') + '\nexport { createShopOrder as testCreateShopOrder };';
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
      exports, require(name) {
        if (name.includes('wholesalePreflight')) return { preparedWholesaleHistory: () => 'new' };
        if (name.includes('purchaseCheck')) return { checkWholesalePurchase: async () => ({ canCheckout: true }) };
        if (name.includes('shopWholesale/policy')) return { isActiveWholesale: () => true };
        if (name.includes('shopAuth/models')) return { SHOP_ACCOUNTS: 'accounts', shopAccountIdQuery: id => ({ _id: id }) };
        if (name.includes('orderRouteShared')) return { parseOrderDetails: rows => rows, applyCatalogPrices: async () => ({ ok: true, details }) };
        if (name.includes('stockApply')) return { annotatePreOrderDetails: async () => ({ ok: true, details }) };
        if (name.includes('ctvCodes')) return { keepActiveCtvCodes: async (_db, rows) => rows };
        if (name.includes('campaignStep')) return { dropClientGiftLines: rows => rows,
          priceOrderWithCampaign: async () => ({ ok: true, details }), goodsSubtotal: () => 2145000 };
        if (name.includes('stepResult')) return { isStepFail: value => value.ok === false };
        if (name.includes('shippingQuoteCheck')) return { checkShippingQuote: input => {
          checked = true; assert.equal(input.body.quoteToken, 'signed-quote'); assert.equal(input.body.shippingFee, 70000);
          return { ok: false, status: 409, body: { code: 'shipping_checked' } };
        } };
        if (name.includes('backorder')) return { createBackorderRequest: async () => { assert.fail('Must not bypass shipping for an unlinked wholesale buyer'); } };
        return {};
      },
    });
    const db = { collection: () => ({ findOne: async () => ({ roles: ['si'], siStatus: 'active', siRegion, kvCustomerId: null }) }) };
    const req = { shopAuth: { userId: 'buyer' }, body: { customerName: 'Buyer', customerPhone: '0900000000',
      province: 'Province', ward: 'Ward', shippingAddress: 'Street', policyAccepted: true, backorderAccepted: true,
      orderDetails: details, quoteToken: 'signed-quote', shippingFee: 70000 } };
    let body;
    const res = { status() { return this; }, json(value) { body = value; } };
    await exports.testCreateShopOrder(req, res, async () => db, async () => db, async () => {});
    assert.equal(checked, true); assert.equal(body.code, 'shipping_checked');
  }
});
