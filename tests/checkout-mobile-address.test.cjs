const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
function setup(fail = false) {
  const states = [], refs = [], writes = [], selected = [], saved = [];
  let cursor = 0, refCursor = 0;
  const exports = {};
  const empty = { fullName: '', phone: '', detail: '', province: '', district: '', ward: '', ghnProvinceId: 0, ghnDistrictId: 0, ghnWardCode: '' };
  const address = { ...empty, id: 'a1', fullName: 'Customer', phone: '0901234567', detail: '12 Street', province: 'Province', district: 'District', ward: 'Ward', ghnProvinceId: 202, ghnDistrictId: 1234, ghnWardCode: '00567', isDefault: true };
  const code = ts.transpileModule(fs.readFileSync('frontend/components/checkout/CheckoutMobileAddress.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, document: { body: {} }, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useEffect() {}, useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; },
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => states[i] = typeof next === 'function' ? next(states[i]) : next]; } };
    if (name === 'react-dom') return { createPortal: tree => tree };
    if (name === 'lucide-react') return {};
    if (name === './checkoutTypes') return { EMPTY_DRAFT: empty };
    if (name === '@/components/GhnAddressFields') return { GhnAddressFields: 'fields' };
    if (name === '@/lib/checkoutSchemas') return { checkoutShipAddressSchema: { safeParse: v => ({ success: Boolean(v.customerName && v.customerPhone && v.province && v.ward && v.shippingAddress) }) } };
    if (name === '@/lib/orders') return {
      updateAddress: async (id, body) => { writes.push({ id, body }); if (fail) throw Error('save failed'); return { addresses: [{ ...body, id }] }; },
      createAddress: async body => { writes.push({ body }); return { addresses: [{ ...body, id: 'new' }], addressId: 'new' }; },
    };
    throw Error(name);
  } });
  const props = { addresses: [address], selectedAddr: address, draft: empty, showNewForm: false,
    onSelect: id => selected.push(id), onSaved: (list, id) => saved.push({ list, id }) };
  function flatten(node) { return Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props.children)] : []; }
  const render = () => { cursor = 0; refCursor = 0; return flatten(exports.CheckoutMobileAddress(props)); };
  const click = label => render().find(n => n.type === 'button' && (n.props.children === label || n.props['aria-label'] === label)).props.onClick();
  return { render, click, writes, selected, saved, address };
}
test('editing is isolated until save and preserves all geographic values and GHN codes', async () => {
  const h = setup(); h.render().find(n => n.type === 'button').props.onClick(); h.click('Chỉnh sửa');
  h.render().find(n => n.type === 'fields').props.onChange({ detail: '99 New Street' });
  assert.equal(h.address.detail, '12 Street'); assert.equal(h.writes.length, 0);
  await h.click('Lưu');
  const body = h.writes[0].body;
  for (const key of ['province', 'district', 'ward', 'ghnProvinceId', 'ghnDistrictId', 'ghnWardCode']) assert.equal(body[key], h.address[key]);
  assert.equal(body.detail, '99 New Street'); assert.equal(h.saved[0].id, 'a1');
});
test('discard confirmation cancels local edits without writing or selecting an address', () => {
  const h = setup(); h.render().find(n => n.type === 'button').props.onClick(); h.click('Chỉnh sửa');
  h.render().find(n => n.type === 'fields').props.onChange({ ward: 'Changed' }); h.click('Quay lại');
  assert.ok(h.render().some(n => n.props.role === 'alertdialog')); h.click('Thoát');
  assert.equal(h.writes.length, 0); assert.equal(h.selected.length, 0); assert.equal(h.address.ward, 'Ward');
});
test('failed save keeps the editor open and does not replace checkout address', async () => {
  const h = setup(true); h.render().find(n => n.type === 'button').props.onClick(); h.click('Chỉnh sửa');
  await h.click('Lưu'); assert.equal(h.saved.length, 0);
  assert.ok(h.render().some(n => n.props.role === 'alert' && n.props.children === 'save failed'));
  assert.ok(h.render().some(n => n.type === 'fields'));
});
