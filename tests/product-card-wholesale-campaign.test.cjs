const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute each card's actual quote calculation with retail and wholesale fixtures.
function quote(file, extra = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  const priceKind =');
  const end = source.indexOf('  const zeroPriceBlocked', start);
  const code = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = {
    product: { gia: 220000, webPrice: 300000, priceKind: 'si', campaignPromo: {
      kind: 'flash', slotOpen: true, salePrice: 199000, listPrice: 300000, compareAtPrice: 398000,
    } },
    user: { siStatus: 'active', roles: ['si'], siRegion: 'HCM' },
    liveGia: undefined, liveWebPrice: undefined, livePriceKind: undefined,
    liveAllowBackorder: undefined, liveCampaignPromo: undefined, displayTon: 10,
    isPromoSelling: p => Boolean(p?.slotOpen), isPromoPriceActive: p => Boolean(p?.slotOpen),
    promoAnchorPrice: p => p?.compareAtPrice || 0,
    stockMax: n => n, flashDealProgress: () => null, anchorDealProgress: () => null,
    useCampaignView: () => ({ vouchers: [], viewer: {}, offsetMs: 0 }), shipSupportFor: () => 0,
    ...extra,
  };
  vm.runInNewContext(`${code}\nglobalThis.result = { displayGia, webPrice, promo, pricePending, listPrice: typeof listPrice === 'undefined' ? 0 : listPrice };`, context);
  return context.result;
}
for (const file of ['frontend/components/ProductCard.tsx', 'frontend/components/campaign/ProductDealCard.tsx']) {
  test(`${file}: wholesale retains its own price and actual web price during flash sale`, () => {
    const q = quote(file);
    assert.equal(q.displayGia, 220000);
    assert.equal(q.webPrice, 300000);
    assert.equal(q.promo, null);
    if (file.includes('ProductDealCard')) assert.equal(q.listPrice, 300000);
  });
  test(`${file}: live wholesale prices override initial product prices`, () => {
    const q = quote(file, { liveGia: 210000, liveWebPrice: 290000 });
    assert.equal(q.displayGia, 210000);
    assert.equal(q.webPrice, 290000);
    if (file.includes('ProductDealCard')) assert.equal(q.listPrice, 290000);
  });
  test(`${file}: ordinary retail and active retail flash pricing remain available`, () => {
    const retail = { user: null, livePriceKind: 'web', liveGia: 300000 };
    assert.equal(quote(file, retail).displayGia, 199000);
    assert.equal(quote(file, { ...retail, liveCampaignPromo: null }).displayGia, 300000);
  });
  test(`${file}: account transitions and missing wholesale quotes cannot use retail sale prices`, () => {
    for (const extra of [{ livePriceKind: 'web' }, { user: null }, { livePriceKind: 'si_missing', liveGia: 0 }]) {
      const q = quote(file, extra);
      assert.equal(q.promo, null);
      assert.equal(q.displayGia, extra.liveGia ?? 220000);
    }
  });
}
