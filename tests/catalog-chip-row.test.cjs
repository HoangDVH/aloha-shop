const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const frontendRequire = require('node:module').createRequire(require('node:path').resolve('frontend/package.json'));
const React = frontendRequire('react');
const runtime = frontendRequire('react/jsx-runtime');
const code = ts.transpileModule(fs.readFileSync('frontend/components/catalog/CatalogChipRow.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function render(expanded = false, leading = 0, nested = false, pinned = false) {
 const exports = {}, calls = [];
 vm.runInNewContext(code, { exports, require(name) {
   if (name === 'react') return { ...React, useState: () => [expanded, v => calls.push(v(expanded))] };
   if (name === 'react/jsx-runtime') return runtime;
   throw new Error(name);
 } });
 const chips = Array.from({length: 8}, (_, i) => runtime.jsx('button', {children: String(i)}, i));
 if (pinned) chips[7] = runtime.jsx("button", {children: "selected", "data-always-visible": true}, 7);
 const tree = exports.CatalogChipRow({ children: nested ? [runtime.jsx(React.Fragment, {children: chips.slice(0, 4)}, "prices"), runtime.jsx(React.Fragment, {children: chips.slice(0, 4)}, "categories")] : runtime.jsx(React.Fragment, {children: chips}), leading });
 return {tree, calls};
}
test('desktop previews five choices while remaining chips stay mobile-only', () => {
 const {tree} = render();
 const items = tree.props.children[0];
 assert.equal(items.length, 8);
 assert.equal(items.filter(n => n.props.children.type === 'span').length, 3);
 assert.match(tree.props.children[1].props.children, /\(3\)/);
 assert.match(tree.props.className, /lg:flex-wrap lg:overflow-visible/);
 assert.match(tree.props.children[1].props.className, /hidden.*lg:inline-flex/);
});
test('expanding shows every desktop choice and can collapse again', () => {
 const {tree, calls} = render(true);
 assert.equal(tree.props.children[0].filter(n => n.props.children.type === 'span').length, 0);
 tree.props.children[1].props.onClick();
 assert.deepEqual(calls, [false]);
});
test('filter trigger does not count toward the five-choice limit', () => {
 const {tree} = render(false, 1);
 assert.equal(tree.props.children[0].filter(n => n.props.children.type === 'span').length, 2);
});

test('nested groups with identical child keys receive unique stable keys', () => {
 const first = render(false, 0, true).tree.props.children[0];
 const expanded = render(true, 0, true).tree.props.children[0];
 assert.equal(new Set(first.map(n => n.key)).size, 8);
 assert.deepEqual(first.map(n => n.key), expanded.map(n => n.key));
});

test('selected filters remain visible beyond the desktop preview limit', () => {
 const items = render(false, 0, false, true).tree.props.children[0];
 assert.equal(items[7].props.children.type, 'button');
 assert.equal(items.filter(n => n.props.children.type === 'span').length, 2);
});
