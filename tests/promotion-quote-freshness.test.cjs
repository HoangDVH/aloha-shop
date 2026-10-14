const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('quantity, variant, voucher and wallet changes immediately invalidate the previous quote', async () => {
  const exports = {}, states = [], effects = [], timers = [];
  let stateIndex = 0;
  const quote = { subtotal: 40000, discountTotal: 2000, finalTotal: 38000 };
  const code = ts.transpileModule(fs.readFileSync('frontend/lib/usePromotionQuote.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, AbortController, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    require(name) {
      if (name === 'react') return {
        useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect: fn => effects.push(fn),
        useState: initial => {
          const i = stateIndex++;
          if (!(i in states)) states[i] = initial;
          return [states[i], value => { states[i] = value; }];
        },
      };
      if (name === '@/components/ShopAuthProvider') return { useShopAuth: () => ({ user: { id: 'buyer' }, loading: false, authBusy: false }) };
      if (name === './promotions') return { requestPromotionQuote: async () => ({ ok: true, quote }) };
      throw new Error(name);
    },
  });
  const input = { lines: [{ ma: 'A', gia: 40000, qty: 1 }], selectedCode: '', autoMode: true, refreshKey: 'wallet-1' };
  const render = props => { stateIndex = 0; return exports.usePromotionQuote(props); };
  assert.equal(render(input).loading, true);
  effects.at(-1)();
  timers.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(render(input).quote, quote);
  assert.equal(render(input).loading, false);
  assert.equal(render({ ...input, lines: [] }).quote, null);
  for (const changed of [
    { ...input, lines: [{ ma: 'A', gia: 40000, qty: 2 }] },
    { ...input, lines: [{ ma: 'B', gia: 60000, qty: 1 }] },
    { ...input, selectedCode: 'OTHER' },
    { ...input, refreshKey: 'wallet-2' },
    { ...input, phone: 'new-identity' },
  ]) {
    const result = render(changed);
    assert.equal(result.loading, true);
    assert.ok(result.quote === null || result.stale);
  }
});
