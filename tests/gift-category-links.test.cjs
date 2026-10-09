const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const options = ['nguoi-thuong', 'gia-dinh', 'khai-truong', 'ban-lam-viec'].map(value => ({ value, label: value }));

test('gift menu opens the story pages and closes navigation on selection', () => {
  const code = ts.transpileModule(fs.readFileSync('frontend/components/GiftCategoryLinks.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { __esModule: true, default: 'link' };
    if (name === '@/lib/giftFilters') return { GIFT_FILTER_OPTIONS: options };
    throw new Error(name);
  } });
  let closed = 0;
  const tree = exports.GiftCategoryLinks({ onNavigate: () => closed++ });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props.children)] : [];
  }
  const links = nodes(tree).filter(n => n.type === 'link');
  assert.deepEqual(links.map(n => n.props.href), [...options.map(o => `/qua-tang/${o.value}`), '/qua-tang/doanh-nghiep']);
  links.forEach(n => n.props.onClick());
  assert.equal(closed, 5);
});
