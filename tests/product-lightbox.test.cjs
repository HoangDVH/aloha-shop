const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function handlers() {
  const source = fs.readFileSync('frontend/components/pdp/ProductVideoLightbox.tsx', 'utf8');
  const start = source.indexOf('  const onTouchStart =');
  const end = source.indexOf('  const navBtnClass', start);
  const code = ts.transpileModule(source.slice(start, end) + '\nglobalThis.handlers = { onTouchStart, onTouchEnd };',
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const navigations = [];
  const ctx = { media: [{}, {}, {}], safeIdx: 1, touchStart: { current: null }, goTo: i => navigations.push(i) };
  vm.runInNewContext(code, ctx);
  return { ...ctx.handlers, navigations };
}
const point = (x, y = 0) => ({ clientX: x, clientY: y });
test('lightbox horizontal swipes navigate both ways; taps and vertical movements do not', () => {
  const h = handlers();
  for (const [x, y] of [[-60, 0], [60, 0], [10, 0], [60, 100]]) {
    h.onTouchStart({ touches: [point(100)] });
    h.onTouchEnd({ changedTouches: [point(100 + x, y)], touches: [] });
  }
  assert.deepEqual(h.navigations, [2, 0]);
});
test('pinch and unfinished multitouch gestures cannot navigate', () => {
  const h = handlers();
  h.onTouchStart({ touches: [point(100), point(200)] });
  h.onTouchEnd({ changedTouches: [point(0)], touches: [] });
  h.onTouchStart({ touches: [point(100)] });
  h.onTouchEnd({ changedTouches: [point(0)], touches: [point(200)] });
  h.onTouchEnd({ changedTouches: [point(0)], touches: [] });
  assert.deepEqual(h.navigations, []);
});
