const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
const code = ts.transpileModule(fs.readFileSync('frontend/components/catalog/CatalogSortBar.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function render(open) {
  const exports = {}, calls = [];
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {};
    if (name === 'lucide-react') return { ChevronUp: 'icon' };
    if (name === './catalogLayoutUtils') return { SORT_TOOLBAR: [
      { value: 'moi', label: 'New' }, { value: 'price', label: 'Price' },
    ] };
    throw new Error(name);
  }});
  return { tree: exports.CatalogSortBar({ sort: 'price_asc', priceMenuOpen: open,
    onSortClick: value => calls.push(value), onSelectPriceSort: value => calls.push(value) }), calls };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props.children)];
}
test('price options render outside the horizontal scrolling container', () => {
  const { tree } = render(true);
  const scroll = nodes(tree).find(n => n.props.className?.includes('overflow-x-auto'));
  assert.equal(nodes(scroll).filter(n => n.type === 'button').length, 2);
  const menu = tree.props.children.find(n => n?.props?.className?.includes('absolute right-0'));
  assert.ok(menu);
  assert.ok('data-price-sort-menu' in menu.props);
  assert.equal(nodes(menu).filter(n => n.type === 'button').length, 2);
});
test('both price directions preserve navigation callbacks', () => {
  const { tree, calls } = render(true);
  const menu = tree.props.children.find(n => n?.props?.className?.includes('absolute right-0'));
  for (const button of nodes(menu).filter(n => n.type === 'button')) {
    button.props.onClick({ stopPropagation() {} });
  }
  assert.deepEqual(calls, ['price_asc', 'price_desc']);
});
test('closed price menu hides options and exposes collapsed trigger state', () => {
  const { tree, calls } = render(false);
  const trigger = nodes(tree).find(n => n.type === 'button' && 'aria-expanded' in n.props);
  assert.equal(trigger.props['aria-expanded'], false);
  assert.equal(nodes(tree).filter(n => n.type === 'button').length, 2);
  trigger.props.onClick({ stopPropagation() {} });
  assert.deepEqual(calls, ['price']);
});

test('category options stay in the filter sheet while selected results stay on the toolbar', () => {
  const source = fs.readFileSync('frontend/components/catalog/CatalogSubcatBar.tsx', 'utf8');
  assert.ok(source.includes('row="selected"'));
  assert.ok(!source.includes('row="children"'));
  assert.ok(source.includes('{sheetOptionsRow}'));
  assert.ok(source.includes('<CatalogChipRow'));
  assert.ok(source.includes('selectedL3s.map((n) => n.id), l3.id'));
  assert.ok(source.includes('keepFilters: true'));
});

test('selected category chips are marked visible before the row flattens them', () => {
 const source = fs.readFileSync('frontend/components/catalog/CatalogSubcatBar.tsx','utf8');
 assert.equal((source.match(/<SelectedChip\s+data-always-visible/g)||[]).length,3);
});
