const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: dependencies });
  return exports;
}
const { isOrderShippingPending } = load('frontend/lib/orderShippingStatus.ts', () => { throw Error('unexpected runtime import'); });
function render(view, patch) {
  const order = { code: 'TEST', deliveryMethod: 'giao_tan_noi', orderDetails: [], subtotal: 500000,
    discount: 25000, shippingFee: 40700, total: 515700, shippingEstimate: { status: 'estimated' }, ...patch };
  const dependencies = name => {
    if (name === 'react') return { default: { useMemo: fn => fn() }, useState: value => [value, () => {}] };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/api') return { formatVnd: value => String(value) };
    if (name === '@/lib/orderShippingStatus') return { isOrderShippingPending };
    if (name === '@/lib/orders') return { displayShopOrderCode: o => o.code };
    if (name === './OrderCampaignBits') return { orderListSubtotal: o => o.subtotal };
    if (name === './OrderOverview') return load('frontend/components/order-status/OrderOverview.tsx', dependencies);
    return {};
  };
  const module = load(`frontend/components/order-status/${view}.tsx`, dependencies);
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? typeof node.type === 'function' ? flatten(node.type(node.props)) : [node, ...flatten(node.props.children)] : [];
  return flatten(module[view]({ order, hero: { Icon: 'hero', tone: 'done', title: 'Success' }, reload: async () => {} }));
}
const texts = nodes => nodes.map(n => n.props.children).filter(v => typeof v === 'string');
for (const view of ['OrderSuccessView', 'OrderPendingView']) {
  test(`${view}: charged shipping remains included even when old estimate status is unresolved`, () => {
    for (const status of ['estimated', 'needs_confirmation', 'unavailable']) {
      const nodes = render(view, { shippingEstimate: { status } });
      assert.ok(texts(nodes).includes('Đã gồm phí vận chuyển'));
      assert.ok(!texts(nodes).includes('Chưa gồm phí vận chuyển'));
      assert.ok(texts(nodes).includes('515700'));
      assert.ok(texts(nodes).includes('40700'));
    }
  });
  test(`${view}: unknown shipping, pickup, free shipping and discounted shipping stay accurate`, () => {
    const unknown = texts(render(view, { shippingFee: 0, shippingFeePending: true, total: 475000, shippingEstimate: { status: 'needs_confirmation' } }));
    assert.ok(unknown.includes('Chưa gồm phí vận chuyển'));
    assert.ok(!unknown.includes('Đã gồm phí vận chuyển'));
    const free = texts(render(view, { shippingFee: 0, shippingFeePending: false, freeShipApplied: true, total: 475000 }));
    assert.ok(free.includes('Đã gồm phí vận chuyển'));
    const pickup = texts(render(view, { deliveryMethod: 'nhan_cua_hang', shippingFeePending: true, shippingFee: 0 }));
    assert.ok(!pickup.includes('Chưa gồm phí vận chuyển'));
    const discounted = texts(render(view, { shippingFee: 20700, shippingFeeOriginal: 40700, shippingDiscount: 20000, total: 495700 }));
    assert.ok(discounted.includes('Đã gồm phí vận chuyển'));
    assert.ok(discounted.includes('495700'));
    assert.ok(discounted.includes('40700'));
  });
}
test('legacy pending flags do not override a fee already charged and synchronized from KiotViet', () => {
  assert.equal(isOrderShippingPending({ deliveryMethod: 'giao_tan_noi', shippingFee: 40700, shippingFeePending: true, shippingEstimate: { status: 'needs_confirmation' } }), false);
  assert.equal(isOrderShippingPending({ deliveryMethod: 'giao_tan_noi' }), true);
});
