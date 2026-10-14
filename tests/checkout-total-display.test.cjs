const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const jsx = (type, props) => ({ type, props: props || {} });
function render(file, component, props) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, document: { body: {} }, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState: () => [true, () => {}], useEffect() {}, useId: () => 'qa' };
    if (name === 'react-dom') return { createPortal: tree => tree };
    if (name === '@/lib/api') return { formatVnd: value => String(value) };
    if (name === '@/lib/checkoutFlags') return { shopShowCheckoutShipping: () => true };
    if (name === '@/lib/floatingStack') return { useStickyBarHeight: () => null };
    if (name === '@/components/cart/SmartFreeshipBar') return { SmartFreeshipBar: 'ship-progress' };
    if (name === 'lucide-react') return {};
    throw new Error(name);
  } });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props.children)] : [];
  }
  return nodes(exports[component](props));
}
const aside = props => render('frontend/components/checkout/CheckoutSummaryAside.tsx', 'CheckoutSummaryAside', {
  total: 40000, discount: 2000, grandTotal: 38000, shippingFee: null, shippingLoading: false, ...props,
});
const sticky = props => render('frontend/components/checkout/CheckoutStickyBar.tsx', 'CheckoutStickyBar', {
  total: 40000, discount: 2000, grandTotal: 38000, shippingFee: null, ...props,
});
const values = nodes => nodes.map(n => n.props.children).filter(v => typeof v === 'string');

test('desktop and mobile agree after voucher for pickup, unknown shipping, charged and discounted shipping', () => {
  for (const [delivery, shippingFee, grandTotal] of [
    ['nhan_cua_hang', null, 38000], ['giao_tan_noi', null, 38000],
    ['giao_tan_noi', 20000, 58000], ['giao_tan_noi', 20000, 53000], ['giao_tan_noi', 0, 38000],
  ]) {
    const props = { delivery, shippingFee, grandTotal, shippingDiscount: grandTotal === 53000 ? 5000 : 0 };
    assert.ok(values(aside(props)).includes(String(grandTotal)));
    assert.ok(values(sticky({ ...props, deliveryMethod: delivery })).includes(String(grandTotal)));
  }
});

test('anchor and volume savings are already in server subtotal and must not be deducted twice', () => {
  assert.ok(values(aside({ delivery: 'nhan_cua_hang', total: 45000, flashDiscount: 5000,
    anchorDiscount: 10000, volumeDiscount: 1000 })).includes('38000'));
  assert.ok(values(sticky({ deliveryMethod: 'nhan_cua_hang', total: 56000, discount: 18000,
    flashDiscount: 5000, productDiscount: 10000, volumeDiscount: 1000 })).includes('38000'));
  assert.ok(values(aside({ delivery: 'nhan_cua_hang', discount: 60000, grandTotal: 0 })).includes('0'));
});

test('pending totals are hidden in desktop, mobile and final confirmation; confirm is disabled', () => {
  assert.ok(!values(aside({ delivery: 'nhan_cua_hang', totalPending: true })).includes('38000'));
  assert.ok(!values(sticky({ totalPending: true })).includes('38000'));
  const modal = render('frontend/components/checkout/BackorderConfirmModal.tsx', 'PreOrderCodConfirmModal', {
    open: true, total: 38000, totalPending: true, onAgree() {}, onClose() {},
  });
  assert.ok(!values(modal).includes('38000'));
  assert.equal(modal.find(n => n.type === 'button' && n.props.onClick && n.props.children === 'Đồng ý').props.disabled, true);
});

test('free shipping progress still uses goods subtotal before the order voucher', () => {
  const progress = aside({ delivery: 'giao_tan_noi' }).find(n => n.type === 'ship-progress');
  assert.equal(progress.props.currentAmount, 40000);
});
