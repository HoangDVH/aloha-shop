const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Commit effects and advance timers explicitly; no network or wall-clock sleeps.
function hooksHarness() {
  let cursor = 0, now = 0, nextTimer = 1;
  const slots = [], effects = [], timers = new Map();
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('frontend/lib/usePendingValue.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports,
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      assert.equal(name, 'react');
      return {
        useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, next => slots[i].value = next]; },
        useEffect(effect, deps) {
          const i = cursor++, previous = slots[i];
          if (!previous || deps.some((value, j) => !Object.is(value, previous.deps[j]))) {
            effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
          }
        },
      };
    },
  });
  return {
    render(name, ...args) { cursor = 0; const result = exports[name](...args); for (const effect of effects.splice(0)) effect(); return result; },
    advance(ms) { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
    timerCount: () => timers.size,
  };
}

test('keeps the latest confirmed price through rapid changes, then replaces it atomically', () => {
  const h = hooksHarness(), first = { amount: 100, discount: 10 }, second = { amount: 200, discount: 20 };
  assert.equal(h.render('usePendingValue', first, false, 'buyer-a'), first);
  assert.equal(h.render('usePendingValue', { amount: 999 }, true, 'buyer-a'), first);
  assert.equal(h.render('usePendingValue', { amount: 888 }, true, 'buyer-a'), first);
  assert.equal(h.render('usePendingValue', second, false, 'buyer-a'), second);
  assert.equal(h.render('usePendingValue', null, true, 'buyer-a'), second);
});
test('no previous buyer or delivery mode leaks into a pending display', () => {
  const h = hooksHarness();
  h.render('usePendingValue', 12500, false, 'buyer-a:delivery');
  assert.equal(h.render('usePendingValue', 0, true, 'buyer-b:delivery'), null);
  assert.equal(h.render('usePendingValue', 0, true, 'buyer-a:delivery'), null);
  h.render('usePendingValue', 0, false, 'buyer-b:pickup');
  assert.equal(h.render('usePendingValue', 999, true, 'buyer-b:pickup'), 0);
  assert.equal(h.render('usePendingValue', 0, true, 'buyer-b:delivery'), null);
});
test('initial pending prices do not display unconfirmed local amounts', () => {
  const h = hooksHarness();
  assert.equal(h.render('usePendingValue', 99999, true, 'buyer'), null);
  assert.equal(h.render('usePendingValue', 0, true, 'buyer'), null);
});
test('spinner starts at 200ms, disappears immediately and never flashes for fast responses', () => {
  const h = hooksHarness();
  assert.equal(h.render('useDelayedPending', false), false);
  assert.equal(h.render('useDelayedPending', true), false);
  h.advance(199); assert.equal(h.render('useDelayedPending', true), false);
  h.advance(1); assert.equal(h.render('useDelayedPending', true), true);
  assert.equal(h.render('useDelayedPending', false), false);
  assert.equal(h.render('useDelayedPending', true), false);
  h.advance(100); assert.equal(h.render('useDelayedPending', false), false);
  h.advance(300); assert.equal(h.render('useDelayedPending', false), false);
  assert.equal(h.timerCount(), 0);
});
test('unmount cancels the spinner timer', () => {
  const h = hooksHarness(); h.render('useDelayedPending', true);
  assert.equal(h.timerCount(), 1); h.dispose(); assert.equal(h.timerCount(), 0);
});
