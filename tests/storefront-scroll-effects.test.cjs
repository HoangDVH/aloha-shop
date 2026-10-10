const test = require('node:test'), assert = require('node:assert/strict');
const ts = require('typescript'), fs = require('node:fs'), vm = require('node:vm');
const code = ts.transpileModule(fs.readFileSync('frontend/components/StorefrontScrollEffects.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function fixture(reduced = false) {
  let callback, scroll, visible, cleanup, animations = 0, unobserved = 0, scrolled;
  const target = { animate: () => { animations++; return { cancel() {} }; } };
  const media = { matches: reduced, addEventListener() {}, removeEventListener() {} };
  const window = { innerHeight: 800, scrollY: 0, matchMedia: () => media,
    IntersectionObserver: true, addEventListener: (_, fn) => scroll = fn, removeEventListener() {},
    scrollTo: opts => scrolled = opts };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(code, { exports, window,
    document: { querySelectorAll: () => [target], querySelector: () => ({}), body: {} },
    IntersectionObserver: class { constructor(fn) { callback = fn; } observe() {} unobserve() { unobserved++; } disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    require(name) {
      if (name === 'react') return { useState: () => [true, v => visible = v], useEffect: fn => cleanup = fn() };
      if (name === 'next/navigation') return { usePathname: () => '/' };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return { ArrowUp: 'icon' };
      throw Error(name);
    },
  });
  const button = exports.StorefrontScrollEffects();
  return { enter() { callback([{ isIntersecting: true, target }]); }, get animations() { return animations; },
    get unobserved() { return unobserved; }, get visible() { return visible; },
    scroll(y) { window.scrollY = y; scroll(); }, top() { button.props.onClick(); return scrolled; }, cleanup };
}
test('revealed sections stop being observed and scroll-to-top appears only after a full screen', () => {
  const f = fixture(); assert.equal(f.visible, false);
  f.enter(); assert.equal(f.animations, 1); assert.equal(f.unobserved, 1);
  f.scroll(900); assert.equal(f.visible, true);
  f.scroll(400); assert.equal(f.visible, false);
  assert.equal(f.top().behavior, 'smooth'); f.cleanup();
});
test('reduced motion skips reveal animation and scrolls to the top instantly', () => {
  const f = fixture(true); f.enter(); assert.equal(f.animations, 0);
  assert.equal(f.top().behavior, 'instant'); f.cleanup();
});
