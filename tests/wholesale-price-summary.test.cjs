const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, document: { body: {} }, require(name) {
    if (name === 'react') return { useState: () => [true, () => {}], useId: () => 'details', useEffect() {} };
    if (name === 'react-dom') return { createPortal: view => view };
    if (name === '@/lib/floatingStack') return { useStickyBarHeight: () => ({ current: null }) };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/api') return { formatVnd: String };
    if (name === '@/lib/checkoutFlags') return { shopShowCheckoutShipping: () => false };
    if (name === '@/lib/usePendingValue') return { usePendingValue: value => value };
    if (name === '@/lib/voucherFormat') return { voucherCustomerTitle: title => title };
    return {};
  }});
  return exports;
}
function text(node) {
  return Array.isArray(node) ? node.map(text).join('|') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node);
}
const { ProductPricingSummary } = load('frontend/components/pdp/ProductPricingSummary.tsx');
const { OrderPaymentSummary } = load('frontend/components/checkout/OrderPaymentSummary.tsx');
const { CheckoutStickyBar } = load('frontend/components/checkout/CheckoutStickyBar.tsx');
for (const qty of [1, 3]) {
  test(`PDP/cart/checkout show web comparison without double-discounting (${qty} units)`, () => {
    const quote = { subtotal: 26000 * qty, finalTotal: 26000 * qty, discountTotal: 0, wholesaleSavings: 14000 * qty };
    for (const view of [ProductPricingSummary({ pricing: { quote }, qty }), OrderPaymentSummary({ total: quote.subtotal, grandTotal: quote.finalTotal, wholesaleDiscount: quote.wholesaleSavings, cart: true }),
      CheckoutStickyBar({ total: quote.subtotal, grandTotal: quote.finalTotal, wholesaleDiscount: quote.wholesaleSavings, shippingFee: null })]) {
      const rendered = text(view);
      assert.ok(rendered.includes('Ưu đãi giá sỉ so với giá web'));
      for (const amount of [40000 * qty, 14000 * qty, 26000 * qty]) assert.ok(rendered.includes(String(amount)));
      assert.ok(!rendered.includes(String(12000 * qty)));
    }
  });
}
test('retail quotes keep their previous amounts and do not show wholesale comparison', () => {
  const quote = { subtotal: 40000, finalTotal: 38000, discountTotal: 2000 };
  for (const view of [ProductPricingSummary({ pricing: { quote } }), OrderPaymentSummary({ total: 40000, discount: 2000, grandTotal: 38000, cart: true })]) {
    const rendered = text(view);
    assert.ok(!rendered.includes('Ưu đãi giá sỉ'));
    assert.ok(rendered.includes('40000'));
    assert.ok(rendered.includes('38000'));
  }
});
