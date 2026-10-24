const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const jsx = (type, props) => ({ type, props: props || {} });
function render(file, component, props, hooks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, document: { body: {} }, require: function moduleRequire(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState: hooks.useState || (() => [true, () => {}]), useEffect() {}, useId: () => 'qa', useRef: () => ({ current: null }) };
    if (name === 'react-dom') return { createPortal: tree => tree };
    if (name === '@/lib/api') return { formatVnd: value => String(value) };
    if (name === '@/lib/usePendingValue') return { usePendingValue: hooks.usePendingValue || ((value, pending) => pending ? null : value), useDelayedPending: hooks.useDelayedPending || (() => false) };
    if (name === './PriceUpdateIndicator') return { PriceUpdateIndicator: 'price-update' };
    if (name === '@/lib/checkoutFlags') return { shopShowCheckoutShipping: () => true };
    if (name === '@/lib/floatingStack') return { useStickyBarHeight: () => null };
    if (name === '@/components/cart/SmartFreeshipBar') return { SmartFreeshipBar: 'ship-progress' };
    if (name === 'lucide-react') return {};
    if (name === 'next/link') return { default: 'link' };
    if (name === '@/lib/cart') return { useCart: selector => selector({ setQty() {}, setLineNote() {} }) };
    if (name === '@/lib/cartVariant') return { formatVariantLabel: () => '' };
    if (name === '@/lib/campaign/campaignQuote') return { giftLinesOf: () => [], flashLineFor: () => null };
    if (name === './CampaignLineBits') return {};
    if (name === '@/lib/voucherFormat') return { formatAppliedVoucherTitle: (promo, title) => title || 'Voucher shop' };
    if (name === '@/components/Toast') return { useToast: () => ({ push() {} }) };
    if (name === './DeliverySpeedSelector') return { DeliverySpeedSelector: () => null };
    if (name === './CheckoutOrderNoteSheet') return { CheckoutOrderNoteSheet: 'note-sheet' };
    if (name === './OrderPaymentSummary') {
      const shared = {};
      const source = ts.transpileModule(fs.readFileSync('frontend/components/checkout/OrderPaymentSummary.tsx', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
      vm.runInNewContext(source, { exports: shared, require: moduleRequire });
      return shared;
    }
    throw new Error(name);
  } });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (node && typeof node.type === 'function') return nodes(node.type(node.props));
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

function summarySequence() {
  let index = 0;
  const committed = [];
  return props => {
    index = 0;
    return render('frontend/components/checkout/OrderPaymentSummary.tsx', 'OrderPaymentSummary', props, {
      usePendingValue(value, pending, scope) {
        const i = index++;
        if (!pending) committed[i] = { value, scope };
        return pending ? committed[i]?.scope === scope ? committed[i].value : null : value;
      },
    });
  };
}
const confirmedSummary = { total: 250000, anchorDiscount: 94000, discount: 12500, grandTotal: 252500,
  shippingFee: 20000, shippingDiscount: 5000, delivery: 'giao_tan_noi', priceScopeKey: 'buyer-a' };

test('refresh keeps the complete price breakdown and confirmed numbers rather than replacing the table', () => {
  const paint = summarySequence();
  const before = paint(confirmedSummary);
  const pending = paint({ ...confirmedSummary, total: 999999, discount: 0, anchorDiscount: 0,
    shippingFee: null, shippingDiscount: 0, grandTotal: 999999, totalPending: true, shippingLoading: true });
  for (const amount of ['344000', '237500', '252500', '20000']) assert.ok(values(pending).includes(amount), amount);
  assert.ok(!values(pending).includes('999999'));
  assert.deepEqual(pending.map(n => n.type), before.map(n => n.type));
  assert.equal(pending.filter(n => n.type === 'ship-progress').length, 1);
  assert.equal(pending.find(n => n.type === 'price-update').props.pending, true);
  assert.equal(pending.find(n => n.props['data-price-region'] === 'goods').props['aria-busy'], true);
});

