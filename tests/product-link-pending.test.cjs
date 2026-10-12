const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  let pending = false;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('frontend/components/ProductLinkPending.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'next/link') return { useLinkStatus: () => ({ pending }) };
    if (name === 'lucide-react') return { Loader2: 'spinner' };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    throw new Error(name);
  }, setTimeout() { throw new Error('Navigation feedback must not expire on a timer'); } });
  return { render: exports.ProductLinkPending, setPending(value) { pending = value; } };
}

test('slow navigation stays visibly pending until the router finishes, without a 3-second timer', () => {
  const f = fixture();
  assert.equal(f.render({ overlay: true }), null);
  f.setPending(true);
  for (let render = 0; render < 10; render++) {
    const feedback = f.render({ overlay: true });
    assert.equal(feedback.props.role, 'status');
    assert.match(feedback.props.className, /pointer-events-none/);
  }
  f.setPending(false);
  assert.equal(f.render({ overlay: true }), null);
});

test('title and image feedback both reset when navigation ends or is superseded', () => {
  const f = fixture();
  f.setPending(true);
  assert.equal(f.render({}).props.children.type, 'spinner');
  assert.equal(f.render({ overlay: true }).props.children.type, 'spinner');
  f.setPending(false);
  assert.equal(f.render({}), null);
  assert.equal(f.render({ overlay: true }), null);
});
