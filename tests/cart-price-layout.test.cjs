const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
function render(selected = true, pending = false) {
  const exports = {}, removed = [], quantityChanges = [];
  const line = { ma: 'A', ten: 'Product', qty: 2, gia: 250000, selected, path: '/sp/A', dvt: 'Cai' };
  const cart = { lines: [line], remove: ma => removed.push(ma), setQty: (ma, qty) => quantityChanges.push({ ma, qty }) };
  const quote = { subtotal: 500000, discountTotal: 0, campaign: { lines: [
    { ma: 'A', price: 250000, quantity: 2, compareAtPrice: 344000 },
    { ma: 'A', price: 0, quantity: 1, compareAtPrice: 999999, isGift: true },
  ] } };
  const code = ts.transpileModule(fs.readFileSync('frontend/app/(storefront)/gio-hang/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState: value => [value, () => {}], useEffect() {}, useMemo: fn => fn() };
    if (name === 'next/link') return 'link';
    if (name === 'lucide-react') return {};
    if (name === '@/lib/cart') return { useCart: fn => fn(cart), stockMax: () => null, isPreOrderTon: () => false };
    if (name === '@/lib/api') return { formatVnd: value => String(value) };
    if (name === '@/lib/usePendingValue') return { usePendingValue: (value, pending) => pending ? null : value };
    if (name === '@/components/checkout/PriceUpdateIndicator') return { PriceUpdateIndicator: 'price-update' };
    if (name === '@/lib/cartVariant') return { formatVariantLabel: () => '' };
    if (name === '@/lib/useShopRouter') return { useShopRouter: () => ({}) };
    if (name === '@/components/ShopAuthProvider') return { useShopAuth: () => ({ user: {} }) };
    if (name === '@/lib/usePromotionQuote') return { usePromotionQuote: () => ({ quote, loading: pending }) };
    if (name === '@/components/checkout/useCandidateClaim') return { useCandidateClaim: () => ({}) };
    if (name === '@/components/checkout/useManualCodeFallback') return { useManualCodeFallback() {} };
    if (name === '@/lib/floatingStack') return { useStickyBarHeight: () => null };
    if (name === '@/components/cart/SmartFreeshipBar') return { useMoreShoppingHref: () => '/', SmartFreeshipBar: 'ship' };
    if (name === '@/components/checkout/CampaignLineBits') return { MobileCartPrice: 'unit-price' };
    if (name === '@/components/checkout/OrderPaymentSummary') return { OrderPaymentSummary: 'payment-summary' };
    if (name === '@/lib/campaign/campaignQuote') return { flashLineFor: () => null, giftLinesOf: () => [], useCampaignCartNotices() {}, useCampaignRequoteKey: () => '' };
    return {};
  } });
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props.children)] : [];
  return { nodes: flatten(exports.default()), removed, quantityChanges };
}
test('cart desktop and mobile use the same real reference price, excluding gift rows', () => {
  const prices = render().nodes.filter(n => n.type === 'unit-price');
  assert.equal(prices.length, 2);
  for (const price of prices) { assert.equal(price.props.gia, 250000); assert.equal(price.props.referencePrice, 344000); }
});
test('unselected cart rows do not inherit stale campaign prices', () => {
  for (const price of render(false).nodes.filter(n => n.type === 'unit-price')) assert.equal(price.props.referencePrice, 250000);
});
test('cart uses the shared payment summary with the server subtotal and no duplicate freeship bar', () => {
  const summary = render().nodes.find(n => n.type === 'payment-summary');
  assert.ok(summary);
  assert.equal(summary.props.total, 500000);
  assert.equal(summary.props.grandTotal, 500000);
  assert.equal(summary.props.cart, true);
  assert.equal(summary.props.showFreeshipProgress, false);
});
test('cart blocks checkout while repricing but quantity controls remain usable', () => {
  const { nodes, quantityChanges } = render(true, true);
  const checkout = nodes.filter(n => n.type === 'button' && n.props.className?.includes('text-white'));
  assert.equal(checkout.length, 2);
  assert.ok(checkout.every(n => n.props.disabled));
  const qty = nodes.find(n => typeof n.type === 'function' && n.type.name === 'QtyCtrl');
  qty.props.onPlus(); assert.deepEqual(quantityChanges, [{ ma: 'A', qty: 3 }]);
  assert.ok(nodes.some(n => n.type === 'price-update' && n.props.pending));
});
test('each cart row has one delete button anchored inside the row on mobile', () => {
  const { nodes, removed } = render();
  const row = nodes.find(n => n.type === 'li');
  assert.ok(row.props.className.includes('relative'));
  const buttons = nodes.filter(n => n.type === 'button' && n.props['aria-label'] === 'Xóa');
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0].props.className.includes('absolute right-1 top-2'));
  assert.ok(buttons[0].props.className.includes('lg:static'));
  buttons[0].props.onClick(); assert.deepEqual(removed, ['A']);
});
