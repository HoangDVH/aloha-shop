const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('frontend/lib/useScrollHeader.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function fixture(menuOpen = false) {
  let hidden, listener, frame, cleanup;
  const exports = {};
  const header = { offsetHeight: 160, contains: () => false, querySelector: () => null };
  const window = { scrollY: 0, addEventListener: (_, fn) => listener = fn,
    removeEventListener: () => listener = null, requestAnimationFrame: fn => { frame = fn; return 1; },
    cancelAnimationFrame: () => frame = null };
  vm.runInNewContext(code, { exports, window, document: { activeElement: null }, require: () => ({
    useState: () => [false, value => hidden = value], useEffect: fn => cleanup = fn(),
  }) });
  exports.useScrollHeader({ current: header }, menuOpen, '/tim');
  return { header, get hidden() { return hidden; }, cleanup: () => { cleanup(); assert.equal(listener, null); },
    scroll(y) { window.scrollY = y; listener(); frame(); } };
}
test('header stays visible near the top, hides downward and returns upward without reacting to jitter', () => {
  const f = fixture();
  f.scroll(100); assert.equal(f.hidden, false);
  f.scroll(300); assert.equal(f.hidden, true);
  f.scroll(296); assert.equal(f.hidden, true);
  f.scroll(280); assert.equal(f.hidden, false);
  f.scroll(0); assert.equal(f.hidden, false);
  f.cleanup();
});
test('open menus and focused header controls keep the header visible', () => {
  const open = fixture(true); open.scroll(400); assert.equal(open.hidden, false); open.cleanup();
  const focused = fixture(); focused.header.contains = () => true;
  focused.scroll(400); assert.equal(focused.hidden, false); focused.cleanup();
  const expanded = fixture(); expanded.header.querySelector = () => ({});
  expanded.scroll(400); assert.equal(expanded.hidden, false); expanded.cleanup();
});
