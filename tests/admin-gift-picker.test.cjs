const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(initial, response) {
  const state = initial;
  let index = 0, effect, timer, requests = 0;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('frontend/components/admin/website/gifts/GiftProductPicker.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams,
    setTimeout(fn) { timer = fn; return 1; }, clearTimeout() {},
    require(name) {
      if (name === 'react') return {
        useState(value) { const i = index++; if (state[i] === undefined) state[i] = value; return [state[i], v => state[i] = typeof v === 'function' ? v(state[i]) : v]; },
        useEffect(fn) { effect = fn; },
      };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props}) };
      if (name === 'antd') return {Input: {Search: 'search'}};
      if (name === 'lucide-react') return {};
      if (name.endsWith('/adminFetch')) return {adminFetch: async () => { requests++; return response; }};
      throw Error(name);
    },
  });
  return { state, async run(value) { exports.GiftProductPicker({value}); effect(); if (timer) await timer(); return requests; } };
}

test('refresh removes stale availability for deleted selected products and retains other cached products', async () => {
  const h = harness(['rose', 1, undefined, {OLD: {ma: 'OLD', visible: true}, KEEP: {ma: 'KEEP'}}, false, '', 0],
    {items: [], selected: [], total: 0, limit: 12});
  assert.equal(await h.run(['OLD']), 1);
  assert.equal(h.state[3].OLD, undefined);
  assert.equal(h.state[3].KEEP.ma, 'KEEP');
});

test('empty search without selections clears previous error without a request', async () => {
  const h = harness(['', 1, undefined, {}, true, 'Network error', 0]);
  assert.equal(await h.run([]), 0);
  assert.equal(h.state[4], false);
  assert.equal(h.state[5], '');
});

test('selected products refresh even when search is empty', async () => {
  const h = harness(['', 1, undefined, {}, false, '', 0],
    {items: [], selected: [{ma: 'A', visible: false}], total: 0, limit: 12});
  assert.equal(await h.run(['A']), 1);
  assert.equal(h.state[3].A.visible, false);
});
