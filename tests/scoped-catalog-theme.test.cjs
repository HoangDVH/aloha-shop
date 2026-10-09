const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const code = ts.transpileModule(fs.readFileSync('frontend/components/catalog/ScopedProductCatalog.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function render(variant) {
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === './CatalogChipRow') return { CatalogChipRow: 'chip-row' };
    if (name === 'react') return { useMemo: fn => fn(), useState: v => [typeof v === 'function' ? v() : v, () => {}] };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { X: 'icon' };
    if (name === '@/lib/useLiveProductPrices') return { useLiveProductPrices: () => ({}) };
    if (name === '@/components/ProductCard') return { ProductGrid: 'grid' };
    if (name === './CatalogQuickFilters') return { CatalogQuickFilters: 'toolbar' };
    if (name === './CatalogFilterModal') return { CatalogFilterModal: 'modal' };
    if (name === './scopedProductFilters') return {
      emptyScopedFilters: () => ({ minPrice: '', maxPrice: '', dvts: [], attrs: [] }),
      filterScopedGroups: products => products,
      scopedProductFacets: () => ({ attributes: {}, dvt: [] }), filterScopedProducts: () => [],
    };
    throw new Error(name);
  } });
  return exports.ScopedProductCatalog({ products: [], variant, initialMinPrice: '300000', initialMaxPrice: '500000' });
}
test('campaign filters, modal and load-more controls inherit the active campaign color', () => {
  const tree = render('deal');
  assert.equal(tree.props.style['--aloha-green'], 'var(--campaign-primary, #C8102E)');
  assert.match(tree.props.style['--aloha-green-hover'], /var\(--campaign-primary/);
  const toolbar = tree.props.children.find(n => n?.type === 'toolbar');
  assert.equal(toolbar.props.minPrice, '300000');
  assert.equal(toolbar.props.maxPrice, '500000');
  assert.equal(toolbar.props.filterCount, 1);
});
test('regular gift catalogs keep the shop theme', () => {
  assert.equal(render('default').props.style, undefined);
});
