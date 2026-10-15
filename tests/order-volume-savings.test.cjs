const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '@/lib/api') return { formatVnd: value => String(value) };
    if (name === 'lucide-react') return {};
    if (name.includes('shared/orderSavings')) return load('shared/orderSavings.ts');
    throw Error(name);
  } });
  return exports;
}
const bits = load('frontend/components/order-status/OrderCampaignBits.tsx');
const orderDoc = load('backend/shopOrders/create/orderDoc.ts');
const details = [{ productCode: 'P', price: 135000, quantity: 10, volumePricing: { basePrice: 150000, discountPercent: 10, quantity: 10 } }];
const texts = node => Array.isArray(node) ? node.flatMap(texts) : node && typeof node === 'object' ? texts(node.props.children) : [node];
test('post-order original price and saved amount retain volume discounts from checkout', () => {
  const order = { orderDetails: details, subtotal: 1350000, discount: 67500, shippingDiscount: 5000 };
  assert.equal(bits.orderListSubtotal(order), 1500000);
  const rows = texts(bits.OrderGoodsSavings({ order }));
  assert.ok(rows.includes('Giảm theo số lượng')); assert.ok(rows.includes('150000'));
  assert.ok(texts(bits.OrderSavedTotal({ order })).includes('222500'));
});
test('new order documents persist volume savings independently of later catalog changes', () => {
  const doc = orderDoc.buildOrderDoc({ orderDetails: details, subtotal: 1350000, total: 1282500,
    discount: 67500, shippingFeeCharged: 0, deliveryMethod: 'nhan_cua_hang', now: '2026-10-15T03:00:00Z' });
  assert.equal(doc.volumeSavings, 150000);
  assert.equal(bits.orderListSubtotal({ ...doc, orderDetails: [] }), 1500000);
});
test('partial flash and gifts do not double count volume savings', () => {
  const order = { subtotal: 1280000, flashSavings: 70000, orderDetails: [
    { price: 100000, quantity: 2, flash: { listPrice: 135000 }, volumePricing: { basePrice: 150000 } },
    { price: 135000, quantity: 8, volumePricing: { basePrice: 150000 } },
    { isGift: true, price: 0, quantity: 1, volumePricing: { basePrice: 999999 } },
  ] };
  assert.equal(bits.orderListSubtotal(order), 1500000);
});