test('address refresh marks only shipping and total pending, and accepts the new quote afterwards', () => {
  const paint = summarySequence(); paint(confirmedSummary);
  const pending = paint({ ...confirmedSummary, shippingFee: null, shippingDiscount: 0, grandTotal: 237500, shippingLoading: true });
  const region = name => pending.find(n => n.props['data-price-region'] === name);
  assert.equal(region('goods').props['aria-busy'], false);
  assert.ok(region('goods').props.className.includes('opacity-100'));
  assert.equal(region('shipping').props['aria-busy'], true);
  assert.equal(region('total').props['aria-busy'], true);
  assert.ok(values(pending).includes('252500'));
  const ready = paint({ ...confirmedSummary, shippingFee: 30000, grandTotal: 262500 });
  assert.ok(values(ready).includes('262500'));
  assert.ok(!values(ready).includes('252500'));
});

test('pending prices disable the checkout action while retaining existing form controls', () => {
  const nodes = aside({ delivery: 'giao_tan_noi', totalPending: true, canSubmit: true, submitting: false });
  const action = nodes.find(n => n.type === 'button' && n.props.className?.includes('hidden lg:block'));
  assert.equal(action.props.disabled, true);
  const mobile = sticky({ totalPending: true, canSubmit: true, submitting: false });
  assert.equal(mobile.find(n => n.type === 'button' && n.props.className?.includes('min-w-[110px]')).props.disabled, true);
});

test('loading indicator occupies the same space before and after its delayed reveal', () => {
  const indicator = visible => render('frontend/components/checkout/PriceUpdateIndicator.tsx', 'PriceUpdateIndicator',
    { pending: true }, { useDelayedPending: () => visible });
  const hidden = indicator(false), shown = indicator(true);
  assert.equal(hidden[0].props.className, shown[0].props.className);
  assert.ok(hidden[0].props.className.includes('w-[96px]'));
  assert.ok(hidden.some(n => n.props.className?.includes('invisible')));
  assert.ok(shown.some(n => n.props.className?.includes('animate-spin motion-reduce:animate-none')));
});

test('cart and checkout share identical product breakdown, savings and total styling', () => {
  const props = { total: 250000, anchorDiscount: 94000, discount: 12500, grandTotal: 237500, showFreeshipProgress: false };
  const summary = cart => render('frontend/components/checkout/OrderPaymentSummary.tsx', 'OrderPaymentSummary', { ...props, cart });
  const cart = summary(true), checkout = summary(false);
  for (const text of ['Tóm tắt đơn hàng', 'Giá gốc sản phẩm', 'Giảm giá sản phẩm', 'Voucher shop', 'Tiền hàng sau ưu đãi', '344000', '237500']) {
    assert.ok(values(cart).includes(text), text);
    assert.ok(values(checkout).includes(text), text);
  }
  assert.equal(cart.find(n => n.type === 'section').props.className, checkout.find(n => n.type === 'section').props.className);
  assert.ok(values(cart).includes('Tính tại bước xác nhận đơn'));
  assert.ok(!cart.some(n => n.type === 'ship-progress'));
  const totalStyle = nodes => nodes.find(n => n.props.className?.includes('text-2xl')).props.className;
  assert.equal(totalStyle(cart), totalStyle(checkout));
});

test('mobile shop header edits the order-wide note with the existing 255-character limit', () => {
  let value;
  const nodes = render('frontend/components/checkout/CheckoutLineItems.tsx', 'CheckoutLineItems', {
    selected: [], note: 'Call before delivery', onNoteChange: next => value = next,
  });
  const editor = nodes.find(n => n.type === 'note-sheet');
  assert.equal(editor.props.note, 'Call before delivery');
  editor.props.onSave('Gift wrapping');
  assert.equal(value, 'Gift wrapping');
  const trigger = nodes.find(n => n.type === 'button' && n.props['aria-haspopup'] === 'dialog');
  assert.ok(trigger.props.className.includes('lg:hidden'));
});

