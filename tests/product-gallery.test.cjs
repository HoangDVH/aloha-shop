const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('frontend/components/pdp/ProductGallery.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(props = {}) {
  const exports = {}, states = [], frames = [], scrolls = [];
  let i = 0;
  const jsx = (type, props) => ({ type, props: props || {} });
  vm.runInNewContext(code, { exports,
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return { useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
        useRef: value => ({ current: value }), useState: value => {
          const n = i++; states[n] = value;
          return [value, next => { states[n] = typeof next === 'function' ? next(states[n]) : next; }];
        } };
      if (name === 'lucide-react') return {};
      if (name === '@/components/pdp/ProductVideoLightbox') return { ProductVideoLightbox: 'lightbox' };
      throw new Error(name);
    },
  });
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    return node && typeof node === 'object' ? [node, ...walk(node.props.children)] : [];
  }
  const nodes = walk(exports.ProductGallery({ images: ['a.jpg', 'b.jpg', 'c.jpg'], alt: 'Plant', resetKey: 'A', ...props }));
  const viewport = nodes.find(n => n.props.onScroll);
  const element = { clientWidth: 320, scrollLeft: 0, scrollTo: target => scrolls.push(target) };
  viewport.props.ref.current = element;
  return { nodes, viewport, element, states, scrolls, frames };
}

test('gallery retains the image strip and browser scroll-snap instead of swapping the active image', () => {
  const f = fixture();
  const slides = f.viewport.props.children;
  assert.equal(slides.length, 3);
  assert.deepEqual(Array.from(slides, s => s.props.children.props.src), ['a.jpg', 'b.jpg', 'c.jpg']);
  assert.ok(f.viewport.props.className.includes('snap-mandatory'));
  assert.equal(slides[1].props.children.props.loading, 'eager');
  assert.equal(slides[2].props.children.props.loading, 'lazy');
});

test('scrolling tracks and clamps active slide; thumbnail selection smoothly scrolls to the slide', () => {
  const f = fixture();
  f.element.scrollLeft = 320;
  f.viewport.props.onScroll(); f.frames.shift()();
  assert.equal(f.states[0], 1);
  f.element.scrollLeft = 1500;
  f.viewport.props.onScroll(); f.frames.shift()();
  assert.equal(f.states[0], 2);
  const thumb = f.nodes.find(n => n.type === 'button' && n.props['aria-label'] === 'Ảnh 3');
  thumb.props.onClick();
  assert.equal(f.scrolls.at(-1).left, 640);
  assert.equal(f.scrolls.at(-1).behavior, 'smooth');
});

test('dragging does not accidentally open the lightbox, while a fresh tap may open it', () => {
  const f = fixture();
  f.viewport.props.onTouchStart({ touches: [{ clientX: 100, clientY: 100 }] });
  f.viewport.props.onTouchMove({ touches: [{ clientX: 40, clientY: 102 }] });
  let prevented = false, stopped = false;
  f.viewport.props.onClickCapture({ preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
  assert.ok(prevented && stopped);
  assert.equal(f.states[1], false);
  f.viewport.props.onTouchStart({ touches: [{ clientX: 40, clientY: 100 }] });
  f.viewport.props.onClickCapture({ preventDefault: () => assert.fail('tap prevented'), stopPropagation() {} });
  f.viewport.props.children[0].props.children.props.onClick();
  assert.equal(f.states[1], true);
});
