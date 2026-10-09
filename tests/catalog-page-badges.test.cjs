const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function load(path) {
  const calls = [], exports = {};
  const source = fs.readFileSync(path, 'utf8') + (path === 'frontend/app/(storefront)/page.tsx' ? '\nexport { HomeCatalog, hasActiveFilters };' : '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { Suspense: 'suspense' };
    if (name === '@/lib/appearance') return { fetchAppearance: async () => ({ blocks: [] }) };
    if (name.includes('HomeBlockRenderer')) return { renderTopBlocks: async () => null };
    if (name === '@/lib/webBadge') return { normalizeWebBadge: value => value === 'ban_chay' ? 'ban_chay_sap_het' : ['noi_bat', 'moi', 'ban_chay_sap_het', 'giam_gia'].includes(value) ? value : '' };
    if (name === '@/lib/shopCatalogSessionServer') return { fetchSessionProducts: async opts => { calls.push(opts); return { items: [{ ma: opts.badge }], total: 1, pages: 1 }; } };
    if (name === '@/lib/api') return { fetchCategories: async () => ({ items: [] }), fetchCategoryTree: async () => ({ items: [{ id: 10, slug: 'plants', name: 'Plants', path: 'Plants' }] }) };
    if (name === '@/lib/parseNhom') return { parseNhomList: () => [] };
    if (name === '@/lib/parseShopFilters') return { parseAttrList: () => [], parseDvtList: () => [] };
    if (name === '@/lib/seo') return { shouldNoIndexCatalog: () => false };
    return new Proxy({}, { get: (_, key) => key });
  } });
  return { exports, calls };
}
test('category SSR forwards all four badge selections and keeps multi-category and price scope', async () => {
  const f = load('frontend/app/(storefront)/danh-muc/[slug]/page.tsx');
  for (const badge of ['noi_bat', 'moi', 'ban_chay_sap_het', 'giam_gia']) {
    const tree = f.exports.default({ params: Promise.resolve({ slug: 'plants' }), searchParams: Promise.resolve({ badge, categoryId: ['11', '12'], minPrice: '100', sort: 'ban_chay' }) });
    const body = tree.props.children;
    await body.type(body.props);
    const call = f.calls.at(-1);
    assert.equal(call.badge, badge);
    assert.deepEqual(Array.from(call.categoryId), [11, 12]);
    assert.equal(call.minPrice, 100);
  }
});
test('category SSR ignores invalid badges and normalizes legacy best-seller badge', async () => {
  const f = load('frontend/app/(storefront)/danh-muc/[slug]/page.tsx');
  for (const [badge, expected] of [['invalid', undefined], ['ban_chay', 'ban_chay_sap_het']]) {
    const body = f.exports.default({ params: Promise.resolve({ slug: 'plants' }), searchParams: Promise.resolve({ badge }) }).props.children;
    await body.type(body.props);
    assert.equal(f.calls.at(-1).badge, expected);
  }
});

test('home badge selections activate catalog mode and reach the scoped product request', async () => {
  const f = load('frontend/app/(storefront)/page.tsx');
  for (const badge of ['noi_bat', 'moi', 'ban_chay_sap_het', 'giam_gia']) {
    assert.equal(f.exports.hasActiveFilters({ badge }), true);
    await f.exports.HomeCatalog({ searchParams: Promise.resolve({ badge }) });
    assert.equal(f.calls.at(-1).badge, badge);
    assert.equal(f.calls.at(-1).home, true);
  }
});
