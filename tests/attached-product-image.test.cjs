const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(item) {
  const exports = {}, state = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: props || {} });
  const source = ts.transpileModule(fs.readFileSync('frontend/components/pdp/AttachedProductImage.tsx', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useMemo: fn => fn(),
      useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], v => { state[i] = v; }]; },
    };
    if (name === 'lucide-react') return { Maximize2: 'icon' };
    if (name === './ProductVideoLightbox') return { ProductVideoLightbox: 'lightbox' };
    throw Error(name);
  } });
  const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props.children)] : [];
  return { render(next = item) { cursor = 0; return nodes(exports.AttachedProductImage({ item: next })); } };
}

test('clicking an attached product image opens all unique images in the thumbnail lightbox; close and reopen reset it', () => {
  const h = fixture({ ten: 'Túi H5', anh: 'main.jpg', images: ['main.jpg', 'side.jpg', '', ' side.jpg ', 'bottom.jpg'] });
  let tree = h.render();
  const button = tree.find(n => n.type === 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.href, undefined);
  assert.equal(button.props['aria-expanded'], false);
  assert(!tree.some(n => n.type === 'lightbox'));
  button.props.onClick(); tree = h.render();
  const viewer = tree.find(n => n.type === 'lightbox');
  assert.equal(viewer.props.open, true);
  assert.equal(viewer.props.startIndex, 0);
  assert.equal(viewer.props.alt, 'Túi H5');
  assert.deepEqual(Array.from(viewer.props.media, m => m.src), ['main.jpg', 'side.jpg', 'bottom.jpg']);
  assert(viewer.props.media.every(m => m.kind === 'image'));
  viewer.props.onClose(); tree = h.render();
  assert(!tree.some(n => n.type === 'lightbox'));
  tree.find(n => n.type === 'button').props.onClick(); tree = h.render();
  assert.equal(tree.find(n => n.type === 'lightbox').props.startIndex, 0);
});

test('products with only the images array or a single cover can still be enlarged', () => {
  for (const item of [{ ten: 'Array only', images: ['array.jpg'] }, { ten: 'Cover only', anh: 'cover.jpg' }]) {
    const h = fixture(item); let tree = h.render();
    assert.equal(tree.find(n => n.type === 'button').props.disabled, false);
    assert.equal(tree.find(n => n.type === 'img').props.src, item.anh || item.images[0]);
    tree.find(n => n.type === 'button').props.onClick(); tree = h.render();
    assert.equal(tree.find(n => n.type === 'lightbox').props.media.length, 1);
  }
});

test('missing images render a disabled placeholder without an empty viewer', () => {
  const tree = fixture({ ten: 'No image', anh: ' ', images: ['', ' '] }).render();
  assert.equal(tree.find(n => n.type === 'button').props.disabled, true);
  assert(!tree.some(n => n.type === 'img' || n.type === 'lightbox'));
});
