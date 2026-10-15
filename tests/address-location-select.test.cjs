const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('../frontend/node_modules/react');
const jsx = (type, props) => ({ type, props: props || {} });
function setup() {
  const state = [], changes = [];
  let cursor = 0;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('frontend/components/AddressLocationSelect.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
      const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => state[i] = value];
    } };
    if (name === 'lucide-react') return {};
    throw Error(name);
  } });
  const children = [React.createElement('option', { value: '' }, 'Choose'),
    [React.createElement('option', { value: 202, key: '202' }, 'Province A'), React.createElement('option', { value: '00567', key: '00567' }, 'Ward B')]];
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props.children)] : [];
  const render = (mobilePicker = true) => { cursor = 0; return flatten(exports.AddressLocationSelect({ children, value: 202, mobilePicker, onChange: e => changes.push(e.target.value) })); };
  return { render, changes };
}
test('mobile options use a bounded scrolling dialog and return exact geographic codes', () => {
  const h = setup(); h.render().find(n => n.type === 'button').props.onClick();
  const nodes = h.render();
  assert.equal(nodes.some(n => n.type === 'select'), false);
  assert.ok(nodes.find(n => n.props.role === 'dialog').props.className.includes('inset-0'));
  assert.ok(nodes.some(n => n.props.className?.includes('overflow-y-auto')));
  const ward = nodes.find(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children[0]?.props.children === 'Ward B');
  ward.props.onClick(); assert.equal(h.changes[0], '00567');
  assert.equal(h.render().some(n => n.props.role === 'dialog'), false);
});
test('desktop continues using the native select', () => {
  const h = setup(); assert.equal(h.render(false)[0].type, 'select');
});