test('note sheet isolates typing, saves explicitly and allows clearing the saved note', () => {
  let draft = 'Existing note', saved = [], closed = 0;
  const props = { note: 'Existing note', onSave: value => saved.push(value), onClose: () => closed++ };
  const sheet = () => render('frontend/components/checkout/CheckoutOrderNoteSheet.tsx', 'CheckoutOrderNoteSheet', props,
    { useState: () => [draft, next => draft = next] });
  let nodes = sheet();
  assert.ok(nodes.some(n => n.props.role === 'dialog'));
  const input = nodes.find(n => n.type === 'textarea');
  assert.equal(input.props.maxLength, 255);
  input.props.onChange({ target: { value: 'New note' } });
  assert.equal(saved.length, 0);
  nodes.find(n => n.props['aria-label'] === 'Đóng ghi chú').props.onClick();
  assert.equal(saved.length, 0); assert.equal(closed, 1);
  sheet().find(n => n.type === 'button' && n.props.children === 'Lưu').props.onClick();
  assert.deepEqual(saved, ['New note']); assert.equal(closed, 2);
  draft = '';
  sheet().find(n => n.type === 'button' && n.props.children === 'Lưu').props.onClick();
  assert.deepEqual(saved, ['New note', '']);
});

test('compact mobile pricing shows one unit price and a single reference-price row', () => {
  const nodes = render('frontend/components/checkout/CampaignLineBits.tsx', 'MobileCartPrice', {
    gia: 250000, referencePrice: 344000, qty: 3, flash: null,
  });
  assert.equal(nodes.filter(n => n.props['aria-label'] === 'Đơn giá hiện tại').length, 1);
  assert.ok(values(nodes).includes('250000'));
  assert.ok(values(nodes).includes('344000'));
  assert.ok(!values(nodes).includes('750000'));
  const badge = nodes.find(n => n.type === 'span' && n.props.className?.includes('bg-rose-50'));
  assert.equal(badge.props.children.join(''), '-27%');
});

test('compact mobile pricing keeps partial flash quantities explicit and hides nonexistent discounts', () => {
  const regular = render('frontend/components/checkout/CampaignLineBits.tsx', 'MobileCartPrice', { gia: 250000, qty: 1, flash: null });
  assert.ok(!regular.some(n => n.props.className?.includes('line-through')));
  const partial = render('frontend/components/checkout/CampaignLineBits.tsx', 'MobileCartPrice', {
    gia: 250000, qty: 3, flash: { salePrice: 200000, listPrice: 250000, saleQty: 1, lineTotal: 700000 },
  });
  assert.ok(values(partial).includes('200000'));
  const note = partial.find(n => n.type === 'p' && n.props.className?.includes('text-amber-700'));
  assert.equal(note.props.children[0], 1);
  assert.equal(note.props.children[2], 2);
});

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

test('shared summary renders only one shipping progress bar and hides it for pickup or pending totals', () => {
  const progress = props => aside(props).filter(n => n.type === 'ship-progress');
  assert.equal(progress({ delivery: 'giao_tan_noi' }).length, 1);
  assert.equal(progress({ delivery: 'nhan_cua_hang' }).length, 0);
  assert.equal(progress({ delivery: 'giao_tan_noi', totalPending: true }).length, 0);
});
const unitPrice = props => render('frontend/components/checkout/CampaignLineBits.tsx', 'CartUnitPrice', props);
test('ordinary discount shows its reference price only when higher than payable price', () => {
  const discounted = unitPrice({ gia: 250000, referencePrice: 300000, qty: 2, flash: null });
  assert.ok(values(discounted).includes('250000'));
  assert.ok(values(discounted).includes('300000'));
  assert.ok(discounted.some(n => n.props.className?.includes('line-through')));
  for (const referencePrice of [250000, 200000, undefined]) {
    assert.equal(unitPrice({ gia: 250000, referencePrice, qty: 1, flash: null }).some(n => n.props.className?.includes('line-through')), false);
  }
});
test('summary is visible on mobile and retains the desktop order button', () => {
  const nodes = aside({ delivery: 'nhan_cua_hang' });
  assert.ok(!nodes.find(n => n.type === 'section').props.className.includes('hidden'));
  assert.ok(nodes.some(n => n.type === 'button' && n.props.className?.includes('hidden lg:block')));
});
