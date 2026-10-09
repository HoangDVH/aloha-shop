const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
const code = ts.transpileModule(fs.readFileSync('frontend/components/catalog/CatalogQuickFilters.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function fixture(minPrice = '', maxPrice = '', sort = 'ban_chay', extra = {}) {
  const exports = {}, calls = [];
  vm.runInNewContext(code, { exports, require(name) {
    if (name === './CatalogChipRow') return { CatalogChipRow: 'chip-row' };
    if(name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if(name === 'lucide-react') return { SlidersHorizontal: 'icon' };
    if(name === './PriceRangeFilter') return { PriceRangeFilter: 'custom-price' };
    if(name === './catalogLayoutUtils') return { SORT_OPTIONS: [{ value: 'ban_chay', label: 'Best sellers' }, { value: 'price_asc', label: 'Price ascending' }], PRICE_PRESETS: [{ label: 'Under 100k', min: 0, max: 100000 }, { label: 'Over 2m', min: 2000000, max: 0 }] };
    throw new Error(name);
  }});
  const tree = exports.CatalogQuickFilters({ minPrice, maxPrice, filterCount: 2, sort, onSortChange: v => calls.push(v), onPriceChange: (...v) => calls.push(v), onOpenFilters: () => calls.push('open'), ...extra });
  function nodes(n) { return Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props.children)] : []; }
  return { nodes: nodes(tree), calls };
}
test('all preset prices are direct buttons without a dropdown', () => {
  const f = fixture();
  assert.equal(f.nodes.filter(n => n.type === 'select').length, 0);
  const prices = f.nodes.filter(n => n.props['data-price'] !== undefined);
  assert.equal(prices.length, 4);
  prices.find(n => n.props['data-price'] === '0').props.onClick();
  assert.deepEqual(f.calls, [['0', '100000']]);
});
test('selected preset toggles off and all prices clears both bounds', () => {
  const f = fixture('0', '100000');
  const price = f.nodes.find(n => n.props['data-price'] === '0');
  assert.equal(price.props['aria-pressed'], true);
  price.props.onClick();
  f.nodes.find(n => n.props['data-price'] === 'all').props.onClick();
  assert.deepEqual(f.calls, [['', null], ['', null]]);
});
test('unbounded price applies minimum without an upper bound', () => {
  const f = fixture();
  f.nodes.find(n => n.props['data-price'] === '1').props.onClick();
  assert.deepEqual(f.calls, [['2000000', null]]);
});
test('custom range is visible and editing it opens full filters', () => {
  const f = fixture('150000', '250000');
  const price = f.nodes.find(n => n.props['data-price'] === 'custom');
  assert.equal(price.props['aria-pressed'], true);
  assert.match(price.props.children, /150[.,]000/);
  price.props.onClick();
  assert.deepEqual(f.calls, ['open']);
});

test('four direct badge tabs keep their labels and toggle an active selection off', () => {
  const f = fixture();
  const tabs = f.nodes.filter(n => n.props['aria-pressed'] !== undefined && n.props['data-price'] === undefined);
  assert.equal(tabs.length, 4);
  assert.deepEqual(Array.from(tabs, n => n.props['aria-pressed']), [false, false, false, false]);
  tabs.forEach(n => n.props.onClick());
  assert.deepEqual(f.calls, ['badge:noi_bat', 'badge:moi', 'badge:ban_chay_sap_het', 'badge:giam_gia']);
});

test('clicking the selected badge returns to the complete scoped list', () => {
  const f = fixture('', '', 'badge:moi');
  const active = f.nodes.find(n => n.props['aria-pressed'] === true && n.props['data-price'] === undefined);
  active.props.onClick();
  assert.deepEqual(f.calls, ['ban_chay']);
});

test('badge counts disable empty alternatives but allow clearing the selected badge', () => {
 const f = fixture('', '', 'badge:moi', { badgeCounts: { moi: 0, noi_bat: 0, giam_gia: 3 } });
 const tabs = f.nodes.filter(n => n.props['data-badge']);
 assert.equal(tabs.find(n => n.props['data-badge'] === 'noi_bat').props.disabled, true);
 assert.equal(tabs.find(n => n.props['data-badge'] === 'moi').props.disabled, false);
 assert.equal(tabs.find(n => n.props['data-badge'] === 'giam_gia').props.disabled, false);
});
test('price ordering has an independent callback and preserves active badge selection', () => {
 const calls = [];
 const f = fixture('', '', 'badge:moi', { priceSort: 'price_desc', onPriceSortChange: v => calls.push(v) });
 const select = f.nodes.find(n => n.type === 'select');
 assert.equal(select.props.value, 'price_desc');
 select.props.onChange({target:{value:'price_asc'}});
 assert.deepEqual(calls, ['price_asc']);
 assert.equal(f.nodes.find(n => n.props['data-badge'] === 'moi').props['aria-pressed'], true);
});
