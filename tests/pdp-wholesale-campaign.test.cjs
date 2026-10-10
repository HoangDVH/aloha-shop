const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Render the real PDP price section with account and quote fixtures.
const source = fs.readFileSync('frontend/components/ProductDetailView.tsx', 'utf8');
const start = source.indexOf('{!hasPromo');
const end = source.indexOf('{!expectsSi ? (', start);
const code = ts.transpileModule(`const tree = <>${source.slice(start, end)}</>;`, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
function render(extra = {}) {
  const jsx = (type, props) => ({ type, props: props || {} });
  const context = {
    exports: {}, require: () => ({ jsx, jsxs: jsx, Fragment: 'fragment' }),
    hasPromo: true, expectsSi: true, pricePending: false,
    livePriceKind: 'si', liveGia: 220000, liveWebPrice: 300000,
    livePromo: { listPrice: 398000, salePrice: 199000 }, liveTon: 0,
    activeProduct: { ma: 'CBDVDP', dvt: 'CÁI' }, user: { siRegion: 'HCM' },
    SiPriceBadge: 'si-price', ProductCampaignBox: 'campaign-price',
    formatVnd: String, purchaseDisabled: false, isPreOrder: true, addCart() {},
    ...extra,
  };
  vm.runInNewContext(`${code}\nglobalThis.result = tree;`, context);
  const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props.children)] : [];
  return nodes(context.result);
}
test('wholesale campaign product uses actual web price and never retail campaign pricing', () => {
  const nodes = render();
  const badge = nodes.find(n => n.type === 'si-price');
  assert.ok(badge);
  assert.equal(badge.props.price, 220000);
  assert.equal(badge.props.webPrice, 300000);
  assert.equal(nodes.some(n => n.type === 'campaign-price'), false);
});
test('ordinary wholesale product retains its wholesale price badge', () => {
  assert.ok(render({ hasPromo: false, livePromo: null }).find(n => n.type === 'si-price'));
});
test('retail campaign product retains the campaign price section', () => {
  const nodes = render({ expectsSi: false, livePriceKind: 'web', liveGia: 300000 });
  assert.equal(nodes.some(n => n.type === 'si-price'), false);
  assert.equal(nodes.find(n => n.type === 'campaign-price').props.regularPrice, 300000);
});
test('wholesale pending and missing prices cannot show retail flash prices', () => {
  for (const extra of [{ pricePending: true, livePriceKind: 'web' }, { livePriceKind: 'si_missing', liveGia: 0 }]) {
    const nodes = render(extra);
    assert.equal(nodes.some(n => n.type === 'campaign-price' || n.type === 'si-price'), false);
  }
});
