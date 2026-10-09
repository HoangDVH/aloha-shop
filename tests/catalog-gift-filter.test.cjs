const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
function load(path, require) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require });
  return exports;
}
function nodes(n) { return Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props.children)] : []; }
test('gift buttons toggle selections while business gifts remain a separate link', () => {
  const { GiftFilterSection } = load('frontend/components/catalog/GiftFilterSection.tsx', name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'link' };
    if (name === '@/lib/giftFilters') return { GIFT_FILTER_OPTIONS: [{ value: 'gia-dinh', label: 'Family' }, { value: 'nguoi-thuong', label: 'Partner' }] };
    throw new Error(name);
  });
  const calls = [];
  const elements = nodes(GiftFilterSection({ value: 'gia-dinh', onChange: v => calls.push(v) }));
  const buttons = elements.filter(n => n.type === 'button');
  assert.equal(buttons[0].props['aria-pressed'], true);
  buttons[0].props.onClick(); buttons[1].props.onClick();
  assert.deepEqual(calls, ['', 'nguoi-thuong']);
  assert.ok(elements.some(n => n.props.href === '/qua-tang/doanh-nghiep'));
});
test('gift URL restores draft together with existing price and attribute selections', () => {
  const { draftFromUrl } = load('frontend/components/catalog/draft.ts', name => {
    if (name === 'react') return {};
    if (name === '@/lib/api') return {};
    throw new Error(name);
  });
  const draft = draftFromUrl(new URLSearchParams('gift=gia-dinh&minPrice=100000&maxPrice=300000&attr=Size:M'), ['Plants']);
  assert.equal(draft.gift, 'gia-dinh');
  assert.equal(draft.minPrice, '100000');
  assert.equal(draft.maxPrice, '300000');
  assert.equal(draft.attrs[0], 'Size:M');
});
