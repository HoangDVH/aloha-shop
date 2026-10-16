const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
function fixture(patch = {}) {
  let expanded = false;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/components/order-status/OrderOverview.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name) {
    if (name === 'react') return { useState: () => [expanded, value => { expanded = typeof value === 'function' ? value(expanded) : value; }] };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/api') return { formatVnd: String };
    if (name === '@/lib/orders') return { displayShopOrderCode: order => order.kvOrderCode || order.code };
    if (name === '@/lib/orderShippingStatus') return { isOrderShippingPending: order => order.shippingFeePending === true };
    if (name === './OrderCampaignBits') return { orderListSubtotal: order => order.subtotal };
    return {};
  }});
  const order = { code: 'WEB-1', kvOrderCode: 'DH001', orderStatus: 'cho_xac_nhan', method: 'Pending', paymentStatus: 'unpaid',
    subtotal: 100000, total: 120000, shippingFee: 20000, shippingFeeOriginal: 40000, shippingDiscount: 20000,
    customerName: 'Receiver', customerPhone: '0900000000', customerNote: 'Deliver carefully',
    orderDetails: Array.from({ length: 5 }, (_, i) => ({ productCode: `P${i}`, productName: `Product ${i}`, quantity: 1, price: 20000, variantLabel: `Variant ${i}`, note: `Note ${i}`, isGift: i === 4 })), ...patch };
  const render = () => exports.OrderOverview({ order, hero: { title: 'Received', subtitle: 'Original subtitle', tone: 'wait' }, addressLine: 'Street, Ward, District, Province' });
  return { render, order };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === 'object' ? [node, ...nodes(node.props.children)] : [];
}
function text(node) {
  return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
}
test('retail and wholesale retain all products, gifts, variants, notes and money in the same overview', () => {
  for (const priceMode of ['web', 'si']) {
    const f = fixture({ priceMode });
    const root = f.render(), output = text(root);
    assert.equal(output.split('Aloha sẽ gửi ảnh').length - 1, 1);
    for (const value of ['DH001', 'Receiver', '0900000000', 'Deliver carefully', 'Variant 0', 'Note 4', '100000', '40000', '20000', '120000']) assert.ok(output.includes(value), value);
    const hidden = nodes(root).filter(n => n.type === 'li' && n.props.className.includes('hidden'));
    assert.equal(hidden.length, 4);
    const toggle = nodes(root).find(n => n.type === 'button' && n.props['aria-expanded'] === false);
    toggle.props.onClick();
    assert.equal(nodes(f.render()).filter(n => n.type === 'li' && n.props.className.includes('hidden')).length, 0);
    assert.ok(text(f.render()).includes('Thu gọn sản phẩm'));
  }
});
test('shipping charge and total stay visible outside collapsed details on mobile', () => {
  const root = fixture().render();
  const secondary = nodes(root).filter(n => n.type === 'details').map(text).join('');
  assert.ok(!secondary.includes('Phí vận chuyển'));
  assert.ok(!secondary.includes('Tổng tạm tính'));
  assert.ok(text(root).includes('Phí ship thực trả'));
  assert.ok(text(fixture({ shippingFeePending: true }).render()).includes('Chưa gồm phí vận chuyển'));
});
