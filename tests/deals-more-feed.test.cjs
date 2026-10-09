const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const code = ts.transpileModule(fs.readFileSync('frontend/components/campaign/deals/DealsMoreFeed.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const slots = [], effects = [], calls = [], exports = {};
  let index = 0;
  const memo = (fn, deps) => {
    const i = index++;
    if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) slots[i] = { deps, value: fn() };
    return slots[i].value;
  };
  vm.runInNewContext(code, { exports, AbortController, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { __esModule: true, default: 'link' };
    if (name === 'lucide-react') return { Heart: 'heart' };
    if (name === '@/components/ProductCard') return { ProductGrid: 'grid' };
    if (name === '@/lib/api') return { fetchProducts: opts => new Promise((resolve, reject) => calls.push({ opts, resolve, reject })) };
    if (name === 'react') return {
      useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
      useState(initial) {
        const i = index++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
      },
      useRef(initial) { const i = index++; return slots[i] ||= { current: initial }; },
      useEffect(fn, deps) {
        const i = index++;
        if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) {
          const old = slots[i]; slots[i] = { deps };
          effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
        }
      },
    };
    throw new Error(name);
  }, IntersectionObserver() { throw new Error('Suggestions must not auto-load on scroll'); } });
  function nodes(n) { return Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props.children)] : []; }
  function render() {
    index = 0;
    const tree = exports.DealsMoreFeed({ campaign: { products: [{ ma: 'campaign' }] } });
    while (effects.length) effects.shift()();
    return nodes(tree);
  }
  return { render, calls };
}

test('initial suggestions request at most twelve; further pages load only on click', async () => {
  const f = fixture(); f.render();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].opts.limit, 12);
  f.calls[0].resolve({ items: Array.from({ length: 12 }, (_, i) => ({ ma: String(i) })), pages: 3 });
  await flush();
  const nodes = f.render();
  assert.equal(nodes.find(n => n.type === 'grid').props.products.length, 12);
  f.render(); assert.equal(f.calls.length, 1);
  const more = nodes.find(n => n.type === 'button');
  more.props.onClick(); more.props.onClick();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].opts.page, 2);
  f.calls[1].resolve({ items: [{ ma: '0' }, { ma: 'CAMPAIGN' }, { ma: 'new' }], pages: 2 });
  await flush();
  const completed = f.render();
  assert.equal(completed.find(n => n.type === 'grid').props.products.length, 13);
  assert.equal(completed.filter(n => n.type === 'button').length, 0);
  assert.equal(completed.find(n => n.type === 'link').props.href, '/tim');
});

test('failed page remains retryable instead of marking suggestions exhausted', async () => {
  const f = fixture(); f.render();
  f.calls[0].reject(new Error('offline')); await flush();
  const nodes = f.render();
  assert.ok(nodes.find(n => n.props.role === 'status'));
  const retry = nodes.find(n => n.type === 'button');
  assert.equal(retry.props.disabled, false);
  retry.props.onClick();
  assert.equal(f.calls[1].opts.page, 1);
  assert.equal(f.calls[1].opts.limit, 12);
});
